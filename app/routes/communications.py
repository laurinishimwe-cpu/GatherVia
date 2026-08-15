from fastapi import APIRouter, Depends, HTTPException, status

from app.core.deps import get_current_user
from app.models.schemas.communications import (
    AdminAccessRequest,
    AdminPinUpdateRequest,
    AdminRsvpContextResponse,
    AdminShareLinkRequest,
    AdminShareLinkResponse,
    CommunicationChannel,
    EventPublicLinksResponse,
    FlyerDispatchResponse,
    FlyerEmailSendRequest,
    FlyerWhatsAppSendRequest,
)
from app.models.user import User
from app.services.communications import (
    create_admin_share_link,
    create_flyer_dispatch,
    delete_admin_share_link,
    get_admin_rsvp_context,
    get_event_public_links,
    list_admin_share_links,
    request_admin_share_link,
    toggle_admin_share_link,
    update_admin_share_link_pin,
)

router = APIRouter(prefix="/communications", tags=["Communications"])


def _build_admin_link_response(document: dict[str, object]) -> AdminShareLinkResponse:
    return AdminShareLinkResponse(
        id=document["_id"],  # type: ignore[index]
        user_id=document["owner_id"],  # type: ignore[index]
        event_id=document["event_id"],  # type: ignore[index]
        link_label=document["link_label"],  # type: ignore[index]
        share_token=document["share_token"],  # type: ignore[index]
        share_url=document["share_url"],  # type: ignore[index]
        enabled=bool(document.get("enabled", True)),
        pin_enabled=bool(document.get("pin_enabled", False)),
        pin_code=document.get("pin_code"),  # type: ignore[arg-type]
        activity=document.get("activity", {"scanned_in": 0, "scanned_out": 0, "logs": []}),  # type: ignore[arg-type]
        created_at=document["created_at"],  # type: ignore[index]
    )


def _build_dispatch_response(document: dict[str, object]) -> FlyerDispatchResponse:
    return FlyerDispatchResponse(
        id=document["_id"],  # type: ignore[index]
        channel=document["channel"],  # type: ignore[index]
        status=document["status"],  # type: ignore[index]
        provider_ready=document["provider_ready"],  # type: ignore[index]
        event_id=document["event_id"],  # type: ignore[index]
        flyer_id=document["flyer_id"],  # type: ignore[index]
        recipient_name=document["recipient_name"],  # type: ignore[index]
        recipient_contact=document["recipient_contact"],  # type: ignore[index]
        share_token=document["share_token"],  # type: ignore[index]
        share_url=document["share_url"],  # type: ignore[index]
        created_at=document["created_at"],  # type: ignore[index]
    )


@router.post("/admin-links", response_model=AdminShareLinkResponse, status_code=status.HTTP_201_CREATED)
async def create_admin_link(
    payload: AdminShareLinkRequest,
    current_user: User = Depends(get_current_user),
) -> AdminShareLinkResponse:
    try:
        document = await create_admin_share_link(
            owner=current_user,
            event_id=payload.event_id,
            link_label=payload.link_label,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return _build_admin_link_response(document)


@router.post("/admin-share-link", response_model=AdminShareLinkResponse, status_code=status.HTTP_201_CREATED)
async def create_admin_share_link_alias(
    payload: AdminShareLinkRequest,
    current_user: User = Depends(get_current_user),
) -> AdminShareLinkResponse:
    return await create_admin_link(payload, current_user)


@router.get("/admin-rsvp/{event_id}", response_model=AdminRsvpContextResponse)
async def read_admin_rsvp_context(event_id: str) -> AdminRsvpContextResponse:
    document = await get_admin_rsvp_context(event_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")
    return AdminRsvpContextResponse.model_validate(document)


@router.get("/event-links/{event_id}", response_model=EventPublicLinksResponse)
async def read_event_public_links(
    event_id: str,
    current_user: User = Depends(get_current_user),
) -> EventPublicLinksResponse:
    try:
        document = await get_event_public_links(owner=current_user, event_id=event_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return EventPublicLinksResponse.model_validate(document)


@router.post("/admin-rsvp/{event_id}", response_model=AdminShareLinkResponse, status_code=status.HTTP_201_CREATED)
async def request_admin_access(
    event_id: str,
    payload: AdminAccessRequest,
) -> AdminShareLinkResponse:
    try:
        document = await request_admin_share_link(
            event_id=event_id,
            admin_name=payload.admin_name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return _build_admin_link_response(document)


@router.get("/admin-links/{event_id}", response_model=list[AdminShareLinkResponse])
async def get_admin_links(
    event_id: str,
    current_user: User = Depends(get_current_user),
) -> list[AdminShareLinkResponse]:
    try:
        documents = await list_admin_share_links(owner=current_user, event_id=event_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return [_build_admin_link_response(document) for document in documents]


@router.patch("/admin-links/{link_id}/toggle", response_model=AdminShareLinkResponse)
async def toggle_admin_link(
    link_id: str,
    current_user: User = Depends(get_current_user),
) -> AdminShareLinkResponse:
    document = await toggle_admin_share_link(owner=current_user, link_id=link_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admin link not found.")
    return _build_admin_link_response(document)


@router.patch("/admin-links/{link_id}/pin", response_model=AdminShareLinkResponse)
async def update_admin_link_pin(
    link_id: str,
    payload: AdminPinUpdateRequest,
    current_user: User = Depends(get_current_user),
) -> AdminShareLinkResponse:
    try:
        document = await update_admin_share_link_pin(
            owner=current_user,
            link_id=link_id,
            pin_enabled=payload.pin_enabled,
            pin_code=payload.pin_code,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admin link not found.")
    return _build_admin_link_response(document)


@router.delete("/admin-links/{link_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_admin_link(
    link_id: str,
    current_user: User = Depends(get_current_user),
) -> None:
    deleted = await delete_admin_share_link(owner=current_user, link_id=link_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admin link not found.")


@router.post("/flyers/email", response_model=FlyerDispatchResponse, status_code=status.HTTP_201_CREATED)
async def send_flyer_email(
    payload: FlyerEmailSendRequest,
    current_user: User = Depends(get_current_user),
) -> FlyerDispatchResponse:
    try:
        document = await create_flyer_dispatch(
            owner=current_user,
            event_id=payload.event_id,
            flyer_id=payload.flyer_id,
            channel=CommunicationChannel.EMAIL,
            recipient_name=payload.recipient_name,
            recipient_contact=payload.recipient_email,
            message=payload.message,
            subject=payload.subject,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return _build_dispatch_response(document)


@router.post("/flyers/whatsapp", response_model=FlyerDispatchResponse, status_code=status.HTTP_201_CREATED)
async def send_flyer_whatsapp(
    payload: FlyerWhatsAppSendRequest,
    current_user: User = Depends(get_current_user),
) -> FlyerDispatchResponse:
    try:
        document = await create_flyer_dispatch(
            owner=current_user,
            event_id=payload.event_id,
            flyer_id=payload.flyer_id,
            channel=CommunicationChannel.WHATSAPP,
            recipient_name=payload.recipient_name,
            recipient_contact=payload.recipient_phone,
            message=payload.message,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return _build_dispatch_response(document)
