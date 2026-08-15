import asyncio
import json
from typing import Literal

from bson import ObjectId
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse, Response
from starlette.concurrency import run_in_threadpool

from app.core.deps import get_current_user
from app.core.database import get_collection
from app.models.event import EventType
from app.models.flyer import FlyerConfiguration, FlyerConfigurationUpdate, FlyerRecord, QrBounds, QrVisibility
from app.models.schemas.flyer_templates import (
    FlyerTemplate,
    TemplateCategory,
)
from app.models.schemas.invitation_rendering import (
    InvitationRenderRequest,
    StoredInvitationRenderRequest,
)
from app.models.user import User
from app.services.flyers import (
    UPLOAD_ROOT,
    default_qr_bounds,
    get_flyer_by_id,
    save_flyer_upload,
    list_flyer_templates_async,
    update_flyer_configuration,
    get_all_templates,
)
from app.services.invitation_rendering import InvitationRenderError, render_guest_invitation
from app.services.invitation_rendering.assets import AssetLoadError

router = APIRouter(prefix="/flyers", tags=["Flyers"])
invitation_render_slots = asyncio.Semaphore(4)


def ephemeral_invitation_response(content: bytes, image_format: str) -> Response:
    normalized_format = "png" if image_format == "png" else "jpg"
    return Response(
        content=content,
        media_type="image/png" if normalized_format == "png" else "image/jpeg",
        headers={
            "Cache-Control": "private, no-store, max-age=0",
            "Pragma": "no-cache",
            "Content-Disposition": f'inline; filename="guest-invitation.{normalized_format}"',
            "X-GatherVia-Asset-Lifecycle": "ephemeral",
        },
    )


async def run_invitation_render(
    configuration: FlyerConfiguration | dict,
    layers: list,
    guest: dict,
    image_format: str,
    event_details: dict | None = None,
) -> Response:
    try:
        async with invitation_render_slots:
            content = await run_in_threadpool(
                render_guest_invitation,
                configuration,
                layers,
                guest,
                image_format,
                event_details,
            )
    except AssetLoadError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    except InvitationRenderError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    return ephemeral_invitation_response(content, image_format)


@router.get(
    "/templates",
    response_model=list[FlyerTemplate],
)
async def get_flyer_templates(
    category: TemplateCategory | None = None,
    event_type: EventType | None = None,
) -> list[FlyerTemplate]:
    return await list_flyer_templates_async(
        category=category,
        event_type=event_type,
    )


@router.post("", response_model=FlyerRecord, status_code=status.HTTP_201_CREATED)
async def upload_flyer(
    file: UploadFile = File(...),
    image_width: int = Form(...),
    image_height: int = Form(...),
    canvas_background_color: str = Form(default="#f0fdfa"),
    qr_foreground_color: str = Form(default="#0d9488"),
    qr_background_color: str = Form(default="#ffffff"),
    qr_background_transparent: bool = Form(default=False),
    qr_visibility: QrVisibility = Form(default=QrVisibility.VISIBLE),
    qr_bounds_json: str | None = Form(default=None),
    event_id: str | None = Form(default=None),
    current_user: User = Depends(get_current_user),
) -> FlyerRecord:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File must be an image.")

    bounds = (
        QrBounds.model_validate(json.loads(qr_bounds_json))
        if qr_bounds_json
        else default_qr_bounds(image_width, image_height)
    )
    configuration = FlyerConfiguration(
        canvas_background_color=canvas_background_color,
        qr_foreground_color=qr_foreground_color,
        qr_background_color=qr_background_color,
        qr_background_transparent=qr_background_transparent,
        qr_visibility=qr_visibility,
        qr_bounds=bounds,
        image_width=image_width,
        image_height=image_height,
    )

    if event_id:
        if not ObjectId.is_valid(event_id) or current_user.id is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid event identifier.")
        event = await get_collection("events").find_one(
            {"_id": ObjectId(event_id), "owner_id": ObjectId(current_user.id)}
        )
        if event is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")

    try:
        return await save_flyer_upload(
            owner=current_user,
            upload=file,
            configuration=configuration,
            event_id=event_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc


@router.post("/render-invitation", response_class=Response)
async def render_invitation(
    payload: InvitationRenderRequest,
    current_user: User = Depends(get_current_user),
) -> Response:
    """Render the canonical 1080x1920 guest invitation without mutating the draft."""

    del current_user
    return await run_invitation_render(
        payload.configuration,
        payload.layers,
        payload.guest.model_dump(),
        payload.format,
        payload.event_details.model_dump() if payload.event_details else None,
    )


@router.post("/render-saved-invitation", response_class=Response)
async def render_saved_invitation(
    payload: StoredInvitationRenderRequest,
    current_user: User = Depends(get_current_user),
) -> Response:
    """Render from the latest persisted event and guest without storing the result."""

    if current_user.id is None or not ObjectId.is_valid(payload.event_id) or not ObjectId.is_valid(payload.guest_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid event or guest identifier.")

    event = await get_collection("events").find_one(
        {"_id": ObjectId(payload.event_id), "owner_id": ObjectId(current_user.id)}
    )
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")
    guest = await get_collection("guests").find_one(
        {"_id": ObjectId(payload.guest_id), "event_id": ObjectId(payload.event_id)}
    )
    if guest is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Guest not found.")

    configuration_data = event.get("design_configuration")
    layers = event.get("design_layers") or []
    if not configuration_data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Save the invitation design before generating a guest pass.",
        )
    try:
        configuration = FlyerConfiguration.model_validate(configuration_data)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The saved invitation configuration is invalid.",
        ) from exc

    event_configuration = event.get("configuration") or {}
    categories_enabled = event_configuration.get("invitation_categories_enabled", True)
    configured_categories = event_configuration.get("invitation_categories") or ["General", "VIP"]
    if not categories_enabled or not configured_categories:
        category = ""
    elif payload.category is not None:
        category = payload.category.strip()
        if category not in configured_categories:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Choose one of the event's currently enabled invitation categories.",
            )
    else:
        stored_category = guest.get("category", "General")
        category = stored_category.value if hasattr(stored_category, "value") else str(stored_category)
        if category not in configured_categories:
            category = configured_categories[0]

    return await run_invitation_render(
        configuration,
        layers,
        {
            "name": str(guest.get("full_name") or "Guest"),
            "category": category,
            "qr_hash": str(guest.get("qr_hash") or ""),
        },
        payload.format,
        {
            "date": event.get("event_date"),
            "time": event.get("event_time"),
            "location": event.get("event_location"),
        },
    )


@router.get("/render-saved-invitation/{event_id}/{guest_id}", response_class=Response)
async def download_saved_invitation(
    event_id: str,
    guest_id: str,
    format: Literal["png", "jpg", "jpeg"] = "png",
    category: str | None = None,
    current_user: User = Depends(get_current_user),
) -> Response:
    """GET variant used by native clients that download directly to a cache file."""

    return await render_saved_invitation(
        StoredInvitationRenderRequest(
            event_id=event_id,
            guest_id=guest_id,
            format=format,
            category=category,
        ),
        current_user,
    )


@router.get("/{flyer_id}", response_model=FlyerRecord)
async def get_flyer(
    flyer_id: str,
    current_user: User = Depends(get_current_user),
) -> FlyerRecord:
    assert current_user.id is not None
    flyer = await get_flyer_by_id(flyer_id, current_user.id)
    if flyer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flyer not found.")
    return flyer


@router.patch("/{flyer_id}", response_model=FlyerRecord)
async def patch_flyer_configuration(
    flyer_id: str,
    payload: FlyerConfigurationUpdate,
    current_user: User = Depends(get_current_user),
) -> FlyerRecord:
    assert current_user.id is not None
    flyer = await update_flyer_configuration(flyer_id, current_user.id, payload)
    if flyer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flyer not found.")
    return flyer



@router.get("/assets/{owner_id}/{filename}")
async def get_flyer_asset(owner_id: str, filename: str) -> FileResponse:
    asset_path = UPLOAD_ROOT / owner_id / filename
    if not asset_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found.")
    return FileResponse(asset_path)
