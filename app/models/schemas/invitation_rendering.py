from typing import Literal

from pydantic import BaseModel, Field

from app.models.canvas import CanvasLayer
from app.models.flyer import FlyerConfiguration


class InvitationGuest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    category: str = Field(default="General", max_length=40)
    qr_hash: str = Field(..., min_length=1, max_length=1000)


class InvitationEventDetails(BaseModel):
    date: str | None = Field(default=None, max_length=40)
    time: str | None = Field(default=None, max_length=20)
    location: str | None = Field(default=None, max_length=160)


class InvitationRenderRequest(BaseModel):
    configuration: FlyerConfiguration
    layers: list[CanvasLayer] = Field(default_factory=list)
    guest: InvitationGuest
    event_details: InvitationEventDetails | None = None
    format: Literal["png", "jpg", "jpeg"] = "png"


class StoredInvitationRenderRequest(BaseModel):
    event_id: str = Field(..., min_length=24, max_length=24)
    guest_id: str = Field(..., min_length=24, max_length=24)
    category: str | None = Field(default=None, max_length=10)
    format: Literal["png", "jpg", "jpeg"] = "png"
