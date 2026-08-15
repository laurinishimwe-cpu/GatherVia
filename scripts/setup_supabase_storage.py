from __future__ import annotations

import json
from pathlib import Path
import socket
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlparse
from urllib.request import Request, urlopen

REPOSITORY_ROOT = Path(__file__).resolve().parent.parent
if str(REPOSITORY_ROOT) not in sys.path:
    sys.path.insert(0, str(REPOSITORY_ROOT))

from app.services.storage import (  # noqa: E402
    get_supabase_storage_config,
    get_supabase_storage_headers,
)


TEST_OBJECT = "setup-check/storage-check.svg"
TEST_CONTENT = (
    b'<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1">'
    b'<rect width="1" height="1" fill="#4fd6be"/></svg>'
)


def request_json(
    url: str,
    key: str,
    *,
    method: str = "GET",
    payload: dict[str, object] | None = None,
) -> tuple[int, dict[str, object] | list[object] | None]:
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = Request(
        url,
        data=body,
        method=method,
        headers={
            **get_supabase_storage_headers(key),
            "content-type": "application/json",
        },
    )
    try:
        with urlopen(request, timeout=30) as response:
            raw = response.read()
            return response.status, json.loads(raw) if raw else None
    except HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        message = raw or exc.reason
        raise RuntimeError(f"Supabase returned HTTP {exc.code}: {message}") from exc
    except URLError as exc:
        raise RuntimeError(f"Could not connect to Supabase: {exc.reason}") from exc


def bucket_exists(base_url: str, key: str, bucket: str) -> bool:
    _, buckets = request_json(f"{base_url}/storage/v1/bucket", key)
    if not isinstance(buckets, list):
        raise RuntimeError("Supabase returned an invalid bucket list response.")
    return any(
        isinstance(item, dict) and item.get("id") == bucket
        for item in buckets
    )


def upload_test_object(base_url: str, key: str, bucket: str) -> str:
    encoded_object = quote(TEST_OBJECT, safe="/")
    request = Request(
        f"{base_url}/storage/v1/object/{quote(bucket, safe='')}/{encoded_object}",
        data=TEST_CONTENT,
        method="POST",
        headers={
            **get_supabase_storage_headers(key),
            "content-type": "image/svg+xml",
            "x-upsert": "true",
        },
    )
    try:
        with urlopen(request, timeout=30) as response:
            response.read()
    except HTTPError as exc:
        message = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Test upload failed (HTTP {exc.code}): {message}") from exc
    except URLError as exc:
        raise RuntimeError(f"Test upload could not connect: {exc.reason}") from exc
    return f"{base_url}/storage/v1/object/public/{bucket}/{encoded_object}"


def verify_public_url(public_url: str) -> None:
    try:
        with urlopen(public_url, timeout=30) as response:
            if response.status != 200 or response.read() != TEST_CONTENT:
                raise RuntimeError("The public test object did not match the uploaded content.")
    except (HTTPError, URLError) as exc:
        raise RuntimeError(f"Public URL verification failed: {exc}") from exc


def delete_test_object(base_url: str, key: str, bucket: str) -> None:
    request_json(
        f"{base_url}/storage/v1/object/{quote(bucket, safe='')}",
        key,
        method="DELETE",
        payload={"prefixes": [TEST_OBJECT]},
    )


def main() -> int:
    try:
        base_url, key, bucket = get_supabase_storage_config()
        hostname = urlparse(base_url).hostname
        assert hostname is not None
        socket.getaddrinfo(hostname, 443)

        print(f"Connected to Supabase project: {hostname}")
        if bucket_exists(base_url, key, bucket):
            print(f"Bucket already exists: {bucket}")
        else:
            request_json(
                f"{base_url}/storage/v1/bucket",
                key,
                method="POST",
                payload={
                    "id": bucket,
                    "name": bucket,
                    "public": True,
                    "file_size_limit": 10485760,
                    "allowed_mime_types": ["image/*"],
                },
            )
            print(f"Created public image bucket: {bucket}")

        public_url = upload_test_object(base_url, key, bucket)
        print("Test upload succeeded.")
        verify_public_url(public_url)
        print("Public download succeeded.")
        delete_test_object(base_url, key, bucket)
        print("Test cleanup succeeded. Supabase Storage is ready.")
        return 0
    except (RuntimeError, OSError) as exc:
        print(f"Storage setup failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
