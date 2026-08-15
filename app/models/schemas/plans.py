from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.models.user import UserTier, UserTierStatus, UserTierStore


class PlanAvailability(BaseModel):
    google_play: bool
    app_store: bool


class PlanCatalogItem(BaseModel):
    tier: UserTier
    name: str
    guest_limit: int
    billing_period: str = "P1M"
    description: str


class PlanCatalogResponse(BaseModel):
    plans: list[PlanCatalogItem]
    availability: PlanAvailability


class SubscriptionStatusResponse(BaseModel):
    tier: UserTier
    guest_limit: int
    active: bool
    status: UserTierStatus
    billing_period: str | None = None
    started_at: datetime | None = None
    expires_at: datetime | None = None
    product_id: str | None = None
    store: UserTierStore | None = None
    auto_renews: bool = False
    availability: PlanAvailability


class RevenueCatWebhookEvent(BaseModel):
    id: str = Field(..., min_length=1)
    type: str = Field(..., min_length=1)
    app_user_id: str | None = None
    original_app_user_id: str | None = None
    aliases: list[str] = Field(default_factory=list)
    product_id: str | None = None
    store: str | None = None
    expiration_at_ms: int | None = None
    entitlement_ids: list[str] = Field(default_factory=list)
    transferred_from: list[str] = Field(default_factory=list)
    transferred_to: list[str] = Field(default_factory=list)


class RevenueCatWebhookRequest(BaseModel):
    api_version: str | None = None
    event: RevenueCatWebhookEvent
    raw_payload: dict[str, Any] = Field(default_factory=dict, exclude=True)


class WebhookAcceptedResponse(BaseModel):
    status: str
    duplicate: bool = False
