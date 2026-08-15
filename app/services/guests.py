from datetime import UTC, datetime, timedelta
import re
from secrets import token_hex
from typing import Any
import unicodedata

from bson import ObjectId
from fastapi import HTTPException, status as http_status

from app.core.database import get_collection
from app.models.event import EventDesignStatus, EventType
from app.models.guest import CheckInLog, CheckInStatus, Guest, GuestCategory, GuestStatus
from app.models.user import UserTier
from app.models.schemas.guests import (
    GuestListResponse,
    GuestListSummary,
    GuestNameScanRequest,
    GuestOwnerView,
    GuestQrCodeItem,
    GuestQrCodeRequest,
    GuestQrCodeResponse,
    GuestScanResponse,
    GuestScannerContextResponse,
    GuestStaffCheckInRequest,
    GuestStaffView,
)
from app.services.communications import get_admin_share_link_by_token, resolve_admin_share_link
from app.services.events import WORDING_BY_EVENT_TYPE, get_event_by_id
from app.services.plans import PLAN_GUEST_LIMITS
from app.services.users import get_user_by_id
from uuid import uuid4


GUESTS_COLLECTION = "guests"
STAFF_SCAN_AUDIT_COLLECTION = "staff_scan_audit"
FAILED_SCAN_LIMIT = 10
FAILED_SCAN_WINDOW_SECONDS = 60
GUEST_LIMITS = PLAN_GUEST_LIMITS


async def check_guest_limit(event_id: str) -> dict[str, bool | int | str]:
    """Return the event owner's current guest capacity and availability."""
    if not ObjectId.is_valid(event_id):
        raise ValueError("Invalid event ID")

    event = await get_event_by_id(event_id)
    if event is None:
        raise ValueError("Event not found")
    if event.design_status != EventDesignStatus.PUBLISHED:
        raise HTTPException(
            status_code=http_status.HTTP_409_CONFLICT,
            detail="This invitation is still a draft. Convert it in the editor before accepting guests.",
        )

    owner = await get_user_by_id(event.owner_id)
    try:
        # MongoModel serializes enums to their string values. Normalize the
        # stored value before reading `.value` or looking up plan capacity.
        tier = UserTier(owner.tier) if owner is not None else UserTier.FREE
    except (TypeError, ValueError):
        # Legacy or malformed tier data must never prevent guest management.
        tier = UserTier.FREE
    limit = GUEST_LIMITS.get(tier, GUEST_LIMITS[UserTier.FREE])
    current = await get_collection(GUESTS_COLLECTION).count_documents(
        {"event_id": ObjectId(event_id)}
    )

    return {
        "allowed": current < limit,
        "current": current,
        "limit": limit,
        "tier": tier.value,
    }


def _resolve_guest_labels(event_type: EventType) -> tuple[str, str]:
    wording = WORDING_BY_EVENT_TYPE.get(
        event_type.value,
        WORDING_BY_EVENT_TYPE["other"],
    )
    return wording.guest_label_singular, wording.guest_label_plural


def _normalize_lookup_name(value: str) -> str:
    without_accents = unicodedata.normalize("NFKD", value)
    ascii_text = without_accents.encode("ascii", "ignore").decode("ascii")
    collapsed = re.sub(r"\s+", " ", ascii_text.strip().lower())
    return collapsed


def generate_guest_qr_codes(payload: GuestQrCodeRequest) -> GuestQrCodeResponse:
    singular_label, plural_label = _resolve_guest_labels(payload.event_type)

    qr_codes = []
    for index in range(1, payload.guest_capacity + 1):
        qr_hash = token_hex(16)
        label = singular_label if payload.guest_capacity == 1 else f"{singular_label} {index:03d}"
        qr_codes.append(
            GuestQrCodeItem(
                index=index,
                label=label,
                qr_hash=qr_hash,
                qr_payload=f"gathervia://{payload.event_type.value}/{qr_hash}",
            )
        )

    return GuestQrCodeResponse(
        event_type=payload.event_type,
        guest_capacity=payload.guest_capacity,
        guest_label_singular=singular_label,
        guest_label_plural=plural_label,
        qr_codes=qr_codes,
    )


def _serialize_guest(document: dict[str, object]) -> Guest:
    document["_id"] = str(document["_id"])
    document["event_id"] = str(document["event_id"])
    return Guest.model_validate(document)


def _build_guest_staff_view(guest: Guest, allowed_fields: list[str]) -> GuestStaffView:
    limited_fields = {
        key: value
        for key, value in guest.custom_fields.items()
        if key in allowed_fields
    }
    return GuestStaffView(
        id=guest.id or "",
        full_name=guest.full_name,
        category=guest.category,
        status=guest.status,
        custom_fields=limited_fields,
        check_in_logs=guest.check_in_logs,
    )


def _scan_action_for_status(status: CheckInStatus) -> str:
    if status == CheckInStatus.LEFT_BUILDING:
        return "scan_out"
    if status == CheckInStatus.RETURNED:
        return "return"
    if status == CheckInStatus.DUPLICATE_SCAN:
        return "duplicate_denied"
    return "scan_in"


async def _is_rate_limited(share_token: str, client_id: str | None) -> bool:
    since = datetime.now(UTC) - timedelta(seconds=FAILED_SCAN_WINDOW_SECONDS)
    query: dict[str, object] = {
        "share_token": share_token,
        "outcome": "denied",
        "timestamp": {"$gte": since},
    }
    if client_id:
        query["client_id"] = client_id
    count = await get_collection(STAFF_SCAN_AUDIT_COLLECTION).count_documents(query)
    return count >= FAILED_SCAN_LIMIT


async def _record_staff_scan_audit(
    *,
    share_token: str,
    event_id: str,
    admin_label: str,
    action: str,
    outcome: str,
    status: str,
    lookup_method: str,
    severity: str = "info",
    reason: str | None = None,
    guest: Guest | None = None,
    attempted_name: str | None = None,
    client_id: str | None = None,
) -> None:
    payload: dict[str, object | None] = {
        "share_token": share_token,
        "event_id": ObjectId(event_id) if ObjectId.is_valid(event_id) else event_id,
        "admin_label": admin_label,
        "action": action,
        "outcome": outcome,
        "status": status,
        "lookup_method": lookup_method,
        "severity": severity,
        "reason": reason,
        "guest_id": ObjectId(guest.id) if guest and guest.id and ObjectId.is_valid(guest.id) else None,
        "guest_name": guest.full_name if guest else attempted_name or "Unknown guest",
        "guest_category": str(guest.category) if guest else "Unknown",
        "client_id": client_id,
        "timestamp": datetime.now(UTC),
    }
    await get_collection(STAFF_SCAN_AUDIT_COLLECTION).insert_one(payload)


def _build_guest_owner_view(guest: Guest) -> GuestOwnerView:
    return GuestOwnerView(
        id=guest.id or "",
        full_name=guest.full_name,
        email=guest.email,
        phone=guest.phone,
        custom_notes=guest.custom_notes,
        category=guest.category,
        status=guest.status,
        qr_hash=guest.qr_hash,
        custom_fields=guest.custom_fields,
        check_in_logs=guest.check_in_logs,
        created_at=guest.created_at,
        status_updated_at=guest.status_updated_at,
    )


def _summarize_guests(guests: list[Guest]) -> GuestListSummary:
    pending = sum(1 for guest in guests if guest.status == GuestStatus.PENDING)
    approved = sum(1 for guest in guests if guest.status == GuestStatus.CHECKED_IN)
    checked_in = sum(1 for guest in guests if _guest_is_inside(guest))
    rejected = sum(1 for guest in guests if guest.status == GuestStatus.REJECTED)
    total = len(guests)
    completion_rate = round((checked_in / total) * 100, 1) if total else 0.0

    return GuestListSummary(
        total=total,
        pending=pending,
        approved=approved,
        checked_in=checked_in,
        rejected=rejected,
        completion_rate=completion_rate,
    )


async def _load_event_for_owner(owner_id: str, event_id: str):
    event = await get_event_by_id(event_id)
    if event is None or event.owner_id != owner_id:
        return None
    return event


async def _load_guest_by_id(guest_id: str) -> Guest | None:
    if not ObjectId.is_valid(guest_id):
        return None

    document = await get_collection(GUESTS_COLLECTION).find_one({"_id": ObjectId(guest_id)})
    if document is None:
        return None
    return _serialize_guest(document)


async def _save_guest_status(guest: Guest, status: GuestStatus) -> Guest | None:
    if guest.id is None:
        return None

    update: dict[str, object] = {
        "status": status,
        "status_updated_at": datetime.now(UTC),
    }

    set_payload = {
        "status": status.value,
        "status_updated_at": update["status_updated_at"],
    }

    await get_collection(GUESTS_COLLECTION).update_one(
        {"_id": ObjectId(guest.id)},
        {"$set": set_payload},
    )
    return await _load_guest_by_id(guest.id)


def _guest_is_inside(guest: Guest) -> bool:
    latest_log = _latest_movement_log(guest)
    if latest_log is None:
        return False
    return latest_log.status in {
        CheckInStatus.CHECKED_IN,
        CheckInStatus.RETURNED,
    }


def _latest_movement_log(guest: Guest) -> CheckInLog | None:
    movement_statuses = {
        CheckInStatus.CHECKED_IN,
        CheckInStatus.LEFT_BUILDING,
        CheckInStatus.RETURNED,
    }
    movement_logs = [
        log
        for log in guest.check_in_logs
        if log.status in movement_statuses
        and log.door_id != "auto_rsvp"
        and log.lookup_method != "rsvp"
    ]
    if not movement_logs:
        return None
    return max(movement_logs, key=lambda log: log.timestamp)


def _latest_log(guest: Guest) -> CheckInLog | None:
    if not guest.check_in_logs:
        return None
    return max(guest.check_in_logs, key=lambda log: log.timestamp)


async def _append_duplicate_scan_log(
    *,
    guest: Guest,
    door_id: str,
    lookup_method: str,
    reason: str,
) -> Guest | None:
    if guest.id is None:
        return None

    await get_collection(GUESTS_COLLECTION).update_one(
        {"_id": ObjectId(guest.id)},
        {
            "$push": {
                "check_in_logs": CheckInLog(
                    status=CheckInStatus.DUPLICATE_SCAN,
                    door_id=door_id,
                    action="duplicate_denied",
                    outcome="denied",
                    severity="warning",
                    lookup_method=lookup_method,
                    reason=reason,
                ).model_dump(mode="json")
            },
            "$set": {"status_updated_at": datetime.now(UTC)},
        },
    )
    return await _load_guest_by_id(guest.id)


async def _record_staff_movement(
    *,
    guest: Guest,
    mode: str,
    door_id: str,
    lookup_method: str,
) -> tuple[Guest | None, str, bool, str, str, str]:
    if guest.id is None:
        return None, "Guest could not be updated.", False, "update_failed", "Update Failed", "error"

    latest_movement = _latest_movement_log(guest)
    is_inside = latest_movement is not None and latest_movement.status in {
        CheckInStatus.CHECKED_IN,
        CheckInStatus.RETURNED,
    }
    if mode == "out":
        if not is_inside:
            reason = "Guest is already marked outside."
            updated_guest = await _append_duplicate_scan_log(
                guest=guest,
                door_id=door_id,
                lookup_method=lookup_method,
                reason=reason,
            )
            return (
                updated_guest or guest,
                f"Access denied. {reason}",
                False,
                "duplicate_denied",
                CheckInStatus.DUPLICATE_SCAN.value,
                "warning",
            )
        next_status = CheckInStatus.LEFT_BUILDING
        message = "Guest scanned out."
    else:
        if is_inside:
            previous_admin = latest_movement.door_id if latest_movement else "another scanner"
            reason = f"Guest is already inside from {previous_admin}."
            updated_guest = await _append_duplicate_scan_log(
                guest=guest,
                door_id=door_id,
                lookup_method=lookup_method,
                reason=reason,
            )
            return (
                updated_guest or guest,
                f"Access denied. {reason}",
                False,
                "duplicate_denied",
                CheckInStatus.DUPLICATE_SCAN.value,
                "warning",
            )
        next_status = (
            CheckInStatus.RETURNED
            if latest_movement and latest_movement.status == CheckInStatus.LEFT_BUILDING
            else CheckInStatus.CHECKED_IN
        )
        message = "Guest returned." if next_status == CheckInStatus.RETURNED else "Guest scanned in."

    await get_collection(GUESTS_COLLECTION).update_one(
        {"_id": ObjectId(guest.id)},
        {
            "$push": {
                "check_in_logs": CheckInLog(
                    status=next_status,
                    door_id=door_id,
                    action=_scan_action_for_status(next_status),
                    outcome="allowed",
                    severity="info",
                    lookup_method=lookup_method,
                ).model_dump(mode="json")
            },
            "$set": {"status_updated_at": datetime.now(UTC)},
        },
    )
    updated_guest = await _load_guest_by_id(guest.id)
    return updated_guest, message, True, _scan_action_for_status(next_status), next_status.value, "info"


async def list_event_guests(owner_id: str, event_id: str) -> dict[str, object] | None:
    event = await _load_event_for_owner(owner_id, event_id)
    if event is None:
        return None

    documents = await get_collection(GUESTS_COLLECTION).find({"event_id": ObjectId(event_id)}).to_list(length=5000)
    guests = [_serialize_guest(document) for document in documents]
    summary = _summarize_guests(guests)

    return {
        "event_id": event.id or event_id,
        "event_title": event.title,
        "guests": [_build_guest_owner_view(guest).model_dump(mode="json") for guest in guests],
        "summary": summary.model_dump(mode="json"),
    }


async def update_guest_status(owner_id: str, guest_id: str, status: GuestStatus) -> Guest | None:
    guest = await _load_guest_by_id(guest_id)
    if guest is None:
        return None

    event = await _load_event_for_owner(owner_id, guest.event_id)
    if event is None:
        return None

    return await _save_guest_status(guest, status)


async def resolve_staff_scan(
    share_token: str,
    qr_hash: str,
    mode: str = "in",
    pin_code: str | None = None,
    client_id: str | None = None,
) -> dict[str, object] | None:
    link = await get_admin_share_link_by_token(share_token)
    if link is None:
        return None

    event_id = link["event_id"]
    if not ObjectId.is_valid(event_id):
        return None

    event = await get_event_by_id(event_id)
    if event is None:
        return None
    admin_label = str(link.get("link_label") or "Admin")
    allowed_fields = list(event.configuration.allowed_admin_fields)

    if await _is_rate_limited(share_token, client_id):
        await _record_staff_scan_audit(
            share_token=share_token,
            event_id=event_id,
            admin_label=admin_label,
            action="rate_limited",
            outcome="denied",
            status="Rate Limited",
            lookup_method="qr",
            severity="high",
            reason="Too many denied attempts in a short time.",
            client_id=client_id,
        )
        return {
            "found": False,
            "accepted": False,
            "message": "Too many denied attempts. Please wait before scanning again.",
            "event_id": event_id,
            "event_title": event.title,
            "admin_label": admin_label,
            "allowed_admin_fields": allowed_fields,
            "guest": None,
        }

    if not bool(link.get("enabled", True)):
        return {
            "found": False,
            "accepted": False,
            "message": "Scanner access is disabled. Contact the host.",
            "event_id": event_id,
            "event_title": event.title,
            "admin_label": admin_label,
            "allowed_admin_fields": allowed_fields,
            "guest": None,
        }

    if link.get("pin_enabled") and str(link.get("pin_code") or "") != str(pin_code or ""):
        await _record_staff_scan_audit(
            share_token=share_token,
            event_id=event_id,
            admin_label=admin_label,
            action="pin_denied",
            outcome="denied",
            status="PIN Denied",
            lookup_method="qr",
            severity="high",
            reason="Incorrect scanner PIN.",
            client_id=client_id,
        )
        return {
            "found": False,
            "accepted": False,
            "message": "Incorrect scanner PIN.",
            "event_id": event_id,
            "event_title": event.title,
            "admin_label": admin_label,
            "allowed_admin_fields": allowed_fields,
            "guest": None,
        }

    guest_document = await get_collection(GUESTS_COLLECTION).find_one(
        {"event_id": ObjectId(event_id), "qr_hash": qr_hash}
    )
    if guest_document is None:
        await _record_staff_scan_audit(
            share_token=share_token,
            event_id=event_id,
            admin_label=admin_label,
            action="qr_not_found",
            outcome="denied",
            status="QR Not Found",
            lookup_method="qr",
            severity="warning",
            reason="No guest matched this QR code.",
            client_id=client_id,
        )
        return {
            "found": False,
            "accepted": False,
            "message": "No guest matched this QR code.",
            "event_id": event_id,
            "event_title": event.title,
            "admin_label": admin_label,
            "allowed_admin_fields": allowed_fields,
            "guest": None,
        }

    guest = _serialize_guest(guest_document)

    if guest.status != GuestStatus.CHECKED_IN:
        await _record_staff_scan_audit(
            share_token=share_token,
            event_id=event_id,
            admin_label=admin_label,
            action="not_approved_denied",
            outcome="denied",
            status="Not Approved",
            lookup_method="qr",
            severity="high",
            reason="Guest is not approved for entry.",
            guest=guest,
            client_id=client_id,
        )
        return {
            "found": False,
            "accepted": False,
            "message": "Guest is not approved for entry.",
            "event_id": event_id,
            "event_title": event.title,
            "admin_label": admin_label,
            "allowed_admin_fields": allowed_fields,
            "guest": None,
        }

    updated_guest, message, accepted, action, status, severity = await _record_staff_movement(
        guest=guest,
        mode=mode,
        door_id=admin_label,
        lookup_method="qr",
    )
    if updated_guest is None:
        return None
    await _record_staff_scan_audit(
        share_token=share_token,
        event_id=event_id,
        admin_label=admin_label,
        action=action,
        outcome="allowed" if accepted else "denied",
        status=status,
        lookup_method="qr",
        severity=severity,
        reason=None if accepted else message.replace("Access denied. ", ""),
        guest=updated_guest,
        client_id=client_id,
    )

    return {
        "found": True,
        "accepted": accepted,
        "message": message,
        "event_id": event_id,
        "event_title": event.title,
        "admin_label": admin_label,
        "allowed_admin_fields": allowed_fields,
        "guest": _build_guest_staff_view(updated_guest, allowed_fields).model_dump(mode="json"),
    }


async def resolve_staff_name_scan(
    payload: GuestNameScanRequest,
    client_id: str | None = None,
) -> dict[str, object] | None:
    link = await get_admin_share_link_by_token(payload.share_token)
    if link is None:
        return None

    event_id = link["event_id"]
    if not ObjectId.is_valid(event_id):
        return None

    event = await get_event_by_id(event_id)
    if event is None:
        return None
    admin_label = str(link.get("link_label") or "Admin")
    allowed_fields = list(event.configuration.allowed_admin_fields)

    if await _is_rate_limited(payload.share_token, client_id):
        await _record_staff_scan_audit(
            share_token=payload.share_token,
            event_id=event_id,
            admin_label=admin_label,
            action="rate_limited",
            outcome="denied",
            status="Rate Limited",
            lookup_method="name",
            severity="high",
            reason="Too many denied attempts in a short time.",
            attempted_name=payload.full_name,
            client_id=client_id,
        )
        return {
            "found": False,
            "accepted": False,
            "message": "Too many denied attempts. Please wait before scanning again.",
            "event_id": event_id,
            "event_title": event.title,
            "admin_label": admin_label,
            "allowed_admin_fields": allowed_fields,
            "guest": None,
        }

    if not bool(link.get("enabled", True)):
        return {
            "found": False,
            "accepted": False,
            "message": "Scanner access is disabled. Contact the host.",
            "event_id": event_id,
            "event_title": event.title,
            "admin_label": admin_label,
            "allowed_admin_fields": allowed_fields,
            "guest": None,
        }

    if link.get("pin_enabled") and str(link.get("pin_code") or "") != str(payload.pin_code or ""):
        await _record_staff_scan_audit(
            share_token=payload.share_token,
            event_id=event_id,
            admin_label=admin_label,
            action="pin_denied",
            outcome="denied",
            status="PIN Denied",
            lookup_method="name",
            severity="high",
            reason="Incorrect scanner PIN.",
            attempted_name=payload.full_name,
            client_id=client_id,
        )
        return {
            "found": False,
            "accepted": False,
            "message": "Incorrect scanner PIN.",
            "event_id": event_id,
            "event_title": event.title,
            "admin_label": admin_label,
            "allowed_admin_fields": allowed_fields,
            "guest": None,
        }

    lookup_name = _normalize_lookup_name(payload.full_name)
    guest_documents = await get_collection(GUESTS_COLLECTION).find(
        {"event_id": ObjectId(event_id)}
    ).to_list(length=5000)
    matches = [
        _serialize_guest(document)
        for document in guest_documents
        if str(document.get("normalized_full_name") or _normalize_lookup_name(str(document.get("full_name", "")))) == lookup_name
    ]

    if not matches:
        await _record_staff_scan_audit(
            share_token=payload.share_token,
            event_id=event_id,
            admin_label=admin_label,
            action="name_not_found",
            outcome="denied",
            status="Name Not Found",
            lookup_method="name",
            severity="warning",
            reason="No guest matched this full name.",
            attempted_name=payload.full_name,
            client_id=client_id,
        )
        return {
            "found": False,
            "accepted": False,
            "message": "No guest matched this full name.",
            "event_id": event_id,
            "event_title": event.title,
            "admin_label": admin_label,
            "allowed_admin_fields": allowed_fields,
            "guest": None,
        }

    if len(matches) > 1:
        await _record_staff_scan_audit(
            share_token=payload.share_token,
            event_id=event_id,
            admin_label=admin_label,
            action="name_ambiguous",
            outcome="denied",
            status="Name Ambiguous",
            lookup_method="name",
            severity="warning",
            reason="Multiple guests match this name.",
            attempted_name=payload.full_name,
            client_id=client_id,
        )
        return {
            "found": False,
            "accepted": False,
            "message": "Multiple guests match this name. Please use the QR code.",
            "event_id": event_id,
            "event_title": event.title,
            "admin_label": admin_label,
            "allowed_admin_fields": allowed_fields,
            "guest": None,
        }

    guest = matches[0]
    if guest.status != GuestStatus.CHECKED_IN:
        await _record_staff_scan_audit(
            share_token=payload.share_token,
            event_id=event_id,
            admin_label=admin_label,
            action="not_approved_denied",
            outcome="denied",
            status="Not Approved",
            lookup_method="name",
            severity="high",
            reason="Guest is not approved for entry.",
            guest=guest,
            attempted_name=payload.full_name,
            client_id=client_id,
        )
        return {
            "found": True,
            "accepted": False,
            "message": "Guest is not approved for entry.",
            "event_id": event_id,
            "event_title": event.title,
            "admin_label": admin_label,
            "allowed_admin_fields": allowed_fields,
            "guest": _build_guest_staff_view(
                guest,
                allowed_fields,
            ).model_dump(mode="json"),
        }

    updated_guest, message, accepted, action, status, severity = await _record_staff_movement(
        guest=guest,
        mode=payload.mode,
        door_id=admin_label,
        lookup_method="name",
    )
    if updated_guest is None:
        return None
    await _record_staff_scan_audit(
        share_token=payload.share_token,
        event_id=event_id,
        admin_label=admin_label,
        action=action,
        outcome="allowed" if accepted else "denied",
        status=status,
        lookup_method="name",
        severity=severity,
        reason=None if accepted else message.replace("Access denied. ", ""),
        guest=updated_guest,
        attempted_name=payload.full_name,
        client_id=client_id,
    )

    return {
        "found": True,
        "accepted": accepted,
        "message": message,
        "event_id": event_id,
        "event_title": event.title,
        "admin_label": admin_label,
        "allowed_admin_fields": allowed_fields,
        "guest": _build_guest_staff_view(updated_guest, allowed_fields).model_dump(mode="json"),
    }


async def get_staff_scanner_context(share_token: str) -> dict[str, object] | None:
    link = await get_admin_share_link_by_token(share_token)
    if link is None:
        return None

    event_id = link["event_id"]
    if not ObjectId.is_valid(event_id):
        return None

    event = await get_event_by_id(event_id)
    if event is None:
        return None

    return GuestScannerContextResponse(
        event_id=event_id,
        event_title=event.title,
        admin_label=str(link.get("link_label") or "Admin"),
        enabled=bool(link.get("enabled", True)),
        pin_required=bool(link.get("pin_enabled", False)),
    ).model_dump(mode="json")


async def check_in_guest_from_staff(
    payload: GuestStaffCheckInRequest,
) -> dict[str, object] | None:
    link = await resolve_admin_share_link(payload.share_token)
    if link is None:
        return None

    event_id = link["event_id"]
    if not ObjectId.is_valid(event_id) or not ObjectId.is_valid(payload.guest_id):
        return None

    guest = await _load_guest_by_id(payload.guest_id)
    if guest is None or guest.event_id != event_id:
        return None

    # ─── NEW: Only allow PENDING guests to check in ───
    if guest.status != GuestStatus.PENDING:
        status_msg = "already checked in" if guest.status == GuestStatus.CHECKED_IN else "rejected"
        return {
            "found": False,
            "message": f"Guest cannot be checked in – status is {status_msg}.",
            "event_id": event_id,
            "event_title": (await get_event_by_id(event_id)).title if await get_event_by_id(event_id) else "Unknown",
            "admin_label": link.get("link_label", "Admin"),
            "allowed_admin_fields": [],
            "guest": None,
        }

    updated_guest = await _save_guest_status(guest, GuestStatus.CHECKED_IN)
    if updated_guest is None:
        return None

    event = await get_event_by_id(event_id)
    if event is None:
        return None

    allowed_fields = list(event.configuration.allowed_admin_fields)
    return {
        "found": True,
        "message": "Guest approved and checked in.",
        "event_id": event_id,
        "event_title": event.title,
        "admin_label": link.get("link_label", "Admin"),
        "allowed_admin_fields": allowed_fields,
        "guest": _build_guest_staff_view(updated_guest, allowed_fields).model_dump(mode="json"),
    }


async def register_guest_self(
    event_id: str,
    full_name: str,
    email: str | None = None,
    phone: str | None = None,
    custom_fields: dict[str, Any] | None = None,
) -> Guest:
    """
    Public guest self‑registration.
    - Checks for duplicates by full_name (and email if provided).
    - If the event does NOT require RSVP approval, the guest is automatically checked in.
    - Otherwise, the guest is created with PENDING status.
    - Returns the guest record (existing or newly created).
    """
    # 1. Fetch the event to check approval settings
    event = await get_event_by_id(event_id)
    if event is None:
        raise ValueError("Event not found")
    if event.design_status != EventDesignStatus.PUBLISHED:
        raise HTTPException(
            status_code=http_status.HTTP_409_CONFLICT,
            detail="This invitation is still a draft. Convert it in the editor before accepting guests.",
        )

    # 2. Check for duplicates (same name or email for this event)
    filters: list[dict[str, Any]] = [{"full_name": full_name.strip()}]
    if email:
        filters.append({"email": email})

    existing_doc = await get_collection(GUESTS_COLLECTION).find_one({
        "event_id": ObjectId(event_id),
        "$or": filters,
    })
    if existing_doc:
        return _serialize_guest(existing_doc)

    # 2.5 Enforce the event owner's plan before inserting a new guest.
    guest_limit = await check_guest_limit(event_id)
    if not guest_limit["allowed"]:
        tier_label = str(guest_limit["tier"]).title()
        raise HTTPException(
            status_code=http_status.HTTP_402_PAYMENT_REQUIRED,
            detail=(
                f"The {tier_label} plan supports up to {guest_limit['limit']} guests "
                "per event. Upgrade in the GatherVia mobile app to add more guests."
            ),
        )

    # 3. Determine initial status based on event approval setting
    auto_approve = not event.require_rsvp_approval  # False means auto‑approve
    status = GuestStatus.CHECKED_IN if auto_approve else GuestStatus.PENDING

    # 4. Build guest payload
    qr_hash = token_hex(16)
    payload: dict[str, Any] = {
        "event_id": ObjectId(event_id),
        "full_name": full_name.strip(),
        "normalized_full_name": _normalize_lookup_name(full_name),
        "email": email,
        "phone": phone,
        "category": GuestCategory.GENERAL.value,
        "status": status.value,           # <-- use the computed status
        "qr_hash": qr_hash,
        "custom_fields": custom_fields or {},
        "custom_notes": None,
        "check_in_logs": [],
        "created_at": datetime.now(UTC),
        "status_updated_at": datetime.now(UTC),
    }

    # Approval activates the pass; only a doorman scan records physical arrival.
    result = await get_collection(GUESTS_COLLECTION).insert_one(payload)
    document = await get_collection(GUESTS_COLLECTION).find_one({"_id": result.inserted_id})
    assert document is not None
    return _serialize_guest(document)


async def create_guest_for_owner(
    owner_id: str,
    event_id: str,
    full_name: str,
    email: str | None = None,
    phone: str | None = None,
    custom_fields: dict[str, Any] | None = None,
) -> Guest:
    """Create an approved guest through the authenticated host workflow."""
    event = await _load_event_for_owner(owner_id, event_id)
    if event is None:
        raise ValueError("Event not found for the authenticated user.")
    if event.design_status != EventDesignStatus.PUBLISHED:
        raise HTTPException(
            status_code=http_status.HTTP_409_CONFLICT,
            detail="Convert the invitation in the editor before adding guests.",
        )

    filters: list[dict[str, Any]] = [{"full_name": full_name.strip()}]
    if email:
        filters.append({"email": email})
    existing = await get_collection(GUESTS_COLLECTION).find_one(
        {"event_id": ObjectId(event_id), "$or": filters}
    )
    if existing is not None:
        raise HTTPException(
            status_code=http_status.HTTP_409_CONFLICT,
            detail="This guest is already on the event list.",
        )

    guest = await register_guest_self(
        event_id=event_id,
        full_name=full_name,
        email=email,
        phone=phone,
        custom_fields=custom_fields,
    )
    if guest.status == GuestStatus.CHECKED_IN:
        return guest
    approved = await _save_guest_status(guest, GuestStatus.CHECKED_IN)
    return approved or guest


async def get_event_analytics(event_id: str, owner_id: str) -> dict[str, Any] | None:
    """Return aggregated analytics for the host dashboard."""
    event = await _load_event_for_owner(owner_id, event_id)
    if event is None:
        return None

    documents = await get_collection(GUESTS_COLLECTION).find(
        {"event_id": ObjectId(event_id)}
    ).to_list(length=5000)

    guests = [_serialize_guest(doc) for doc in documents]
    summary = _summarize_guests(guests)

    # Check-in timeline (by hour) – 12‑hour labels
    hour_counts: dict[str, int] = {}
    for guest in guests:
        for log in guest.check_in_logs:
            if log.status == "Checked In":
                dt = log.timestamp
                hour = dt.hour
                label = f"{hour % 12 or 12} {'AM' if hour < 12 else 'PM'}"
                hour_counts[label] = hour_counts.get(label, 0) + 1

    # Sort by actual hour for proper ordering
    def sort_key(label: str) -> int:
        parts = label.split()
        h = int(parts[0])
        if parts[1] == "PM" and h != 12:
            h += 12
        elif parts[1] == "AM" and h == 12:
            h = 0
        return h

    timeline = [
        {"hour": h, "count": c}
        for h, c in sorted(hour_counts.items(), key=lambda x: sort_key(x[0]))
    ]

    # Category breakdown
    cat_counts: dict[str, int] = {}
    for guest in guests:
        cat = str(guest.category)
        cat_counts[cat] = cat_counts.get(cat, 0) + 1
    categories = [{"category": cat, "count": c} for cat, c in cat_counts.items()]

    # Recent activity (last 20 scan events)
    all_logs = []
    for guest in guests:
        for log in guest.check_in_logs:
            all_logs.append({
                "id": str(uuid4()),
                "guest_name": guest.full_name,
                "action": str(log.status),
                "timestamp": log.timestamp.isoformat(),
                "category": str(guest.category),
            })
    all_logs.sort(key=lambda x: x["timestamp"], reverse=True)

    # Duplicate scan attempts
    duplicates = [
        log for log in all_logs if log["action"] == "Duplicate Scan"
    ]

    return {
        "summary": summary.model_dump(),
        "checkInTimeline": timeline,
        "categoryBreakdown": categories,
        "recentActivity": all_logs[:20],
        "duplicateAttempts": duplicates[:20],
    }
