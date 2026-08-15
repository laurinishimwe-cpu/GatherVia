"""Persistent, rotating authentication sessions for mobile and web clients."""

from __future__ import annotations

import hashlib
import hmac
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from app.core.config import settings
from app.core.database import get_collection

AUTH_SESSIONS_COLLECTION = "auth_sessions"
USED_TOKEN_HISTORY = 20
ROTATION_RETRY_GRACE_SECONDS = 30


class AuthSessionError(ValueError):
    """Raised when a refresh credential is invalid, expired, or revoked."""


@dataclass(frozen=True)
class RotatedSession:
    user_id: str
    refresh_token: str
    session_id: str


def _now() -> datetime:
    return datetime.now(UTC)


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _new_token(session_id: str) -> str:
    return f"{session_id}.{secrets.token_urlsafe(48)}"


def _session_id_from_token(token: str) -> str:
    session_id, separator, secret = token.partition(".")
    if separator != "." or len(session_id) != 32 or not secret:
        raise AuthSessionError("Invalid refresh session.")
    try:
        int(session_id, 16)
    except ValueError as exc:
        raise AuthSessionError("Invalid refresh session.") from exc
    return session_id


async def ensure_auth_session_indexes() -> None:
    """Create indexes used for session lookup, cleanup, and account management."""
    collection = get_collection(AUTH_SESSIONS_COLLECTION)
    await collection.create_index("user_id")
    await collection.create_index("expires_at", expireAfterSeconds=0)


async def create_refresh_session(
    user_id: str,
    *,
    client_kind: str = "unknown",
    installation_id: str | None = None,
    user_agent: str | None = None,
) -> RotatedSession:
    """Issue a new refresh session and store only its SHA-256 digest."""
    session_id = secrets.token_hex(16)
    refresh_token = _new_token(session_id)
    now = _now()
    await get_collection(AUTH_SESSIONS_COLLECTION).insert_one(
        {
            "_id": session_id,
            "user_id": user_id,
            "token_hash": _token_hash(refresh_token),
            "used_token_hashes": [],
            "previous_token_hash": None,
            "previous_valid_until": None,
            "client_kind": client_kind[:40],
            "installation_id": installation_id[:200] if installation_id else None,
            "user_agent": user_agent[:500] if user_agent else None,
            "created_at": now,
            "last_used_at": now,
            "expires_at": now + timedelta(days=settings.refresh_session_idle_days),
            "revoked_at": None,
        }
    )
    return RotatedSession(user_id=user_id, refresh_token=refresh_token, session_id=session_id)


async def rotate_refresh_session(
    token: str,
    *,
    installation_id: str | None = None,
) -> RotatedSession:
    """Atomically replace a refresh credential and detect replay of older values."""
    session_id = _session_id_from_token(token)
    collection = get_collection(AUTH_SESSIONS_COLLECTION)
    document = await collection.find_one({"_id": session_id})
    if document is None:
        raise AuthSessionError("Refresh session not found.")

    now = _now()
    expires_at = document.get("expires_at")
    if expires_at is not None and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    if document.get("revoked_at") is not None or not expires_at or expires_at <= now:
        raise AuthSessionError("Refresh session expired or revoked.")

    expected_installation = document.get("installation_id")
    if expected_installation and not hmac.compare_digest(
        str(expected_installation), installation_id or ""
    ):
        raise AuthSessionError("Refresh session belongs to another installation.")

    presented_hash = _token_hash(token)
    current_hash = str(document.get("token_hash", ""))
    used_hashes = [str(value) for value in document.get("used_token_hashes", [])]
    if not hmac.compare_digest(presented_hash, current_hash):
        previous_hash = str(document.get("previous_token_hash", ""))
        previous_valid_until = document.get("previous_valid_until")
        if previous_valid_until is not None and previous_valid_until.tzinfo is None:
            previous_valid_until = previous_valid_until.replace(tzinfo=UTC)
        retrying_lost_rotation = (
            previous_valid_until is not None
            and previous_valid_until > now
            and hmac.compare_digest(presented_hash, previous_hash)
        )
        if not retrying_lost_rotation and any(
            hmac.compare_digest(presented_hash, used) for used in used_hashes
        ):
            await collection.update_one(
                {"_id": session_id, "revoked_at": None},
                {"$set": {"revoked_at": now, "revoke_reason": "refresh_token_reuse"}},
            )
        if not retrying_lost_rotation:
            raise AuthSessionError("Refresh session is no longer valid.")

    replacement = _new_token(session_id)
    result = await collection.update_one(
        {"_id": session_id, "token_hash": current_hash, "revoked_at": None},
        {
            "$set": {
                "token_hash": _token_hash(replacement),
                "previous_token_hash": current_hash,
                "previous_valid_until": now
                + timedelta(seconds=ROTATION_RETRY_GRACE_SECONDS),
                "last_used_at": now,
                "expires_at": now + timedelta(days=settings.refresh_session_idle_days),
            },
            "$push": {
                "used_token_hashes": {
                    "$each": [current_hash],
                    "$slice": -USED_TOKEN_HISTORY,
                }
            },
        },
    )
    if result.modified_count != 1:
        await collection.update_one(
            {"_id": session_id, "revoked_at": None},
            {"$set": {"revoked_at": now, "revoke_reason": "concurrent_refresh"}},
        )
        raise AuthSessionError("Refresh session was already used.")

    return RotatedSession(
        user_id=str(document["user_id"]),
        refresh_token=replacement,
        session_id=session_id,
    )


async def revoke_refresh_session(token: str, *, reason: str = "logout") -> None:
    """Revoke the session represented by a current or recently rotated token."""
    try:
        session_id = _session_id_from_token(token)
    except AuthSessionError:
        return
    token_hash = _token_hash(token)
    document = await get_collection(AUTH_SESSIONS_COLLECTION).find_one({"_id": session_id})
    if document is None:
        return
    known_hashes = [str(document.get("token_hash", "")), *document.get("used_token_hashes", [])]
    if not any(hmac.compare_digest(token_hash, str(known)) for known in known_hashes):
        return
    await get_collection(AUTH_SESSIONS_COLLECTION).update_one(
        {"_id": session_id, "revoked_at": None},
        {"$set": {"revoked_at": _now(), "revoke_reason": reason}},
    )


async def revoke_user_sessions(
    user_id: str,
    *,
    reason: str,
    except_session_id: str | None = None,
) -> int:
    query: dict[str, Any] = {"user_id": user_id, "revoked_at": None}
    if except_session_id:
        query["_id"] = {"$ne": except_session_id}
    result = await get_collection(AUTH_SESSIONS_COLLECTION).update_many(
        query,
        {"$set": {"revoked_at": _now(), "revoke_reason": reason}},
    )
    return result.modified_count


async def list_user_sessions(user_id: str) -> list[dict[str, Any]]:
    cursor = get_collection(AUTH_SESSIONS_COLLECTION).find(
        {"user_id": user_id, "revoked_at": None},
        {
            "token_hash": 0,
            "used_token_hashes": 0,
        },
    ).sort("last_used_at", -1)
    return await cursor.to_list(length=100)


async def revoke_user_session_by_id(user_id: str, session_id: str) -> bool:
    result = await get_collection(AUTH_SESSIONS_COLLECTION).update_one(
        {"_id": session_id, "user_id": user_id, "revoked_at": None},
        {"$set": {"revoked_at": _now(), "revoke_reason": "device_revoked"}},
    )
    return result.modified_count == 1
