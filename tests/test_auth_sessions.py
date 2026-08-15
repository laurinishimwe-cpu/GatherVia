import unittest
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.services.auth_sessions import (
    AuthSessionError,
    _token_hash,
    create_refresh_session,
    rotate_refresh_session,
)


class AuthSessionTests(unittest.IsolatedAsyncioTestCase):
    async def test_issue_stores_only_a_digest(self) -> None:
        collection = SimpleNamespace(insert_one=AsyncMock())
        with patch("app.services.auth_sessions.get_collection", return_value=collection):
            issued = await create_refresh_session(
                "507f191e810c19729de860ea",
                client_kind="mobile",
                installation_id="installation-1",
            )

        document = collection.insert_one.await_args.args[0]
        self.assertNotIn(issued.refresh_token, str(document))
        self.assertEqual(document["token_hash"], _token_hash(issued.refresh_token))
        self.assertEqual(document["installation_id"], "installation-1")

    async def test_rotation_replaces_the_token_atomically(self) -> None:
        token = f"{'a' * 32}.{'old-secret' * 6}"
        document = {
            "_id": "a" * 32,
            "user_id": "507f191e810c19729de860ea",
            "token_hash": _token_hash(token),
            "used_token_hashes": [],
            "installation_id": "installation-1",
            "expires_at": datetime.now(UTC) + timedelta(days=30),
            "revoked_at": None,
        }
        collection = SimpleNamespace(
            find_one=AsyncMock(return_value=document),
            update_one=AsyncMock(return_value=SimpleNamespace(modified_count=1)),
        )
        with patch("app.services.auth_sessions.get_collection", return_value=collection):
            rotated = await rotate_refresh_session(
                token,
                installation_id="installation-1",
            )

        self.assertNotEqual(rotated.refresh_token, token)
        self.assertEqual(rotated.session_id, "a" * 32)
        update_filter = collection.update_one.await_args.args[0]
        update_document = collection.update_one.await_args.args[1]
        self.assertEqual(update_filter["token_hash"], _token_hash(token))
        self.assertNotEqual(update_document["$set"]["token_hash"], _token_hash(token))
        self.assertEqual(
            update_document["$push"]["used_token_hashes"]["$each"],
            [_token_hash(token)],
        )

    async def test_reused_rotated_token_revokes_the_session(self) -> None:
        old_token = f"{'b' * 32}.{'old-secret' * 6}"
        current_token = f"{'b' * 32}.{'new-secret' * 6}"
        document = {
            "_id": "b" * 32,
            "user_id": "507f191e810c19729de860ea",
            "token_hash": _token_hash(current_token),
            "used_token_hashes": [_token_hash(old_token)],
            "installation_id": None,
            "expires_at": datetime.now(UTC) + timedelta(days=30),
            "revoked_at": None,
        }
        collection = SimpleNamespace(
            find_one=AsyncMock(return_value=document),
            update_one=AsyncMock(return_value=SimpleNamespace(modified_count=1)),
        )
        with patch("app.services.auth_sessions.get_collection", return_value=collection):
            with self.assertRaises(AuthSessionError):
                await rotate_refresh_session(old_token)

        revoke_update = collection.update_one.await_args.args[1]["$set"]
        self.assertEqual(revoke_update["revoke_reason"], "refresh_token_reuse")

    async def test_recent_previous_token_recovers_a_lost_refresh_response(self) -> None:
        old_token = f"{'d' * 32}.{'old-secret' * 6}"
        current_token = f"{'d' * 32}.{'new-secret' * 6}"
        document = {
            "_id": "d" * 32,
            "user_id": "507f191e810c19729de860ea",
            "token_hash": _token_hash(current_token),
            "previous_token_hash": _token_hash(old_token),
            "previous_valid_until": datetime.now(UTC) + timedelta(seconds=20),
            "used_token_hashes": [_token_hash(old_token)],
            "installation_id": None,
            "expires_at": datetime.now(UTC) + timedelta(days=30),
            "revoked_at": None,
        }
        collection = SimpleNamespace(
            find_one=AsyncMock(return_value=document),
            update_one=AsyncMock(return_value=SimpleNamespace(modified_count=1)),
        )
        with patch("app.services.auth_sessions.get_collection", return_value=collection):
            recovered = await rotate_refresh_session(old_token)

        self.assertNotEqual(recovered.refresh_token, current_token)
        update_filter = collection.update_one.await_args.args[0]
        self.assertEqual(update_filter["token_hash"], _token_hash(current_token))

    async def test_mobile_session_is_bound_to_its_installation(self) -> None:
        token = f"{'c' * 32}.{'secret' * 10}"
        document = {
            "_id": "c" * 32,
            "user_id": "507f191e810c19729de860ea",
            "token_hash": _token_hash(token),
            "used_token_hashes": [],
            "installation_id": "installation-1",
            "expires_at": datetime.now(UTC) + timedelta(days=30),
            "revoked_at": None,
        }
        collection = SimpleNamespace(find_one=AsyncMock(return_value=document))
        with patch("app.services.auth_sessions.get_collection", return_value=collection):
            with self.assertRaises(AuthSessionError):
                await rotate_refresh_session(token, installation_id="installation-2")


if __name__ == "__main__":
    unittest.main()
