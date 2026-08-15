import unittest
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.models.user import (
    AuthProvider,
    User,
    UserTier,
    UserTierSource,
    UserTierStatus,
    UserTierStore,
)
from app.services.plans import (
    get_plan_catalog,
    get_subscription_status,
    process_revenuecat_webhook,
    sync_subscription_from_revenuecat,
)
from app.models.schemas.plans import RevenueCatWebhookEvent


USER_ID = "507f191e810c19729de860ea"


def build_user(**overrides: object) -> User:
    values: dict[str, object] = {
        "_id": USER_ID,
        "email": "plans@example.com",
        "full_name": "Plan User",
        "auth_provider": AuthProvider.MANUAL,
    }
    values.update(overrides)
    return User.model_validate(values)


class PlanLifecycleTests(unittest.IsolatedAsyncioTestCase):
    def test_catalog_does_not_publish_paid_prices(self) -> None:
        payload = get_plan_catalog().model_dump(mode="json")

        self.assertEqual([plan["tier"] for plan in payload["plans"]], ["free", "basic", "pro"])
        self.assertTrue(all("monthly_price_usd" not in plan for plan in payload["plans"]))

    def test_status_reports_monthly_active_subscription(self) -> None:
        expires_at = datetime.now(UTC) + timedelta(days=30)
        user = build_user(
            tier=UserTier.PRO,
            tier_source=UserTierSource.MOBILE_IAP,
            tier_status=UserTierStatus.ACTIVE,
            tier_expires_at=expires_at,
            tier_store=UserTierStore.GOOGLE_PLAY,
            tier_auto_renews=True,
        )

        status = get_subscription_status(user)

        self.assertTrue(status.active)
        self.assertEqual(status.tier, UserTier.PRO)
        self.assertEqual(status.guest_limit, 500)
        self.assertEqual(status.billing_period, "P1M")
        self.assertTrue(status.auto_renews)

    async def test_sync_uses_revenuecat_entitlement_and_store_metadata(self) -> None:
        expires_at = datetime.now(UTC) + timedelta(days=30)
        subscriber = {
            "entitlements": {
                "basic": {
                    "expires_date": expires_at.isoformat(),
                    "purchase_date": datetime.now(UTC).isoformat(),
                    "product_identifier": "gathervia_basic:monthly",
                }
            },
            "subscriptions": {
                "gathervia_basic:monthly": {
                    "store": "play_store",
                    "unsubscribe_detected_at": None,
                    "billing_issues_detected_at": None,
                }
            },
        }
        updated = SimpleNamespace(id=USER_ID)

        with (
            patch(
                "app.services.plans.get_user_by_id",
                AsyncMock(return_value=build_user()),
            ),
            patch(
                "app.services.plans._fetch_revenuecat_subscriber",
                AsyncMock(return_value=subscriber),
            ),
            patch(
                "app.services.plans.update_user_tier",
                AsyncMock(return_value=updated),
            ) as update_tier,
        ):
            result = await sync_subscription_from_revenuecat(USER_ID)

        self.assertIs(result, updated)
        self.assertEqual(update_tier.await_args.args[1], UserTier.BASIC)
        self.assertEqual(update_tier.await_args.kwargs["source"], UserTierSource.MOBILE_IAP)
        self.assertEqual(update_tier.await_args.kwargs["store"], UserTierStore.GOOGLE_PLAY)
        self.assertTrue(update_tier.await_args.kwargs["auto_renews"])
        self.assertEqual(update_tier.await_args.kwargs["tier_status"], UserTierStatus.ACTIVE)

    async def test_processed_webhook_is_idempotent(self) -> None:
        collection = SimpleNamespace(
            find_one=AsyncMock(return_value={"status": "processed"}),
        )
        event = RevenueCatWebhookEvent(id="event-1", type="RENEWAL", app_user_id=USER_ID)

        with patch("app.services.plans.get_collection", return_value=collection):
            duplicate = await process_revenuecat_webhook(event)

        self.assertTrue(duplicate)


if __name__ == "__main__":
    unittest.main()
