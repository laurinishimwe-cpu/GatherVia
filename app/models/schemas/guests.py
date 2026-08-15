from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.models.event import EventType
from app.models.guest import CheckInLog, GuestStatus


class GuestQrCodeRequest(BaseModel):
    """Batch QR generation request for a setup flow."""

    event_type: EventType = Field(..., description="Event type that drives guest wording.")
    guest_capacity: int = Field(..., ge=1, le=5000)


class GuestQrCodeItem(BaseModel):
    """Single QR payload generated for a guest slot."""

    index: int
    label: str
    qr_hash: str
    qr_payload: str


class GuestQrCodeResponse(BaseModel):
    """Generated QR payloads plus the vocabulary used to label them."""

    event_type: EventType
    guest_capacity: int
    guest_label_singular: str
    guest_label_plural: str
    qr_codes: list[GuestQrCodeItem]


class GuestStaffView(BaseModel):
    """Limited guest information shown to staff after scanning a QR badge."""

    id: str
    full_name: str
    category: str
    status: GuestStatus
    custom_fields: dict[str, Any] = Field(default_factory=dict)
    check_in_logs: list[CheckInLog] = Field(default_factory=list)


class GuestOwnerView(BaseModel):
    """Owner-facing guest record used by the dashboard guest list page."""

    id: str
    full_name: str
    email: str | None = None
    phone: str | None = None
    custom_notes: str | None = None
    category: str
    status: GuestStatus
    qr_hash: str = Field(..., min_length=16)
    custom_fields: dict[str, Any] = Field(default_factory=dict)
    check_in_logs: list[CheckInLog] = Field(default_factory=list)
    created_at: datetime
    status_updated_at: datetime


class GuestScanRequest(BaseModel):
    """Resolve a QR code through a private staff access link."""

    share_token: str = Field(..., min_length=16)
    qr_hash: str = Field(..., min_length=16)
    mode: str = Field(default="in", pattern="^(in|out)$")
    pin_code: str | None = Field(default=None, max_length=12)


class GuestNameScanRequest(BaseModel):
    """Resolve a guest by normalized full name through a staff access link."""

    share_token: str = Field(..., min_length=16)
    full_name: str = Field(..., min_length=1, max_length=200)
    mode: str = Field(default="in", pattern="^(in|out)$")
    pin_code: str | None = Field(default=None, max_length=12)


class GuestScanResponse(BaseModel):
    """Limited scan result shown to doormen and admins."""

    found: bool
    accepted: bool = True
    message: str
    event_id: str
    event_title: str
    admin_label: str | None = None
    allowed_admin_fields: list[str]
    guest: GuestStaffView | None = None


class GuestScannerContextResponse(BaseModel):
    """Public context shown on a staff scanner page."""

    event_id: str
    event_title: str
    admin_label: str
    enabled: bool = True
    pin_required: bool = False


class GuestStatusUpdateRequest(BaseModel):
    """Change a guest's owner-facing lifecycle status."""

    status: GuestStatus


class GuestStaffCheckInRequest(BaseModel):
    """Approve or check in a guest using a private staff link."""

    share_token: str = Field(..., min_length=16)
    guest_id: str = Field(..., min_length=16)


class GuestListSummary(BaseModel):
    """Guest state counts used for dashboards and charts."""

    total: int
    pending: int
    approved: int
    checked_in: int
    rejected: int
    completion_rate: float


class GuestListResponse(BaseModel):
    """Owner-facing guest list payload with summary metrics."""

    event_id: str
    event_title: str
    guests: list[GuestOwnerView]
    summary: GuestListSummary
