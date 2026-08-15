from datetime import date, datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.base import MongoModel, ObjectIdStr, utc_now
from app.services.invitation_rendering.font_registry import normalize_font_family


class QrBounds(MongoModel):
    """Pixel coordinates relative to the uploaded flyer image origin."""

    x: float = Field(..., ge=0, description="Horizontal offset from the image left edge.")
    y: float = Field(..., ge=0, description="Vertical offset from the image top edge.")
    width: float = Field(..., gt=0, description="QR badge width in image pixels.")
    height: float = Field(..., gt=0, description="QR badge height in image pixels.")


class QrVisibility(StrEnum):
    """Visibility state for the QR badge overlay."""

    VISIBLE = "visible"
    HIDDEN = "hidden"


class FlyerConfiguration(MongoModel):
    """Styling and placement configuration for a custom event flyer."""

    canvas_background_color: str = Field(
        default="#f0fdfa",
        description="Background color behind the flyer preview canvas.",
    )
    qr_foreground_color: str = Field(
        default="#0d9488",
        pattern=r"^#(?:[0-9a-fA-F]{3}){1,2}$",
        description="Foreground color used when rendering the QR badge.",
    )
    qr_background_color: str = Field(
        default="#ffffff",
        pattern=r"^#(?:[0-9a-fA-F]{3}){1,2}$",
        description="Background color used behind the QR badge when it is not transparent.",
    )
    qr_background_transparent: bool = Field(
        default=False,
        description="Whether the QR badge background should be transparent.",
    )
    qr_visibility: QrVisibility = Field(
        default=QrVisibility.VISIBLE,
        description="Whether the QR badge is rendered on the exported flyer.",
    )
    qr_bounds: QrBounds = Field(
        ...,
        description="Placement rectangle for the QR badge on the uploaded flyer.",
    )
    image_width: int = Field(..., gt=0, description="Natural pixel width of the flyer image.")
    image_height: int = Field(..., gt=0, description="Natural pixel height of the flyer image.")
    
    use_ticket_stub: bool = Field(
        default=True,
        description="Whether to segment invitation layout using 2/3 and 1/3 stubs."
    )
    stub_background_color: str = Field(
        default="#1e293b",
    )
    stub_text_color: str = Field(
        default="#ffffff",
    )
    stub_accent_color: str = Field(
        default="#3A7E94",
    )
    stub_qr_right: float = Field(default=7, ge=0, le=100)
    stub_qr_bottom: float = Field(default=10, ge=0, le=100)
    stub_qr_size: float = Field(default=30, gt=0, le=100)
    stub_guest_info_top: float = Field(default=26, ge=0, le=100)
    stub_guest_info_left: float = Field(default=8.75, ge=0, le=60)
    stub_guest_name_mode: str = Field(default="first", pattern=r"^(first|full)$")
    stub_guest_font_family: str = Field(default="Inter")
    stub_guest_font_weight: str = Field(default="bold")
    stub_guest_font_style: str = Field(default="normal")
    stub_guest_name_font_size: float = Field(default=22, ge=12, le=48)
    stub_show_event_date: bool = Field(default=True)
    stub_show_event_time: bool = Field(default=True)
    stub_show_event_location: bool = Field(default=True)
    stub_event_details_icon_color: str = Field(default="#3A7E94", pattern=r"^#(?:[0-9a-fA-F]{3}){1,2}$")
    stub_event_details_top: float = Field(default=58, ge=0, le=100)
    stub_event_details_left: float = Field(default=8.75, ge=0, le=100)
    stub_show_guest_category: bool = Field(default=True)
    stub_curve_shadow_color: str = Field(default="#000000", pattern=r"^#(?:[0-9a-fA-F]{3}){1,2}$")
    stub_curve_shadow_opacity: float = Field(default=50, ge=0, le=100)
    stub_curve_shadow_blur: float = Field(default=16, ge=0, le=80)
    stub_curve_shadow_offset: float = Field(default=8, ge=-40, le=80)
    artboard_stroke_color: str = Field(default="#000000", pattern=r"^#(?:[0-9a-fA-F]{3}){1,2}$")
    artboard_stroke_width: int = Field(default=1, ge=0, le=20)

    @field_validator("stub_guest_font_family", mode="before")
    @classmethod
    def normalize_stub_font_family(cls, value: object) -> str:
        return normalize_font_family(value)



class FlyerRecord(MongoModel):
    """Persisted flyer asset and styling configuration."""

    id: ObjectIdStr | None = Field(default=None, alias="_id")
    owner_id: ObjectIdStr = Field(..., description="User who uploaded the flyer.")
    event_id: ObjectIdStr | None = Field(
        default=None,
        description="Optional linked event once setup is finalized.",
    )
    image_filename: str = Field(..., description="Stored filename for the uploaded asset.")
    image_url: str = Field(..., description="Public URL path to retrieve the flyer image.")
    storage_provider: str = Field(
        default="local",
        description="Storage backend used to persist the flyer asset.",
    )
    storage_bucket: str | None = Field(
        default=None,
        description="Bucket used by the active storage provider.",
    )
    storage_path: str | None = Field(
        default=None,
        description="Object path used within the storage backend.",
    )
    configuration: FlyerConfiguration = Field(
        ...,
        description="Canvas styling and QR placement configuration.",
    )
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class FlyerConfigurationUpdate(BaseModel):
    """Partial update payload for flyer styling and QR placement."""

    model_config = ConfigDict(str_strip_whitespace=True)

    canvas_background_color: str | None = Field(default=None)
    qr_foreground_color: str | None = Field(default=None)
    qr_background_color: str | None = Field(default=None)
    qr_background_transparent: bool | None = Field(default=None)
    qr_visibility: QrVisibility | None = Field(default=None)
    qr_bounds: QrBounds | None = Field(default=None)
    image_width: int | None = Field(default=None, gt=0)
    image_height: int | None = Field(default=None, gt=0)
    use_ticket_stub: bool | None = None
    stub_background_color: str | None = None
    stub_text_color: str | None = None
    stub_accent_color: str | None = None
    stub_qr_right: float | None = Field(default=None, ge=0, le=100)
    stub_qr_bottom: float | None = Field(default=None, ge=0, le=100)
    stub_qr_size: float | None = Field(default=None, gt=0, le=100)
    stub_guest_info_top: float | None = Field(default=None, ge=0, le=100)
    stub_guest_info_left: float | None = Field(default=None, ge=0, le=60)
    stub_guest_name_mode: str | None = Field(default=None, pattern=r"^(first|full)$")
    stub_guest_font_family: str | None = None
    stub_guest_font_weight: str | None = None
    stub_guest_font_style: str | None = None
    stub_guest_name_font_size: float | None = Field(default=None, ge=12, le=48)
    stub_show_event_date: bool | None = None
    stub_show_event_time: bool | None = None
    stub_show_event_location: bool | None = None
    stub_event_details_icon_color: str | None = None
    stub_event_details_top: float | None = Field(default=None, ge=0, le=100)
    stub_event_details_left: float | None = Field(default=None, ge=0, le=100)
    stub_show_guest_category: bool | None = None
    stub_curve_shadow_color: str | None = None
    stub_curve_shadow_opacity: float | None = Field(default=None, ge=0, le=100)
    stub_curve_shadow_blur: float | None = Field(default=None, ge=0, le=80)
    stub_curve_shadow_offset: float | None = Field(default=None, ge=-40, le=80)
    artboard_stroke_color: str | None = None
    artboard_stroke_width: int | None = None

    @field_validator("stub_guest_font_family", mode="before")
    @classmethod
    def normalize_stub_font_family(cls, value: object) -> str | None:
        if value is None:
            return None
        return normalize_font_family(value)


class SetupCompleteRequest(BaseModel):
    """Finalize onboarding by linking flyer config, capacity, and event metadata."""

    flyer_id: str = Field(..., description="Configured flyer identifier.")
    guest_capacity: int = Field(..., ge=1, le=5000)
    event_title: str = Field(..., min_length=1, max_length=300)
    event_type: str = Field(default="corporate")
    event_date: date = Field(...)


class SetupCompleteResponse(BaseModel):
    """Response after setup flow completes."""

    event_id: str
    flyer_id: str
    tier: str
    total_price: float
    guest_capacity: int
