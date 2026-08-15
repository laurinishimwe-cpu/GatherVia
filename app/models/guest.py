from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import EmailStr, Field, field_validator

from app.models.base import MongoModel, ObjectIdStr, utc_now


class GuestCategory(StrEnum):
    """Guest priority tier used for access control and reporting."""

    VIP = "VIP"
    GENERAL = "General"


class CheckInStatus(StrEnum):
    """Lifecycle status recorded during guest check-in operations."""

    CHECKED_IN = "Checked In"
    LEFT_BUILDING = "Left Building"
    RETURNED = "Returned"
    DUPLICATE_SCAN = "Duplicate Scan"


class GuestStatus(StrEnum):
    """Owner-level review and arrival state for a guest."""

    PENDING = "pending"
    CHECKED_IN = "checked_in"
    REJECTED = "rejected"


class CheckInLog(MongoModel):
    """Single check-in lifecycle entry for audit and real-time tracking."""

    timestamp: datetime = Field(
        default_factory=utc_now,
        description="UTC timestamp when the status change was recorded.",
    )
    status: CheckInStatus = Field(
        ...,
        description="Guest movement status at the recorded timestamp.",
    )
    door_id: str = Field(
        default="Unknown entrance",
        min_length=1,
        max_length=120,
        description="Identifier of the entrance or checkpoint where the event occurred.",
    )
    action: str | None = Field(
        default=None,
        max_length=60,
        description="Machine-readable scanner action such as scan_in or duplicate_denied.",
    )
    outcome: str | None = Field(
        default=None,
        max_length=40,
        description="Machine-readable scanner outcome such as allowed or denied.",
    )
    severity: str | None = Field(
        default=None,
        max_length=20,
        description="Log severity used by analytics and review screens.",
    )
    lookup_method: str | None = Field(
        default=None,
        max_length=20,
        description="How the guest was resolved, for example qr or name.",
    )
    reason: str | None = Field(
        default=None,
        max_length=200,
        description="Optional reason for denied or notable scanner actions.",
    )

    @field_validator("status", mode="before")
    @classmethod
    def normalize_legacy_check_in_status(cls, value: Any) -> Any:
        normalized = str(value).strip().lower().replace("_", " ")
        aliases = {
            "checked in": CheckInStatus.CHECKED_IN.value,
            "checked out": CheckInStatus.LEFT_BUILDING.value,
            "left building": CheckInStatus.LEFT_BUILDING.value,
            "returned": CheckInStatus.RETURNED.value,
            "duplicate scan": CheckInStatus.DUPLICATE_SCAN.value,
        }
        return aliases.get(normalized, value)


class Guest(MongoModel):
    """Event attendee with dynamic custom fields and check-in audit history."""

    id: ObjectIdStr | None = Field(
        default=None,
        alias="_id",
        description="Unique guest identifier assigned by MongoDB.",
    )
    event_id: ObjectIdStr = Field(
        ...,
        description="Identifier of the parent event this guest belongs to.",
    )
    full_name: str = Field(
        ...,
        min_length=1,
        max_length=200,
        description="Guest full name as shown on invitations and check-in screens.",
    )
    normalized_full_name: str | None = Field(
        default=None,
        max_length=200,
        description="Normalized full name used for scanner fallback lookup.",
    )
    email: EmailStr | None = Field(
        default=None,
        description="Optional contact email for notifications and RSVP follow-up.",
    )
    phone: str | None = Field(
        default=None,
        max_length=30,
        pattern=r"^\+?[0-9\s\-().]{7,30}$",
        description="Optional contact phone number in international or local format.",
    )
    custom_notes: str | None = Field(
        default=None,
        max_length=2000,
        description="Free-form internal notes visible only to authorized event admins.",
    )
    category: str = Field(
        default=GuestCategory.GENERAL.value,
        min_length=1,
        max_length=10,
        description="Guest priority category (e.g. VIP vs General admission).",
    )
    status: GuestStatus = Field(
        default=GuestStatus.PENDING,
        description="Owner-level approval state used by the dashboard and scanner.",
    )
    status_updated_at: datetime = Field(
        default_factory=utc_now,
        description="UTC timestamp when the current guest status last changed.",
    )
    custom_fields: dict[str, Any] = Field(
        default_factory=dict,
        description=(
            "Event-type-specific attributes (e.g. seat_assignment, table_number, "
            "company_name) referenced by allowed_admin_fields keys."
        ),
    )
    check_in_logs: list[CheckInLog] = Field(
        default_factory=list,
        description="Append-only audit trail of guest movements through entrances.",
    )
    qr_hash: str = Field(
        ...,
        min_length=16,
        max_length=128,
        description="Unique opaque hash embedded in the guest QR code for check-in.",
    )
    created_at: datetime = Field(
        default_factory=utc_now,
        description="UTC timestamp when the guest record was created.",
    )

    @field_validator("qr_hash")
    @classmethod
    def normalize_qr_hash(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("qr_hash must not be empty.")
        return normalized

    @field_validator("status", mode="before")
    @classmethod
    def normalize_legacy_guest_status(cls, value: Any) -> Any:
        normalized = str(value).strip().lower().replace(" ", "_")
        aliases = {
            "approved": GuestStatus.CHECKED_IN.value,
            "checked_in": GuestStatus.CHECKED_IN.value,
            "pending": GuestStatus.PENDING.value,
            "rejected": GuestStatus.REJECTED.value,
        }
        return aliases.get(normalized, value)

    @field_validator("custom_fields")
    @classmethod
    def validate_custom_fields(cls, value: dict[str, Any]) -> dict[str, Any]:
        for key in value:
            if not key.strip():
                raise ValueError("custom_fields keys must be non-empty strings.")
        return value
