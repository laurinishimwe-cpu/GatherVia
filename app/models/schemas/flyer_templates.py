from enum import StrEnum

from pydantic import BaseModel, Field

from app.models.canvas import CanvasLayer
from app.models.event import EventType
from app.models.flyer import FlyerConfiguration


class TemplateCategory(StrEnum):
    WEDDING = "wedding"
    CORPORATE = "corporate"
    BIRTHDAY = "birthday"
    PARTY = "party"
    CONFERENCE = "conference"
    GALA="gala"
    OTHER="other"


class FlyerTemplate(BaseModel):
    """Backend-controlled starter flyer template for the canvas workflow."""

    id: str = Field(
        ...,
        min_length=1,
        max_length=120,
        description="Stable template identifier.",
    )

    title: str = Field(
        ...,
        min_length=1,
        max_length=120,
        description="Public template name.",
    )

    category: TemplateCategory = Field(
        ...,
        description="Gallery category used to group the template.",
    )

    event_type: EventType = Field(
        ...,
        description="Event type created when this template is selected.",
    )

    description: str = Field(
        ...,
        min_length=1,
        max_length=240,
    )

    headline: str = Field(
        ...,
        min_length=1,
        max_length=120,
    )

    subheadline: str = Field(
        ...,
        min_length=1,
        max_length=180,
    )

    accent_color: str = Field(
        ...,
        pattern=r"^#(?:[0-9a-fA-F]{3}){1,2}$",
        description="Primary accent colour.",
    )

    canvas_background_color: str = Field(
        ...,
        pattern=r"^#(?:[0-9a-fA-F]{3}){1,2}$",
        description="Base flyer background colour.",
    )

    qr_foreground_color: str = Field(
        ...,
        pattern=r"^#(?:[0-9a-fA-F]{3}){1,2}$",
        description="QR foreground colour.",
    )

    qr_background_color: str = Field(
        ...,
        pattern=r"^#(?:[0-9a-fA-F]{3}){1,2}$",
        description="QR background colour.",
    )

    qr_background_transparent: bool = Field(
        default=False,
        description="Whether the QR background is transparent.",
    )

    configuration: FlyerConfiguration | None = Field(
        default=None,
        description="Complete flyer and ticket-stub configuration.",
    )

    layers: list[CanvasLayer] = Field(
        default_factory=list,
        description="Editable design layers belonging to the template.",
    )
