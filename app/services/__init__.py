"""Business logic layer for the events management system.

Service modules stay lazy so an isolated helper does not pull in the entire model graph.
"""

from typing import Any


def mask_guest_for_admin_view(*args: Any, **kwargs: Any) -> Any:
    from app.services.privacy import mask_guest_for_admin_view as implementation

    return implementation(*args, **kwargs)


def mask_guest_from_configuration(*args: Any, **kwargs: Any) -> Any:
    from app.services.privacy import mask_guest_from_configuration as implementation

    return implementation(*args, **kwargs)


def mask_guest_from_event(*args: Any, **kwargs: Any) -> Any:
    from app.services.privacy import mask_guest_from_event as implementation

    return implementation(*args, **kwargs)

__all__ = [
    "mask_guest_for_admin_view",
    "mask_guest_from_configuration",
    "mask_guest_from_event",
]
