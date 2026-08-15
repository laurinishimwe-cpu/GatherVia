from datetime import UTC, date, datetime
from typing import Any

from bson import ObjectId

from app.core.database import get_collection
from app.models.event import Event, EventConfiguration, EventDesignStatus, EventType, WordingDictionary
from app.models.flyer import SetupCompleteRequest
from app.models.schemas.pricing import PricingQuoteRequest
from app.services.flyers import attach_flyer_to_event, get_flyer_by_id
from app.services.slug_utils import build_event_slug, slugify_text
from app.services.pricing import calculate_quote, resolve_tier
from app.services.users import get_user_by_id

EVENTS_COLLECTION = "events"

WORDING_BY_EVENT_TYPE: dict[str, WordingDictionary] = {
    "corporate": WordingDictionary(guest_label_singular="Client", guest_label_plural="Clients"),
    "marriage": WordingDictionary(guest_label_singular="Guest", guest_label_plural="Guests"),
    "private": WordingDictionary(guest_label_singular="Invitee", guest_label_plural="Invitees"),
    "conference": WordingDictionary(
        guest_label_singular="Delegate",
        guest_label_plural="Delegates",
    ),
    "gala": WordingDictionary(guest_label_singular="Guest", guest_label_plural="Guests"),
    "other": WordingDictionary(guest_label_singular="Attendee", guest_label_plural="Attendees"),
}


def _serialize_event(document: dict[str, Any]) -> Event:
    document = dict(document)
    document["_id"] = str(document["_id"])
    document["owner_id"] = str(document["owner_id"])
    # Designs saved before the lifecycle field was introduced were already treated
    # as invitations. Preserve that state without requiring a destructive migration.
    if "design_status" not in document:
        has_saved_invitation = bool(document.get("design_layers") or document.get("flyer_id"))
        document["design_status"] = (
            EventDesignStatus.PUBLISHED.value
            if has_saved_invitation
            else EventDesignStatus.DRAFT.value
        )
    if isinstance(document.get("event_date"), str):
        document["event_date"] = date.fromisoformat(document["event_date"])
    return Event.model_validate(document)


async def _generate_unique_slug(title: str, event_date: date) -> str:
    base = build_event_slug(title, event_date)
    slug = base
    counter = 2

    while await get_collection(EVENTS_COLLECTION).find_one({"slug": slug}) is not None:
        slug = f"{base}-{counter}"
        counter += 1

    return slug


async def get_event_by_id(event_id: str) -> Event | None:
    if not ObjectId.is_valid(event_id):
        return None
    document = await get_collection(EVENTS_COLLECTION).find_one({"_id": ObjectId(event_id)})
    if document is None:
        return None
    return _serialize_event(document)


async def get_event_by_slug(slug: str) -> Event | None:
    normalized = slugify_text(slug)
    document = await get_collection(EVENTS_COLLECTION).find_one({"slug": normalized})
    if document is None:
        return None
    return _serialize_event(document)


async def get_public_event_by_slug(slug: str) -> dict[str, object] | None:
    event = await get_event_by_slug(slug)
    if event is None or event.design_status != EventDesignStatus.PUBLISHED:
        return None

    flyer_image_url = None
    if event.flyer_id is not None:
        flyer = await get_flyer_by_id(event.flyer_id, event.owner_id)
        if flyer is not None:
            flyer_image_url = flyer.image_url

    return {
        "event": event.model_dump(mode="json", by_alias=True),
        "flyer_image_url": flyer_image_url,
    }


async def create_event_for_owner(
    *,
    owner_id: str,
    title: str,
    event_type: str,
    event_date: date,
    guest_capacity: int,
    flyer_id: str,
    ui_language: str = "en",
) -> Event:
    tier = resolve_tier(guest_capacity)
    wording = WORDING_BY_EVENT_TYPE.get(
        event_type,
        WordingDictionary(guest_label_singular="Guest", guest_label_plural="Guests"),
    )
    allowed_admin_fields = ["name", "category"]
    if guest_capacity >= 101:
        allowed_admin_fields = [
            "name",
            "email",
            "phone",
            "category",
            "seat_assignment",
            "custom_notes",
        ]
    elif guest_capacity >= 51:
        allowed_admin_fields = ["name", "category", "seat_assignment", "latest_check_in_status"]

    configuration = EventConfiguration(
        ui_language=ui_language,
        wording_dictionary=wording,
        allowed_admin_fields=allowed_admin_fields,
    )

    try:
        parsed_event_type = EventType(event_type)
    except ValueError:
        parsed_event_type = EventType.OTHER

    slug = await _generate_unique_slug(title, event_date)

    payload = {
        "owner_id": ObjectId(owner_id),
        "title": title,
        "slug": slug,
        "event_type": parsed_event_type.value,
        "event_date": event_date.isoformat(),
        "guest_capacity": guest_capacity,
        "pricing_tier": tier.key,
        "flyer_id": flyer_id,
        "design_status": EventDesignStatus.PUBLISHED.value,
        "design_published_at": datetime.now(UTC),
        "configuration": configuration.model_dump(mode="json"),
        "created_at": datetime.now(UTC),
    }
    result = await get_collection(EVENTS_COLLECTION).insert_one(payload)
    document = await get_collection(EVENTS_COLLECTION).find_one({"_id": result.inserted_id})
    assert document is not None
    return _serialize_event(document)

async def create_draft_event(
    owner_id: str,
    title: str,
    event_type: str,
) -> Event:
    try:
        parsed_type = EventType(event_type)
    except ValueError:
        raise ValueError(f"Invalid event type: {event_type}")

    wording = WORDING_BY_EVENT_TYPE.get(
        event_type,
        WordingDictionary(guest_label_singular="Guest", guest_label_plural="Guests"),
    )
    configuration = EventConfiguration(
        ui_language="en",
        wording_dictionary=wording,
        allowed_admin_fields=["name", "category"],
    )
    slug = await _generate_unique_slug(title, date.today())

    payload = {
        "owner_id": ObjectId(owner_id),
        "title": title,
        "slug": slug,
        "event_type": parsed_type.value,
        "event_date": None,
        "event_time": None,
        "event_timezone": "UTC",
        "event_location": None,
        "configuration": configuration.model_dump(mode="json"),
        "flyer_id": None,
        "design_layers": [],
        "design_configuration": None,
        "design_status": EventDesignStatus.DRAFT.value,
        "design_published_at": None,
        "created_at": datetime.now(UTC),
    }
    result = await get_collection(EVENTS_COLLECTION).insert_one(payload)
    document = await get_collection(EVENTS_COLLECTION).find_one({"_id": result.inserted_id})
    assert document is not None
    return _serialize_event(document)


async def complete_setup(owner_id: str, request: SetupCompleteRequest) -> dict[str, Any]:
    flyer = await get_flyer_by_id(request.flyer_id, owner_id)
    if flyer is None:
        raise ValueError("Flyer not found for the authenticated user.")

    quote = calculate_quote(PricingQuoteRequest(guest_capacity=request.guest_capacity))
    # Subscription tiers are changed only after a verified mobile IAP purchase.
    # Completing the legacy setup quote must not grant a paid account tier.
    current_user = await get_user_by_id(owner_id)
    ui_language = current_user.preferred_language if current_user and current_user.preferred_language else "en"

    event = await create_event_for_owner(
        owner_id=owner_id,
        title=request.event_title,
        event_type=request.event_type,
        event_date=request.event_date,
        guest_capacity=request.guest_capacity,
        flyer_id=request.flyer_id,
        ui_language=str(ui_language),
    )
    assert event.id is not None
    await attach_flyer_to_event(request.flyer_id, owner_id, event.id)

    return {
        "event_id": event.id,
        "event_slug": event.slug,
        "flyer_id": request.flyer_id,
        "tier": quote.tier,
        "total_price": quote.total_price,
        "guest_capacity": request.guest_capacity,
        "event": event.model_dump(mode="json", by_alias=True),
    }

    
