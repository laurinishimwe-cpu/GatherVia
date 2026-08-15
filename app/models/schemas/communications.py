from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, EmailStr, Field, field_validator


class CommunicationChannel(StrEnum):
    """Delivery channels supported by flyer distribution endpoints."""

    EMAIL = "email"
    WHATSAPP = "whatsapp"


class AdminShareLinkRequest(BaseModel):
    """Create a unique share link for an event and its owner."""

    event_id: str = Field(..., min_length=1)
    link_label: str = Field(default="admin", min_length=1, max_length=64)


class AdminAccessRequest(BaseModel):
    """Public request for scanner access from a doorman/admin."""

    admin_name: str = Field(..., min_length=1, max_length=64)


class AdminRsvpContextResponse(BaseModel):
    """Public event context for the admin access request form."""

    event_id: str
    event_title: str


class EventPublicLinksResponse(BaseModel):
    """Canonical website URLs for an event, generated only by the backend."""

    event_id: str
    invite_url: str
    admin_rsvp_url: str


class AdminActivityEntry(BaseModel):
    """Single movement logged by a scanner admin."""

    timestamp: datetime
    status: str
    door_id: str
    action: str = "unknown"
    outcome: str = "allowed"
    severity: str = "info"
    lookup_method: str = "qr"
    reason: str | None = None
    guest_id: str
    guest_name: str
    guest_category: str


class AdminActivitySummary(BaseModel):
    """Aggregated scanner activity for an admin link."""

    scanned_in: int = 0
    scanned_out: int = 0
    denied: int = 0
    duplicate_denied: int = 0
    logs: list[AdminActivityEntry] = Field(default_factory=list)


class AdminShareLinkResponse(BaseModel):
    """Unique share link metadata returned to an admin."""

    id: str
    user_id: str
    event_id: str
    link_label: str
    share_token: str
    share_url: str
    enabled: bool = Field(default=True)
    pin_enabled: bool = Field(default=False)
    pin_code: str | None = None
    activity: AdminActivitySummary = Field(default_factory=AdminActivitySummary)
    created_at: datetime


class AdminPinUpdateRequest(BaseModel):
    """Enable or disable an optional scanner PIN for an admin link."""

    pin_enabled: bool = Field(default=False)
    pin_code: str | None = Field(default=None, min_length=4, max_length=12)


class FlyerEmailSendRequest(BaseModel):
    """Email-based flyer send request."""

    event_id: str = Field(..., min_length=1)
    flyer_id: str = Field(..., min_length=1)
    recipient_email: EmailStr
    recipient_name: str = Field(..., min_length=1, max_length=200)
    subject: str | None = Field(default=None, max_length=200)
    message: str | None = Field(default=None, max_length=2000)


class FlyerWhatsAppSendRequest(BaseModel):
    """WhatsApp-based flyer send request."""

    event_id: str = Field(..., min_length=1)
    flyer_id: str = Field(..., min_length=1)
    recipient_phone: str = Field(..., min_length=5, max_length=32)
    recipient_name: str = Field(..., min_length=1, max_length=200)
    message: str | None = Field(default=None, max_length=2000)

    @field_validator("recipient_phone")
    @classmethod
    def normalize_phone(cls, value: str) -> str:
        phone = value.strip()
        if len(phone) < 5:
            raise ValueError("recipient_phone must include a valid phone number.")
        return phone


class FlyerDispatchResponse(BaseModel):
    """Delivery acknowledgement for email and WhatsApp flyer sends."""

    id: str
    channel: CommunicationChannel
    status: str
    provider_ready: bool
    event_id: str
    flyer_id: str
    recipient_name: str
    recipient_contact: str
    share_token: str
    share_url: str
    created_at: datetime
