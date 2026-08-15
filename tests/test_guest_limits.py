import unittest
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException

from app.models.event import EventDesignStatus
from app.models.guest import CheckInStatus, GuestStatus
from app.models.user import AuthProvider, User, UserTier, UserTierSource, UserTierStatus
from app.services.guests import GUEST_LIMITS, _summarize_guests, check_guest_limit, register_guest_self


EVENT_ID = "507f1f77bcf86cd799439011"
OWNER_ID = "507f191e810c19729de860ea"


class GuestLimitTests(unittest.IsolatedAsyncioTestCase):
    def test_summary_keeps_approval_separate_from_physical_check_in(self) -> None:
        guests = [
            SimpleNamespace(status=GuestStatus.PENDING, check_in_logs=[]),
            SimpleNamespace(status=GuestStatus.CHECKED_IN, check_in_logs=[]),
            SimpleNamespace(
                status=GuestStatus.CHECKED_IN,
                check_in_logs=[SimpleNamespace(
                    status=CheckInStatus.CHECKED_IN,
                    door_id="Main door",
                    lookup_method="qr",
                    timestamp=datetime.now(UTC),
                )],
            ),
            SimpleNamespace(status=GuestStatus.REJECTED, check_in_logs=[]),
        ]

        summary = _summarize_guests(guests)

        self.assertEqual(summary.total, 4)
        self.assertEqual(summary.pending, 1)
        self.assertEqual(summary.approved, 2)
        self.assertEqual(summary.checked_in, 1)
        self.assertEqual(summary.rejected, 1)

    def test_unverified_legacy_paid_tier_falls_back_to_free(self) -> None:
        user = User(
            _id=OWNER_ID,
            email="legacy@example.com",
            full_name="Legacy User",
            auth_provider=AuthProvider.MANUAL,
            tier=UserTier.BASIC,
        )

        self.assertEqual(user.tier, UserTier.FREE)
        self.assertEqual(user.tier_source, UserTierSource.DEFAULT)

    def test_verified_mobile_iap_tier_is_preserved(self) -> None:
        user = User(
            _id=OWNER_ID,
            email="paid@example.com",
            full_name="Paid User",
            auth_provider=AuthProvider.MANUAL,
            tier=UserTier.BASIC,
            tier_source=UserTierSource.MOBILE_IAP,
            tier_status=UserTierStatus.ACTIVE,
            tier_expires_at=datetime.now(UTC) + timedelta(days=30),
        )

        self.assertEqual(user.tier, UserTier.BASIC)

    def test_expired_mobile_iap_tier_falls_back_to_free(self) -> None:
        user = User(
            _id=OWNER_ID,
            email="expired@example.com",
            full_name="Expired User",
            auth_provider=AuthProvider.MANUAL,
            tier=UserTier.PRO,
            tier_source=UserTierSource.MOBILE_IAP,
            tier_status=UserTierStatus.ACTIVE,
            tier_expires_at=datetime.now(UTC) - timedelta(seconds=1),
        )

        self.assertEqual(user.tier, UserTier.FREE)
        self.assertEqual(user.tier_status, UserTierStatus.EXPIRED)

    async def test_limit_status_uses_owner_tier_capacity(self) -> None:
        event = SimpleNamespace(owner_id=OWNER_ID, design_status=EventDesignStatus.PUBLISHED)

        for tier, limit in GUEST_LIMITS.items():
            for current, allowed in ((limit - 1, True), (limit, False)):
                with self.subTest(tier=tier, current=current):
                    collection = SimpleNamespace(
                        count_documents=AsyncMock(return_value=current),
                    )
                    with (
                        patch(
                            "app.services.guests.get_event_by_id",
                            AsyncMock(return_value=event),
                        ),
                        patch(
                            "app.services.guests.get_user_by_id",
                            AsyncMock(return_value=SimpleNamespace(tier=tier)),
                        ),
                        patch(
                            "app.services.guests.get_collection",
                            return_value=collection,
                        ),
                    ):
                        result = await check_guest_limit(EVENT_ID)

                    self.assertEqual(
                        result,
                        {
                            "allowed": allowed,
                            "current": current,
                            "limit": limit,
                            "tier": tier.value,
                        },
                    )

    async def test_missing_owner_falls_back_to_free(self) -> None:
        collection = SimpleNamespace(count_documents=AsyncMock(return_value=12))
        with (
            patch(
                "app.services.guests.get_event_by_id",
                AsyncMock(return_value=SimpleNamespace(owner_id=OWNER_ID, design_status=EventDesignStatus.PUBLISHED)),
            ),
            patch(
                "app.services.guests.get_user_by_id",
                AsyncMock(return_value=None),
            ),
            patch("app.services.guests.get_collection", return_value=collection),
        ):
            result = await check_guest_limit(EVENT_ID)

        self.assertEqual(result["tier"], UserTier.FREE.value)
        self.assertEqual(result["limit"], 50)
        self.assertTrue(result["allowed"])

    async def test_serialized_string_tier_uses_the_correct_capacity(self) -> None:
        collection = SimpleNamespace(count_documents=AsyncMock(return_value=51))
        with (
            patch(
                "app.services.guests.get_event_by_id",
                AsyncMock(return_value=SimpleNamespace(owner_id=OWNER_ID, design_status=EventDesignStatus.PUBLISHED)),
            ),
            patch(
                "app.services.guests.get_user_by_id",
                AsyncMock(return_value=SimpleNamespace(tier="basic")),
            ),
            patch("app.services.guests.get_collection", return_value=collection),
        ):
            result = await check_guest_limit(EVENT_ID)

        self.assertEqual(result["tier"], UserTier.BASIC.value)
        self.assertEqual(result["limit"], 150)
        self.assertTrue(result["allowed"])

    async def test_unknown_tier_safely_falls_back_to_free(self) -> None:
        collection = SimpleNamespace(count_documents=AsyncMock(return_value=49))
        with (
            patch(
                "app.services.guests.get_event_by_id",
                AsyncMock(return_value=SimpleNamespace(owner_id=OWNER_ID, design_status=EventDesignStatus.PUBLISHED)),
            ),
            patch(
                "app.services.guests.get_user_by_id",
                AsyncMock(return_value=SimpleNamespace(tier="legacy-plan")),
            ),
            patch("app.services.guests.get_collection", return_value=collection),
        ):
            result = await check_guest_limit(EVENT_ID)

        self.assertEqual(result["tier"], UserTier.FREE.value)
        self.assertEqual(result["limit"], 50)
        self.assertTrue(result["allowed"])

    async def test_registration_raises_402_before_insert_at_capacity(self) -> None:
        event = SimpleNamespace(
            owner_id=OWNER_ID,
            require_rsvp_approval=True,
            design_status=EventDesignStatus.PUBLISHED,
        )
        collection = SimpleNamespace(
            find_one=AsyncMock(return_value=None),
            count_documents=AsyncMock(return_value=50),
            insert_one=AsyncMock(),
        )

        with (
            patch(
                "app.services.guests.get_event_by_id",
                AsyncMock(return_value=event),
            ),
            patch(
                "app.services.guests.get_user_by_id",
                AsyncMock(return_value=SimpleNamespace(tier=UserTier.FREE)),
            ),
            patch("app.services.guests.get_collection", return_value=collection),
        ):
            with self.assertRaises(HTTPException) as raised:
                await register_guest_self(EVENT_ID, "At Capacity")

        self.assertEqual(raised.exception.status_code, 402)
        self.assertIn("50 guests", str(raised.exception.detail))
        collection.insert_one.assert_not_awaited()

    async def test_draft_invitation_rejects_guest_registration(self) -> None:
        event = SimpleNamespace(
            owner_id=OWNER_ID,
            require_rsvp_approval=True,
            design_status=EventDesignStatus.DRAFT,
        )
        collection = SimpleNamespace(find_one=AsyncMock(return_value=None), insert_one=AsyncMock())

        with (
            patch("app.services.guests.get_event_by_id", AsyncMock(return_value=event)),
            patch("app.services.guests.get_collection", return_value=collection),
        ):
            with self.assertRaises(HTTPException) as raised:
                await register_guest_self(EVENT_ID, "Draft Guest")

        self.assertEqual(raised.exception.status_code, 409)
        self.assertIn("still a draft", str(raised.exception.detail))
        collection.insert_one.assert_not_awaited()


if __name__ == "__main__":
    unittest.main()
