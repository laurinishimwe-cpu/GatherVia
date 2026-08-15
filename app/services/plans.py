from datetime import UTC, datetime
from typing import Any
from urllib.parse import quote

import httpx
from bson import ObjectId

from app.core.config import settings
from app.core.database import get_collection
from app.models.schemas.plans import (
    PlanAvailability,
    PlanCatalogItem,
    PlanCatalogResponse,
    RevenueCatWebhookEvent,
    SubscriptionStatusResponse,
)
from app.models.user import (
    User,
    UserTier,
    UserTierSource,
    UserTierStatus,
    UserTierStore,
)
from app.services.users import USERS_COLLECTION, get_user_by_id, update_user_tier


REVENUECAT_WEBHOOK_EVENTS_COLLECTION = "revenuecat_webhook_events"
PLAN_GUEST_LIMITS: dict[UserTier, int] = {
    UserTier.FREE: 50,
    UserTier.BASIC: 150,
    UserTier.PRO: 500,
}
PLAN_CATALOG: tuple[PlanCatalogItem, ...] = (
    PlanCatalogItem(
        tier=UserTier.FREE,
        name="Free",
        guest_limit=50,
        description="Included for every event. No purchase required.",
    ),
    PlanCatalogItem(
        tier=UserTier.BASIC,
        name="Basic",
        guest_limit=150,
        description="A monthly plan for growing guest lists.",
    ),
    PlanCatalogItem(
        tier=UserTier.PRO,
        name="Pro",
        guest_limit=500,
        description="A monthly plan for large events and teams.",
    ),
)


class RevenueCatConfigurationError(RuntimeError):
    pass


class RevenueCatSyncError(RuntimeError):
    pass


def get_plan_availability() -> PlanAvailability:
    return PlanAvailability(
        google_play=settings.google_play_plans_enabled,
        app_store=settings.app_store_plans_enabled,
    )


def get_plan_catalog() -> PlanCatalogResponse:
    return PlanCatalogResponse(
        plans=list(PLAN_CATALOG),
        availability=get_plan_availability(),
    )


def get_subscription_status(user: User) -> SubscriptionStatusResponse:
    tier = UserTier(user.tier)
    active = tier != UserTier.FREE
    return SubscriptionStatusResponse(
        tier=tier,
        guest_limit=PLAN_GUEST_LIMITS[tier],
        active=active,
        status=UserTierStatus(user.tier_status),
        billing_period="P1M" if active else None,
        started_at=user.tier_started_at,
        expires_at=user.tier_expires_at,
        product_id=user.tier_product_id,
        store=UserTierStore(user.tier_store) if user.tier_store else None,
        auto_renews=user.tier_auto_renews if active else False,
        availability=get_plan_availability(),
    )


def _parse_revenuecat_datetime(value: object) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def _store_from_revenuecat(value: object) -> UserTierStore | None:
    normalized = str(value or "").lower()
    if normalized in {"play_store", "google_play", "google"}:
        return UserTierStore.GOOGLE_PLAY
    if normalized in {"app_store", "apple", "mac_app_store"}:
        return UserTierStore.APP_STORE
    return None


def _select_active_entitlement(
    subscriber: dict[str, Any],
) -> tuple[UserTier, str, dict[str, Any], datetime] | None:
    entitlements = subscriber.get("entitlements")
    if not isinstance(entitlements, dict):
        return None

    candidates = (
        (UserTier.PRO, settings.revenuecat_pro_entitlement_id),
        (UserTier.BASIC, settings.revenuecat_basic_entitlement_id),
    )
    now = datetime.now(UTC)
    for tier, entitlement_id in candidates:
        entitlement = entitlements.get(entitlement_id)
        if not isinstance(entitlement, dict):
            continue
        expires_at = _parse_revenuecat_datetime(entitlement.get("expires_date"))
        if expires_at is not None and expires_at > now:
            return tier, entitlement_id, entitlement, expires_at
    return None


async def _fetch_revenuecat_subscriber(user_id: str) -> dict[str, Any]:
    if not settings.revenuecat_secret_api_key:
        raise RevenueCatConfigurationError("RevenueCat backend sync is not configured.")

    url = f"https://api.revenuecat.com/v1/subscribers/{quote(user_id, safe='')}"
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(
            url,
            headers={
                "Authorization": f"Bearer {settings.revenuecat_secret_api_key}",
                "Accept": "application/json",
            },
        )

    if response.status_code == 404:
        return {}
    try:
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise RevenueCatSyncError(
            f"RevenueCat subscriber sync failed with status {response.status_code}."
        ) from exc

    payload = response.json()
    subscriber = payload.get("subscriber")
    return subscriber if isinstance(subscriber, dict) else {}


async def sync_subscription_from_revenuecat(user_id: str) -> User:
    user = await get_user_by_id(user_id)
    if user is None:
        raise ValueError("User not found.")

    subscriber = await _fetch_revenuecat_subscriber(user_id)
    selected = _select_active_entitlement(subscriber)
    if selected is None:
        had_paid_history = Boolean(user.tier_product_id) or user.tier_status not in {
            UserTierStatus.FREE,
        }
        updated = await update_user_tier(
            user_id,
            UserTier.FREE,
            source=UserTierSource.DEFAULT,
            tier_status=(
                UserTierStatus.EXPIRED
                if had_paid_history
                else UserTierStatus.FREE
            ),
        )
        if updated is None:
            raise ValueError("User not found.")
        return updated

    tier, _, entitlement, expires_at = selected
    product_id = entitlement.get("product_identifier")
    subscriptions = subscriber.get("subscriptions")
    subscription = (
        subscriptions.get(product_id, {})
        if isinstance(subscriptions, dict) and isinstance(product_id, str)
        else {}
    )
    if not isinstance(subscription, dict):
        subscription = {}

    cancelled = subscription.get("unsubscribe_detected_at") is not None
    billing_issue = subscription.get("billing_issues_detected_at") is not None
    tier_status = (
        UserTierStatus.BILLING_ISSUE
        if billing_issue
        else UserTierStatus.CANCELLED
        if cancelled
        else UserTierStatus.ACTIVE
    )
    updated = await update_user_tier(
        user_id,
        tier,
        source=UserTierSource.MOBILE_IAP,
        expires_at=expires_at,
        started_at=_parse_revenuecat_datetime(entitlement.get("purchase_date")),
        product_id=product_id if isinstance(product_id, str) else None,
        store=_store_from_revenuecat(subscription.get("store")),
        auto_renews=not cancelled,
        tier_status=tier_status,
    )
    if updated is None:
        raise ValueError("User not found.")
    return updated


def _event_user_ids(event: RevenueCatWebhookEvent) -> list[str]:
    candidates = [
        event.app_user_id,
        event.original_app_user_id,
        *event.aliases,
        *event.transferred_from,
        *event.transferred_to,
    ]
    return list(dict.fromkeys(value for value in candidates if value and ObjectId.is_valid(value)))


async def process_revenuecat_webhook(event: RevenueCatWebhookEvent) -> bool:
    collection = get_collection(REVENUECAT_WEBHOOK_EVENTS_COLLECTION)
    existing = await collection.find_one({"_id": event.id})
    if existing and existing.get("status") == "processed":
        return True

    await collection.update_one(
        {"_id": event.id},
        {
            "$set": {
                "event_type": event.type,
                "status": "processing",
                "received_at": datetime.now(UTC),
            }
        },
        upsert=True,
    )

    try:
        for user_id in _event_user_ids(event):
            await sync_subscription_from_revenuecat(user_id)
        await collection.update_one(
            {"_id": event.id},
            {"$set": {"status": "processed", "processed_at": datetime.now(UTC)}},
        )
    except Exception as exc:
        await collection.update_one(
            {"_id": event.id},
            {
                "$set": {
                    "status": "failed",
                    "failed_at": datetime.now(UTC),
                    "error": str(exc)[:500],
                }
            },
        )
        raise
    return False
