from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any


REGISTRY_PATH = Path(__file__).resolve().parents[3] / "shared" / "font-registry.json"


@lru_cache(maxsize=1)
def _registry() -> dict[str, Any]:
    return json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def _family_by_alias() -> dict[str, str]:
    aliases: dict[str, str] = {}
    for font in _registry()["families"]:
        family = str(font["family"])
        for name in (family, *font.get("aliases", [])):
            aliases[str(name).strip().casefold()] = family
    return aliases


def _first_css_family(value: object) -> str:
    family = str(value or "").split(",", 1)[0].strip().strip("\"'").strip()
    return family


def normalize_font_family(value: object) -> str:
    requested = _first_css_family(value).casefold()
    return _family_by_alias().get(requested, str(_registry()["defaultFamily"]))


def bundled_font_families() -> tuple[str, ...]:
    return tuple(str(font["family"]) for font in _registry()["families"])
