from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field
from typing import Any
from bson import ObjectId  
from app.core.deps import get_current_user
from app.models.schemas.guests import (
    GuestListResponse,
    GuestNameScanRequest,
    GuestOwnerView,
    GuestQrCodeRequest,
    GuestQrCodeResponse,
    GuestScanRequest,
    GuestScanResponse,
    GuestScannerContextResponse,
    GuestStaffCheckInRequest,
    GuestStatusUpdateRequest,
)
from app.models.user import User
from app.services.guests import (
    check_guest_limit,
    create_guest_for_owner,
    check_in_guest_from_staff,
    generate_guest_qr_codes,
    get_staff_scanner_context,
    list_event_guests,
    resolve_staff_name_scan,
    resolve_staff_scan,
    update_guest_status,
    register_guest_self,
    get_event_analytics,
)
from app.models.event import EventDesignStatus
from app.services.events import get_event_by_id, get_event_by_slug

class GuestSelfRegistration(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=200)
    email: EmailStr | None = None
    phone: str | None = None
    custom_fields: dict[str, Any] = Field(default_factory=dict)

router = APIRouter(prefix="/guests", tags=["Guests"])

@router.post("/register/{event_slug}")
async def register_guest_for_event(
    event_slug: str,
    payload: GuestSelfRegistration,
) -> dict[str, Any]:
    """Public self‑registration for an event – no authentication required."""
    event = await get_event_by_slug(event_slug)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")

    guest = await register_guest_self(
        event_id=str(event.id),
        full_name=payload.full_name,
        email=payload.email,
        phone=payload.phone,
        custom_fields=payload.custom_fields,
    )
    return {
        "guest_id": guest.id,
        "full_name": guest.full_name,
        "qr_hash": guest.qr_hash,
        "status": str(guest.status),
        "message": "Registration successful. Your invitation is pending approval.",
    }

@router.get("/health")
async def guests_health() -> dict[str, str]:
    return {"status": "ok", "module": "guests"}

@router.post("/qr-codes", response_model=GuestQrCodeResponse)
async def create_guest_qr_codes(payload: GuestQrCodeRequest) -> GuestQrCodeResponse:
    return generate_guest_qr_codes(payload)

@router.get("/events/{event_id}", response_model=GuestListResponse)
async def read_event_guests(
    event_id: str,
    current_user: User = Depends(get_current_user),
) -> GuestListResponse:
    assert current_user.id is not None
    event = await get_event_by_id(event_id)
    if event is None or event.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Guest list not found.")
    if event.design_status != EventDesignStatus.PUBLISHED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Convert the invitation in the editor before opening Guests.",
        )
    result = await list_event_guests(current_user.id, event_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Guest list not found.")
    return GuestListResponse.model_validate(result)


@router.post(
    "/events/{event_id}",
    response_model=GuestOwnerView,
    status_code=status.HTTP_201_CREATED,
)
async def create_owner_guest(
    event_id: str,
    payload: GuestSelfRegistration,
    current_user: User = Depends(get_current_user),
) -> GuestOwnerView:
    assert current_user.id is not None
    try:
        guest = await create_guest_for_owner(
            owner_id=current_user.id,
            event_id=event_id,
            full_name=payload.full_name,
            email=payload.email,
            phone=payload.phone,
            custom_fields=payload.custom_fields,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return GuestOwnerView.model_validate(guest.model_dump(mode="json"))


@router.get("/events/{event_id}/limit")
async def read_event_guest_limit(
    event_id: str,
    current_user: User = Depends(get_current_user),
) -> dict[str, bool | int | str]:
    event = await get_event_by_id(event_id)
    if event is None or event.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found.",
        )

    try:
        return await check_guest_limit(event_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc

@router.patch("/{guest_id}/status", response_model=GuestOwnerView)
async def update_owner_guest_status(
    guest_id: str,
    payload: GuestStatusUpdateRequest,
    current_user: User = Depends(get_current_user),
) -> GuestOwnerView:
    assert current_user.id is not None
    updated = await update_guest_status(current_user.id, guest_id, payload.status)
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Guest not found.")
    return GuestOwnerView.model_validate(updated.model_dump(mode="json"))

@router.post("/staff/scan", response_model=GuestScanResponse)
async def staff_scan_guest(payload: GuestScanRequest, request: Request) -> GuestScanResponse:
    client_id = request.client.host if request.client else None
    result = await resolve_staff_scan(
        payload.share_token,
        payload.qr_hash,
        payload.mode,
        payload.pin_code,
        client_id,
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Invalid or expired staff access link.")
    return GuestScanResponse.model_validate(result)

@router.post("/staff/scan-name", response_model=GuestScanResponse)
async def staff_scan_guest_by_name(payload: GuestNameScanRequest, request: Request) -> GuestScanResponse:
    client_id = request.client.host if request.client else None
    result = await resolve_staff_name_scan(payload, client_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Invalid or expired staff access link.")
    return GuestScanResponse.model_validate(result)

@router.get("/staff/context/{share_token}", response_model=GuestScannerContextResponse)
async def read_staff_scanner_context(share_token: str) -> GuestScannerContextResponse:
    result = await get_staff_scanner_context(share_token)
    if result is None:
        raise HTTPException(status_code=404, detail="Invalid or disabled staff access link.")
    return GuestScannerContextResponse.model_validate(result)

@router.post("/staff/check-in", response_model=GuestScanResponse)
async def staff_check_in_guest(payload: GuestStaffCheckInRequest) -> GuestScanResponse:
    result = await check_in_guest_from_staff(payload)
    if result is None:
        raise HTTPException(status_code=404, detail="Unable to check in this guest.")
    return GuestScanResponse.model_validate(result)

@router.delete("/{guest_id}")
async def delete_guest(
    guest_id: str,
    current_user: User = Depends(get_current_user),
):
    """Delete a guest (owner-only)."""
    if not ObjectId.is_valid(guest_id):
        raise HTTPException(status_code=400, detail="Invalid guest ID")
    from app.core.database import get_collection
    guest = await get_collection("guests").find_one({"_id": ObjectId(guest_id)})
    if guest is None:
        raise HTTPException(status_code=404, detail="Guest not found")
    event = await get_event_by_id(str(guest.get("event_id", "")))
    if event is None or event.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Guest not found")
    result = await get_collection("guests").delete_one({"_id": ObjectId(guest_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Guest not found")
    return {"status": "ok"}

@router.get("/events/{event_id}/analytics")
async def event_analytics(
    event_id: str,
    current_user: User = Depends(get_current_user),
):
    event = await get_event_by_id(event_id)
    if event is None or event.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.design_status != EventDesignStatus.PUBLISHED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Convert the invitation in the editor before opening Analytics.",
        )
    result = await get_event_analytics(event_id, current_user.id)
    if result is None:
        raise HTTPException(status_code=404, detail="Event not found")
    return result
