from __future__ import annotations

import re
import unicodedata
from datetime import date


def slugify_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_text.lower()).strip("-")
    return re.sub(r"-+", "-", slug) or "event"


def build_event_slug(title: str, event_date: date) -> str:
    return f"{slugify_text(title)}-{event_date.isoformat()}"
