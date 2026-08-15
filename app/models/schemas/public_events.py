from pydantic import BaseModel

from app.models.event import Event


class PublicEventResponse(BaseModel):
    """Public event payload used by SEO-friendly invitation pages."""

    event: Event
    flyer_image_url: str | None = None
