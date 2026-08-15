from datetime import date, datetime, time
from enum import StrEnum

from pydantic import ConfigDict, Field, field_validator

from app.models.base import MongoModel, ObjectIdStr, utc_now
from app.models.canvas import CanvasLayer


class EventType(StrEnum):
    """High-level classification used to drive event-specific workflows and wording."""

    MARRIAGE = "marriage"
    CORPORATE = "corporate"
    PRIVATE = "private"
    CONFERENCE = "conference"
    GALA = "gala"
    OTHER = "other"


class EventDesignStatus(StrEnum):
    """Lifecycle state for an event invitation design."""

    DRAFT = "draft"
    PUBLISHED = "published"


class WordingDictionary(MongoModel):
    """Per-event UI labels that adapt terminology to the event context."""

    model_config = ConfigDict(extra="allow")

    guest_label_singular: str = Field(
        default="Guest",
        min_length=1,
        max_length=80,
        description="Singular label for attendees (e.g. 'Guest', 'Client', 'Delegate').",
    )
    guest_label_plural: str = Field(
        default="Guests",
        min_length=1,
        max_length=80,
        description="Plural label for attendees (e.g. 'Guests', 'Clients').",
    )


class EventConfiguration(MongoModel):
    """Event-level settings controlling localization, wording, and staff permissions."""

    ui_language: str = Field(
        default="en",
        min_length=2,
        max_length=10,
        pattern=r"^[a-z]{2}(-[A-Z]{2})?$",
        description="Default BCP-47 language code for the event UI (e.g. 'en', 'fr-CA').",
    )
    wording_dictionary: WordingDictionary = Field(
        default_factory=WordingDictionary,
        description="Dynamic label overrides tailored to the event type and audience.",
    )
    allowed_admin_fields: list[str] = Field(
        default_factory=lambda: ["name", "category"],
        description=(
            "Guest property keys that event staff (e.g. doormen) are permitted to view. "
            "Examples: 'name', 'seat_assignment', 'category'."
        ),
    )
    invitation_categories_enabled: bool = Field(
        default=True,
        description="Whether generated guest passes show a category badge.",
    )
    invitation_categories: list[str] = Field(
        default_factory=lambda: ["General", "VIP"],
        description="Short labels available when generating a guest pass.",
    )

    @field_validator("allowed_admin_fields")
    @classmethod
    def validate_allowed_admin_fields(cls, value: list[str]) -> list[str]:
        normalized = [field_name.strip() for field_name in value if field_name.strip()]
        if not normalized:
            raise ValueError("allowed_admin_fields must contain at least one field key.")
        if len(normalized) != len(set(normalized)):
            raise ValueError("allowed_admin_fields must not contain duplicate keys.")
        return normalized

    @field_validator("invitation_categories")
    @classmethod
    def validate_invitation_categories(cls, value: list[str]) -> list[str]:
        normalized = [category.strip() for category in value if category.strip()]
        if any(len(category) > 10 for category in normalized):
            raise ValueError("invitation category labels must be 10 characters or fewer.")
        return list(dict.fromkeys(normalized))


class Event(MongoModel):
    """Event owned by a platform user with flexible configuration for staff permissions."""

    id: ObjectIdStr | None = Field(
        default=None,
        alias="_id",
        description="Unique event identifier assigned by MongoDB.",
    )
    owner_id: ObjectIdStr = Field(
        ...,
        description="Identifier of the user who owns and administers this event.",
    )
    title: str = Field(
        ...,
        min_length=1,
        max_length=300,
        description="Human-readable event title shown in dashboards and invitations.",
    )
    flyer_id: ObjectIdStr | None = Field(
        default=None,
        description="Linked flyer asset used by public invitation pages.",
    )
    slug: str = Field(
        ...,
        min_length=1,
        max_length=180,
        pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$",
        description="SEO-friendly public slug for invitation pages.",
    )
    event_type: EventType = Field(
        ...,
        description="Event category that influences default wording and workflows.",
    )
    event_date: date | None = Field(
        default=None,
        description="Calendar date on which the event takes place.",
    )
    event_time: time | None = Field(
        default=None,
        description="Optional local start time shown on guest invitations.",
    )
    event_timezone: str = Field(
        default="UTC",
        min_length=1,
        max_length=64,
        description="IANA timezone in which the event date and local start time are interpreted.",
    )
    event_location: str | None = Field(
        default=None,
        max_length=160,
        description="Optional venue or address shown on guest invitations.",
    )
    design_layers: list[CanvasLayer] = Field(
        default_factory=list,
        description="User-edited design layers",
    )
    design_configuration: dict | None = Field(
        default=None,
        description="Canvas size and QR styling at lock time",
    )
    design_status: EventDesignStatus = Field(
        default=EventDesignStatus.DRAFT,
        description="Whether the invitation is still editable or has been published.",
    )
    design_published_at: datetime | None = Field(
        default=None,
        description="UTC timestamp of the most recent invitation publication.",
    )
    configuration: EventConfiguration = Field(
        default_factory=EventConfiguration,
        description="Localization, wording, and granular staff visibility settings.",
    )
    created_at: datetime = Field(
        default_factory=utc_now,
        description="UTC timestamp when the event record was created.",
    )

    require_rsvp_approval: bool = Field(
    default=True,
    description="Whether RSVP submissions need manual approval or are auto‑approved.",
    )

    @field_validator("slug")
    @classmethod
    def normalize_slug(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not normalized:
            raise ValueError("slug must not be empty.")
        return normalized
