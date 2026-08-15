from collections.abc import Callable
from typing import Any

from app.models.event import Event, EventConfiguration
from app.models.guest import Guest

GuestFieldExtractor = Callable[[Guest], Any]

# Canonical mapping from event `allowed_admin_fields` keys to guest data extractors.
# Custom/event-specific keys resolve from `Guest.custom_fields`.
ADMIN_FIELD_REGISTRY: dict[str, GuestFieldExtractor] = {
    "id": lambda guest: guest.id,
    "name": lambda guest: guest.full_name,
    "full_name": lambda guest: guest.full_name,
    "email": lambda guest: guest.email,
    "phone": lambda guest: guest.phone,
    "category": lambda guest: guest.category,
    "status": lambda guest: guest.status,
    "custom_notes": lambda guest: guest.custom_notes,
    "check_in_logs": lambda guest: [
        log.model_dump(mode="json") for log in guest.check_in_logs
    ],
    "latest_check_in_status": lambda guest: (
        guest.check_in_logs[-1].status if guest.check_in_logs else None
    ),
}


def _extract_admin_field(guest: Guest, field_key: str) -> Any:
    """Resolve a single admin-visible field from a guest record."""
    extractor = ADMIN_FIELD_REGISTRY.get(field_key)
    if extractor is not None:
        return extractor(guest)
    if field_key in guest.custom_fields:
        return guest.custom_fields[field_key]
    return None


def mask_guest_for_admin_view(
    guest: Guest,
    allowed_fields: list[str],
    *,
    include_null_values: bool = False,
) -> dict[str, Any]:
    """
    Filter a guest down to only the properties permitted by the parent event config.

    Args:
        guest: Full guest document loaded from the database.
        allowed_fields: Keys from `Event.configuration.allowed_admin_fields`.
        include_null_values: When False, keys with None values are omitted from output.

    Returns:
        Masked dictionary safe to expose to event staff with limited permissions.
    """
    masked: dict[str, Any] = {}

    for field_key in allowed_fields:
        value = _extract_admin_field(guest, field_key)
        if value is None and not include_null_values:
            continue
        masked[field_key] = value

    return masked


def mask_guest_from_event(
    guest: Guest,
    event: Event,
    *,
    include_null_values: bool = False,
) -> dict[str, Any]:
    """Convenience wrapper using the parent event's configured allowed_admin_fields."""
    return mask_guest_for_admin_view(
        guest,
        event.configuration.allowed_admin_fields,
        include_null_values=include_null_values,
    )


def mask_guest_from_configuration(
    guest: Guest,
    configuration: EventConfiguration,
    *,
    include_null_values: bool = False,
) -> dict[str, Any]:
    """Convenience wrapper using an event configuration sub-document directly."""
    return mask_guest_for_admin_view(
        guest,
        configuration.allowed_admin_fields,
        include_null_values=include_null_values,
    )
