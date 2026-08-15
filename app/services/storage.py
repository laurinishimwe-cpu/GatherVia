from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlparse
from urllib.request import Request, urlopen

from app.core.config import settings

LOCAL_FLYER_UPLOAD_ROOT = Path("uploads/flyers")


@dataclass(frozen=True)
class StoredAsset:
    provider: str
    bucket: str
    object_path: str
    public_url: str
    filename: str


def get_supabase_storage_config() -> tuple[str, str, str]:
    """Return validated server-side Supabase Storage configuration."""
    raw_url = (settings.supabase_url or "").strip()
    service_key = (settings.supabase_service_role_key or "").strip()
    bucket = settings.supabase_storage_bucket.strip()

    if not raw_url or not service_key:
        raise RuntimeError(
            "Supabase storage is not configured. Set SUPABASE_URL and "
            "SUPABASE_SERVICE_ROLE_KEY in the backend .env file."
        )

    parsed = urlparse(raw_url)
    if parsed.scheme != "https" or not parsed.hostname:
        raise RuntimeError(
            "SUPABASE_URL must be the HTTPS project URL, for example "
            "https://your-project-ref.supabase.co."
        )
    if parsed.path.rstrip("/"):
        raise RuntimeError(
            "SUPABASE_URL must be the project root URL without /rest/v1 or another path."
        )
    if not parsed.hostname.endswith(".supabase.co"):
        raise RuntimeError("SUPABASE_URL must point to a Supabase project host.")
    if service_key.startswith("sb_publishable_"):
        raise RuntimeError(
            "SUPABASE_SERVICE_ROLE_KEY contains a publishable key. Use the backend-only "
            "sb_secret_ key or the legacy service_role key from the Supabase dashboard."
        )
    if not bucket:
        raise RuntimeError("SUPABASE_STORAGE_BUCKET cannot be empty.")

    return raw_url.rstrip("/"), service_key, bucket


def get_supabase_storage_headers(service_key: str) -> dict[str, str]:
    headers = {"apikey": service_key}
    if not service_key.startswith("sb_secret_"):
        headers["Authorization"] = f"Bearer {service_key}"
    return headers


def _build_local_asset(owner_id: str, filename: str, content: bytes) -> StoredAsset:
    owner_dir = LOCAL_FLYER_UPLOAD_ROOT / owner_id
    owner_dir.mkdir(parents=True, exist_ok=True)
    destination = owner_dir / filename
    destination.write_bytes(content)

    return StoredAsset(
        provider="local",
        bucket="local",
        object_path=f"{owner_id}/{filename}",
        public_url=f"/api/v1/flyers/assets/{owner_id}/{filename}",
        filename=filename,
    )


def _build_supabase_asset(
    *,
    owner_id: str,
    filename: str,
    content: bytes,
    content_type: str | None,
) -> StoredAsset:
    base_url, service_key, bucket = get_supabase_storage_config()
    object_path = f"{owner_id}/{filename}"
    encoded_path = quote(object_path, safe="/")
    upload_url = f"{base_url}/storage/v1/object/{bucket}/{encoded_path}"

    headers = {
        **get_supabase_storage_headers(service_key),
        "x-upsert": "true",
        "content-type": content_type or "application/octet-stream",
    }

    request = Request(upload_url, data=content, headers=headers, method="POST")
    try:
        with urlopen(request, timeout=30) as response:
            response.read()
    except (HTTPError, URLError) as exc:
        raise RuntimeError(f"Supabase storage upload failed: {exc}") from exc

    public_url = (
        f"{base_url}/storage/v1/object/public/{bucket}/{encoded_path}"
    )
    return StoredAsset(
        provider="supabase",
        bucket=bucket,
        object_path=object_path,
        public_url=public_url,
        filename=filename,
    )


def store_flyer_asset(
    *,
    owner_id: str,
    filename: str,
    content: bytes,
    content_type: str | None,
) -> StoredAsset:
    provider = settings.storage_provider.strip().lower()
    use_supabase = provider == "supabase" and settings.supabase_url and settings.supabase_service_role_key

    if use_supabase:
        try:
            return _build_supabase_asset(
                owner_id=owner_id,
                filename=filename,
                content=content,
                content_type=content_type,
            )
        except RuntimeError:
            if not settings.storage_fallback_local:
                raise

    return _build_local_asset(owner_id, filename, content)


def delete_stored_asset(
    *,
    provider: str,
    bucket: str | None,
    object_path: str | None,
) -> None:
    if not object_path:
        return

    normalized_provider = provider.strip().lower()
    if normalized_provider == "supabase":
        base_url, service_key, configured_bucket = get_supabase_storage_config()
        storage_bucket = bucket or configured_bucket
        delete_url = f"{base_url}/storage/v1/object/{quote(storage_bucket, safe='')}"
        payload = json.dumps({"prefixes": [object_path]}).encode("utf-8")
        request = Request(
            delete_url,
            data=payload,
            headers={
                **get_supabase_storage_headers(service_key),
                "content-type": "application/json",
            },
            method="DELETE",
        )
        try:
            with urlopen(request, timeout=30) as response:
                response.read()
        except (HTTPError, URLError) as exc:
            raise RuntimeError(f"Supabase storage deletion failed: {exc}") from exc
        return

    if normalized_provider == "local":
        upload_root = LOCAL_FLYER_UPLOAD_ROOT.resolve()
        target = (upload_root / object_path).resolve()
        try:
            target.relative_to(upload_root)
        except ValueError as exc:
            raise RuntimeError("Refusing to delete a local asset outside the upload root.") from exc
        target.unlink(missing_ok=True)
        parent = target.parent
        if parent != upload_root and parent.exists() and not any(parent.iterdir()):
            parent.rmdir()
        return

    raise RuntimeError(f"Unsupported storage provider: {provider}")
