from datetime import UTC, datetime, time as clock_time
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException, status, Body
from pydantic import BaseModel, Field
from bson import ObjectId
from app.models.canvas import CanvasLayer

from app.core.deps import get_current_user
from app.models.event import Event, EventDesignStatus
from app.models.flyer import SetupCompleteRequest, SetupCompleteResponse
from app.models.schemas.public_events import PublicEventResponse
from app.models.user import User
from app.services.events import (
    complete_setup,
    get_event_by_id,
    get_public_event_by_slug,
    create_draft_event,
)
from app.core.database import get_collection
from app.services.events import EVENTS_COLLECTION 
from app.services.flyers import (
    attach_design_layer_flyers_to_event,
    delete_event_flyer_assets,
)

class SaveDesignRequest(BaseModel):
    layers: list[CanvasLayer]
    configuration: dict  # the FlyerConfiguration as dict


router = APIRouter(prefix="/events", tags=["Events"])


async def _publish_design(
    event_id: str,
    payload: SaveDesignRequest,
    current_user: User,
) -> Event:
    event = await get_event_by_id(event_id)
    if not event or event.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")
    if event.event_date is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Save an event date in Settings before converting the design into an invitation.",
        )
    if not any(layer.visible for layer in payload.layers):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Add at least one visible design element before converting the invitation.",
        )

    assert current_user.id is not None
    await attach_design_layer_flyers_to_event(
        event_id=event_id,
        owner_id=current_user.id,
        design_layers=payload.layers,
    )
    await get_collection(EVENTS_COLLECTION).update_one(
        {"_id": ObjectId(event_id)},
        {"$set": {
            "design_layers": [layer.model_dump() for layer in payload.layers],
            "design_configuration": payload.configuration,
            "design_status": EventDesignStatus.PUBLISHED.value,
            "design_published_at": datetime.now(UTC),
        }},
    )
    published = await get_event_by_id(event_id)
    assert published is not None
    return published


async def _delete_event_access_data(event_id: str) -> None:
    event_object_id = ObjectId(event_id)
    await get_collection("guests").delete_many({"event_id": event_object_id})
    await get_collection("admin_share_links").delete_many({"event_id": event_object_id})
    await get_collection("staff_scan_audit").delete_many({"event_id": event_object_id})


@router.get("/{event_id}", response_model=Event)
async def read_event(
    event_id: str,
    current_user: User = Depends(get_current_user),
) -> Event:
    event = await get_event_by_id(event_id)
    if event is None or event.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")
    return event


@router.get("/slug/{slug}", response_model=PublicEventResponse)
async def read_public_event(slug: str) -> PublicEventResponse:
    event = await get_public_event_by_slug(slug)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")
    return PublicEventResponse.model_validate(event)


@router.post("/setup/complete", response_model=SetupCompleteResponse)
async def finalize_setup(
    payload: SetupCompleteRequest,
    current_user: User = Depends(get_current_user),
) -> SetupCompleteResponse:
    assert current_user.id is not None
    try:
        result = await complete_setup(current_user.id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return SetupCompleteResponse(
        event_id=result["event_id"],
        flyer_id=result["flyer_id"],
        tier=result["tier"],
        total_price=result["total_price"],
        guest_capacity=result["guest_capacity"],
    )


@router.patch("/{event_id}/design")
async def save_event_design(
    event_id: str,
    payload: SaveDesignRequest,
    current_user: User = Depends(get_current_user),
):
    return await _publish_design(event_id, payload, current_user)


@router.post("/{event_id}/publish", response_model=Event)
async def publish_event_design(
    event_id: str,
    payload: SaveDesignRequest,
    current_user: User = Depends(get_current_user),
) -> Event:
    return await _publish_design(event_id, payload, current_user)


@router.post("/{event_id}/return-to-editor", response_model=Event)
async def return_event_to_editor(
    event_id: str,
    current_user: User = Depends(get_current_user),
) -> Event:
    event = await get_event_by_id(event_id)
    if not event or event.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")

    await _delete_event_access_data(event_id)
    await get_collection(EVENTS_COLLECTION).update_one(
        {"_id": ObjectId(event_id)},
        {"$set": {
            "design_status": EventDesignStatus.DRAFT.value,
            "design_published_at": None,
        }},
    )
    draft = await get_event_by_id(event_id)
    assert draft is not None
    return draft

class CreateDraftEventRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=300)
    event_type: str = Field(...)  # will be validated

@router.post("", response_model=Event, status_code=201)
async def create_draft(
    payload: CreateDraftEventRequest,
    current_user: User = Depends(get_current_user),
) -> Event:
    return await create_draft_event(
        owner_id=current_user.id,
        title=payload.title,
        event_type=payload.event_type,
    )

@router.delete("/{event_id}")
async def delete_event(
    event_id: str,
    current_user: User = Depends(get_current_user),
):
    event = await get_event_by_id(event_id)
    if not event or event.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Event not found")

    assert current_user.id is not None
    try:
        await delete_event_flyer_assets(
            event_id=event_id,
            owner_id=current_user.id,
            primary_flyer_id=event.flyer_id,
            design_layers=event.design_layers or [],
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not remove the event's stored images. The event was not deleted; please retry.",
        ) from exc

    # Delete related MongoDB data only after storage cleanup succeeds.
    await _delete_event_access_data(event_id)
    await get_collection(EVENTS_COLLECTION).delete_one({"_id": ObjectId(event_id)})

    return {"status": "ok"}

@router.post("/{event_id}/reset-guest-data")
async def reset_event_guest_data(
    event_id: str,
    current_user: User = Depends(get_current_user),
):
    event = await get_event_by_id(event_id)
    if not event or event.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Event not found")

    # Delete guests, admin links, and scan logs – keep design layers and settings
    await _delete_event_access_data(event_id)

    return {"status": "ok"}

@router.patch("/{event_id}")
async def update_event_settings(
    event_id: str,
    payload: dict,
    current_user: User = Depends(get_current_user),
):
    event = await get_event_by_id(event_id)
    if not event or event.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Event not found")

    update_fields = {}
    if "require_rsvp_approval" in payload:
        update_fields["require_rsvp_approval"] = payload["require_rsvp_approval"]
    if "title" in payload:
        update_fields["title"] = payload["title"]
    if "event_date" in payload:
        update_fields["event_date"] = payload["event_date"]
    if "event_time" in payload:
        raw_time = payload["event_time"]
        if raw_time:
            try:
                update_fields["event_time"] = clock_time.fromisoformat(str(raw_time)).strftime("%H:%M")
            except ValueError as exc:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Event time must use HH:MM format.",
                ) from exc
        else:
            update_fields["event_time"] = None
    if "event_timezone" in payload:
        raw_timezone = str(payload["event_timezone"] or "").strip()
        try:
            ZoneInfo(raw_timezone)
        except (ZoneInfoNotFoundError, ValueError) as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Event timezone must be a valid IANA timezone.",
            ) from exc
        update_fields["event_timezone"] = raw_timezone
    if "event_location" in payload:
        location = payload["event_location"]
        update_fields["event_location"] = location.strip()[:160] if isinstance(location, str) and location.strip() else None
    if "event_type" in payload:
        update_fields["event_type"] = payload["event_type"]
    if "configuration" in payload:
        update_fields["configuration"] = payload["configuration"]

    if update_fields:
        await get_collection(EVENTS_COLLECTION).update_one(
            {"_id": ObjectId(event_id)},
            {"$set": update_fields},
        )
    updated_event = await get_event_by_id(event_id)
    if updated_event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    return updated_event
