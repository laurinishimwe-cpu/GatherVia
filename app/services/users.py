from datetime import date, datetime
from typing import Any

from bson import ObjectId

from app.core.database import get_collection
from app.models.base import utc_now
from app.core.security import hash_password, verify_and_update_password, verify_password
from app.models.event import Event
from app.models.user import (
    AuthProvider,
    SupportedLanguage,
    User,
    UserTier,
    UserTierSource,
    UserTierStatus,
    UserTierStore,
)
from app.services.slug_utils import build_event_slug

EVENTS_COLLECTION = "events"
USERS_COLLECTION = "users"


def _serialize_user(document: dict[str, Any]) -> User:
    document["_id"] = str(document["_id"])

    raw_providers = document.get("auth_providers")
    if isinstance(raw_providers, list):
        document["auth_providers"] = [
            AuthProvider(p) if isinstance(p, str) else p
            for p in raw_providers
        ]

    if "auth_provider" in document and isinstance(document["auth_provider"], str):
        document["auth_provider"] = AuthProvider(document["auth_provider"])
    return User.model_validate(document)


def _get_providers(user: User) -> list[str]:
    """
    Return a list of provider strings for the user.
    Handles both AuthProvider enum members and raw strings that may exist in the DB.
    """
    providers: list[str] = []
    for p in user.auth_providers or []:
        if isinstance(p, AuthProvider):
            providers.append(p.value)
        elif isinstance(p, str):
            providers.append(p)
    if not providers and user.auth_provider:
        if isinstance(user.auth_provider, AuthProvider):
            providers.append(user.auth_provider.value)
        elif isinstance(user.auth_provider, str):
            providers.append(user.auth_provider)
    return providers


async def get_user_by_email(email: str) -> User | None:
    document = await get_collection(USERS_COLLECTION).find_one({"email": email.lower()})
    if document is None:
        return None
    return _serialize_user(document)


async def get_user_by_id(user_id: str) -> User | None:
    if not ObjectId.is_valid(user_id):
        return None
    document = await get_collection(USERS_COLLECTION).find_one({"_id": ObjectId(user_id)})
    if document is None:
        return None
    return _serialize_user(document)


async def create_user(
    *,
    email: str,
    full_name: str,
    auth_provider: AuthProvider,
    hashed_password: str | None = None,
    tier: UserTier = UserTier.FREE,
    tier_source: UserTierSource = UserTierSource.DEFAULT,
    preferred_language: SupportedLanguage | None = None,
) -> User:
    if tier != UserTier.FREE and tier_source != UserTierSource.MOBILE_IAP:
        raise ValueError("Paid tiers require a verified mobile IAP entitlement.")

    payload = {
        "email": email.lower(),
        "full_name": full_name.strip(),
        "auth_provider": auth_provider.value,
        "auth_providers": [auth_provider.value], 
        "hashed_password": hashed_password,
        "tier": tier.value,
        "tier_source": tier_source.value,
        "tier_status": UserTierStatus.FREE.value,
        "tier_auto_renews": False,
        "preferred_language": preferred_language.value if preferred_language else None,
        "language_selected_at": None,
    }
    result = await get_collection(USERS_COLLECTION).insert_one(payload)
    document = await get_collection(USERS_COLLECTION).find_one({"_id": result.inserted_id})
    assert document is not None
    return _serialize_user(document)


async def authenticate_manual_user(email: str, password: str) -> User | None:
    user = await get_user_by_email(email)
    if not user or not user.hashed_password:
        return None
    # Manual must be in the providers list
    if AuthProvider.MANUAL.value not in _get_providers(user):
        return None
    verified, replacement_hash = verify_and_update_password(password, user.hashed_password)
    if not verified:
        return None
    if replacement_hash:
        await get_collection(USERS_COLLECTION).update_one(
            {"_id": ObjectId(user.id)},
            {"$set": {"hashed_password": replacement_hash}},
        )
    return user


async def upsert_sso_user(email: str, full_name: str, auth_provider: AuthProvider) -> User:
    email = email.lower()
    existing = await get_user_by_email(email)

    if existing:
        providers = _get_providers(existing)
        if auth_provider.value not in providers:
            providers.append(auth_provider.value)
            await get_collection(USERS_COLLECTION).update_one(
                {"_id": ObjectId(existing.id)},
                {"$set": {"auth_providers": providers}},
            )
        # Update full_name if it's still the default or empty
        if not existing.full_name or existing.full_name.strip() == "" or existing.full_name == "Google User":
            await get_collection(USERS_COLLECTION).update_one(
                {"_id": ObjectId(existing.id)},
                {"$set": {"full_name": full_name.strip()}},
            )
        return await get_user_by_id(existing.id)

    # New user
    return await create_user(
        email=email,
        full_name=full_name,
        auth_provider=auth_provider,
        hashed_password=None,
    )


async def update_user_tier(
    user_id: str,
    tier: UserTier,
    *,
    source: UserTierSource,
    expires_at: datetime | None = None,
    started_at: datetime | None = None,
    product_id: str | None = None,
    store: UserTierStore | None = None,
    auto_renews: bool = False,
    tier_status: UserTierStatus | None = None,
) -> User | None:
    if tier != UserTier.FREE and source != UserTierSource.MOBILE_IAP:
        raise ValueError("Paid tiers require a verified mobile IAP entitlement.")
    if tier != UserTier.FREE and (expires_at is None or expires_at <= utc_now()):
        raise ValueError("Paid tiers require a future entitlement expiration.")
    if not ObjectId.is_valid(user_id):
        return None

    effective_source = source if tier != UserTier.FREE else UserTierSource.DEFAULT
    effective_status = tier_status or (
        UserTierStatus.ACTIVE if tier != UserTier.FREE else UserTierStatus.FREE
    )
    await get_collection(USERS_COLLECTION).update_one(
        {"_id": ObjectId(user_id)},
        {
            "$set": {
                "tier": tier.value,
                "tier_source": effective_source.value,
                "tier_status": effective_status.value,
                "tier_started_at": started_at,
                "tier_expires_at": expires_at,
                "tier_product_id": product_id,
                "tier_store": store.value if store else None,
                "tier_auto_renews": auto_renews if tier != UserTier.FREE else False,
                "tier_updated_at": utc_now(),
            }
        },
    )
    return await get_user_by_id(user_id)


async def register_manual_user(email: str, password: str, full_name: str) -> User:
    email = email.lower()
    existing = await get_user_by_email(email)

    if existing:
        # If the user already has a password, reject (duplicate account)
        if existing.hashed_password is not None:
            raise ValueError("An account with this email already exists.")

        # This user previously signed up via OAuth only – add manual login
        providers = _get_providers(existing)
        if AuthProvider.MANUAL.value not in providers:
            providers.append(AuthProvider.MANUAL.value)

        await get_collection(USERS_COLLECTION).update_one(
            {"_id": ObjectId(existing.id)},
            {
                "$set": {
                    "hashed_password": hash_password(password),
                    "auth_providers": providers,
                }
            },
        )
        # Optionally update the full_name if it was empty
        if not existing.full_name or existing.full_name.strip() == "":
            await get_collection(USERS_COLLECTION).update_one(
                {"_id": ObjectId(existing.id)},
                {"$set": {"full_name": full_name.strip()}},
            )
        return await get_user_by_id(existing.id)

    # No existing user – create a fresh manual account
    return await create_user(
        email=email,
        full_name=full_name,
        auth_provider=AuthProvider.MANUAL,
        hashed_password=hash_password(password),
    )


async def set_user_language(user_id: str, language: SupportedLanguage) -> User | None:
    if not ObjectId.is_valid(user_id):
        return None
    await get_collection(USERS_COLLECTION).update_one(
        {"_id": ObjectId(user_id)},
        {
            "$set": {
                "preferred_language": language.value,
                "language_selected_at": utc_now(),
            }
        },
    )
    return await get_user_by_id(user_id)


async def get_user_event_history(user_id: str, limit: int = 10) -> list[Event]:
    if not ObjectId.is_valid(user_id):
        return []

    cursor = (
        get_collection(EVENTS_COLLECTION)
        # Early event records used a string owner id. Include both formats so
        # existing events continue to appear in the dashboard after upgrades.
        .find({"owner_id": {"$in": [ObjectId(user_id), user_id]}})
        .sort("created_at", -1)
        .limit(limit)
    )

    history: list[Event] = []
    async for document in cursor:
        document["_id"] = str(document["_id"])
        document["owner_id"] = str(document["owner_id"])
        if not document.get("slug"):
            event_date = document.get("event_date")
            if isinstance(event_date, str):
                event_date = date.fromisoformat(event_date)
            if isinstance(event_date, date):
                base_slug = build_event_slug(str(document.get("title", "event")), event_date)
                slug = base_slug
                counter = 2
                while await get_collection(EVENTS_COLLECTION).find_one(
                    {"slug": slug, "_id": {"$ne": ObjectId(document["_id"])}}
                ) is not None:
                    slug = f"{base_slug}-{counter}"
                    counter += 1
                document["slug"] = slug
                await get_collection(EVENTS_COLLECTION).update_one(
                    {"_id": ObjectId(document["_id"])},
                    {"$set": {"slug": slug}},
                )
        history.append(Event.model_validate(document))
    return history

async def update_user_profile(user_id: str, full_name: str) -> User | None:
    if not ObjectId.is_valid(user_id):
        return None
    await get_collection(USERS_COLLECTION).update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"full_name": full_name.strip()}},
    )
    return await get_user_by_id(user_id)

async def change_user_password(
    user_id: str,
    current_password: str | None,
    new_password: str,
) -> None:
    user = await get_user_by_id(user_id)
    if user is None:
        raise ValueError("User not found.")

    if user.hashed_password and (
        not current_password or not verify_password(current_password, user.hashed_password)
    ):
        raise ValueError("Current password is incorrect.")

    providers = _get_providers(user)
    if AuthProvider.MANUAL.value not in providers:
        providers.append(AuthProvider.MANUAL.value)

    await get_collection(USERS_COLLECTION).update_one(
        {"_id": ObjectId(user_id)},
        {
            "$set": {
                "hashed_password": hash_password(new_password),
                "auth_providers": providers,
            }
        },
    )
