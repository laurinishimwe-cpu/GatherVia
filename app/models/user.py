from datetime import UTC, datetime
from enum import StrEnum

from pydantic import EmailStr, Field, model_validator

from app.models.base import MongoModel, ObjectIdStr, utc_now


class AuthProvider(StrEnum):
    MANUAL = "manual"
    GOOGLE = "google"
    MICROSOFT = "microsoft"


class UserTier(StrEnum):
    FREE = "free"
    BASIC = "basic"
    PRO = "pro"


class UserTierSource(StrEnum):
    DEFAULT = "default"
    MOBILE_IAP = "mobile_iap"


class UserTierStatus(StrEnum):
    FREE = "free"
    ACTIVE = "active"
    CANCELLED = "cancelled"
    BILLING_ISSUE = "billing_issue"
    PAUSED = "paused"
    EXPIRED = "expired"


class UserTierStore(StrEnum):
    GOOGLE_PLAY = "google_play"
    APP_STORE = "app_store"


class SupportedLanguage(StrEnum):
    EN = "en"
    FR = "fr"
    ES = "es"
    DE = "de"


class User(MongoModel):
    id: ObjectIdStr | None = Field(default=None, alias="_id")
    email: EmailStr = Field(...)
    full_name: str = Field(..., min_length=1, max_length=200)
    auth_provider: AuthProvider = Field(
        ...,
        description="Initial authentication provider.",
    )
    auth_providers: list[AuthProvider] = Field(
        default_factory=list,
        description="All allowed authentication providers for this account.",
    )
    hashed_password: str | None = Field(
        default=None,
        description="Bcrypt password hash. Required only if manual login is allowed.",
    )
    tier: UserTier = Field(default=UserTier.FREE)
    tier_source: UserTierSource = Field(default=UserTierSource.DEFAULT)
    tier_status: UserTierStatus = Field(default=UserTierStatus.FREE)
    tier_started_at: datetime | None = Field(default=None)
    tier_expires_at: datetime | None = Field(default=None)
    tier_product_id: str | None = Field(default=None)
    tier_store: UserTierStore | None = Field(default=None)
    tier_auto_renews: bool = Field(default=False)
    preferred_language: SupportedLanguage | None = Field(default=None)
    language_selected_at: datetime | None = Field(default=None)
    created_at: datetime = Field(default_factory=utc_now)

    @model_validator(mode="after")
    def require_verified_paid_tier(self) -> "User":
        """Expose paid access only while a verified mobile entitlement is active."""
        if self.tier_expires_at is not None and self.tier_expires_at.tzinfo is None:
            self.tier_expires_at = self.tier_expires_at.replace(tzinfo=UTC)

        paid_access_is_active = (
            self.tier_source == UserTierSource.MOBILE_IAP
            and self.tier_expires_at is not None
            and self.tier_expires_at > utc_now()
        )
        if self.tier != UserTier.FREE and not paid_access_is_active:
            self.tier = UserTier.FREE
            self.tier_source = UserTierSource.DEFAULT
            if self.tier_status != UserTierStatus.FREE:
                self.tier_status = UserTierStatus.EXPIRED
            self.tier_auto_renews = False
        return self
