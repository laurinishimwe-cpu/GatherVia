from __future__ import annotations

import math
import re
from dataclasses import dataclass

from PIL import Image, ImageColor


@dataclass(frozen=True)
class ColorStop:
    color: tuple[int, int, int, int]
    position: float


_GRADIENT_RE = re.compile(r"^(linear|radial)-gradient\((.*)\)$", re.IGNORECASE | re.DOTALL)
_ANGLE_RE = re.compile(r"^(-?\d+(?:\.\d+)?)deg$", re.IGNORECASE)
_STOP_RE = re.compile(r"^(.*?)\s+(-?\d+(?:\.\d+)?)%$")


def parse_color(value: str | None, fallback: str = "#000000") -> tuple[int, int, int, int]:
    candidate = (value or fallback).strip()
    if candidate.lower() == "transparent":
        return 0, 0, 0, 0
    rgba = re.fullmatch(
        r"rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+)\s*)?\)",
        candidate,
        re.IGNORECASE,
    )
    if rgba:
        alpha = float(rgba.group(4)) if rgba.group(4) is not None else 1.0
        return (
            min(255, int(rgba.group(1))),
            min(255, int(rgba.group(2))),
            min(255, int(rgba.group(3))),
            round(max(0.0, min(1.0, alpha)) * 255),
        )
    try:
        return ImageColor.getcolor(candidate, "RGBA")
    except ValueError:
        return ImageColor.getcolor(fallback, "RGBA")


def split_css_arguments(value: str) -> list[str]:
    result: list[str] = []
    start = 0
    depth = 0
    for index, character in enumerate(value):
        if character == "(":
            depth += 1
        elif character == ")":
            depth = max(0, depth - 1)
        elif character == "," and depth == 0:
            result.append(value[start:index].strip())
            start = index + 1
    result.append(value[start:].strip())
    return [part for part in result if part]


def _stops(parts: list[str]) -> list[ColorStop]:
    parsed: list[tuple[tuple[int, int, int, int], float | None]] = []
    for part in parts:
        match = _STOP_RE.match(part)
        color_value = match.group(1).strip() if match else part
        position = float(match.group(2)) / 100 if match else None
        parsed.append((parse_color(color_value), position))
    if not parsed:
        return []
    count = len(parsed)
    explicit = {index: position for index, (_, position) in enumerate(parsed) if position is not None}
    if 0 not in explicit:
        explicit[0] = 0.0
    if count - 1 not in explicit:
        explicit[count - 1] = 1.0
    stops: list[ColorStop] = []
    anchors = sorted(explicit)
    for index, (color, position) in enumerate(parsed):
        if position is None:
            left = max(anchor for anchor in anchors if anchor < index)
            right = min(anchor for anchor in anchors if anchor > index)
            span = right - left
            position = explicit[left] + (explicit[right] - explicit[left]) * ((index - left) / span)
        stops.append(ColorStop(color, max(0.0, min(1.0, position))))
    return sorted(stops, key=lambda stop: stop.position)


def _interpolate(stops: list[ColorStop], value: float) -> tuple[int, int, int, int]:
    value = max(0.0, min(1.0, value))
    left = stops[0]
    right = stops[-1]
    for candidate in stops[1:]:
        if value <= candidate.position:
            right = candidate
            break
        left = candidate
    distance = right.position - left.position
    ratio = 0.0 if distance <= 0 else (value - left.position) / distance
    return tuple(round(a + (b - a) * ratio) for a, b in zip(left.color, right.color))  # type: ignore[return-value]


def create_paint(value: str | None, size: tuple[int, int], fallback: str = "#000000") -> Image.Image:
    width, height = max(1, size[0]), max(1, size[1])
    source = (value or fallback).strip()
    match = _GRADIENT_RE.match(source)
    if not match:
        return Image.new("RGBA", (width, height), parse_color(source, fallback))

    kind = match.group(1).lower()
    parts = split_css_arguments(match.group(2))
    angle = 180.0
    if kind == "linear" and parts:
        angle_match = _ANGLE_RE.match(parts[0])
        if angle_match:
            angle = float(angle_match.group(1))
            parts = parts[1:]
    stops = _stops(parts)
    if not stops:
        return Image.new("RGBA", (width, height), parse_color(fallback))

    sample_scale = min(1.0, 256 / max(width, height))
    sample_width = max(1, round(width * sample_scale))
    sample_height = max(1, round(height * sample_scale))
    pixels: list[tuple[int, int, int, int]] = []
    if kind == "linear":
        radians = math.radians(angle)
        dx, dy = math.sin(radians), -math.cos(radians)
        extent = abs(sample_width * dx) + abs(sample_height * dy)
        start_x = sample_width / 2 - dx * extent / 2
        start_y = sample_height / 2 - dy * extent / 2
        denominator = max(extent, 1e-6)
        for y in range(sample_height):
            for x in range(sample_width):
                position = ((x - start_x) * dx + (y - start_y) * dy) / denominator
                pixels.append(_interpolate(stops, position))
    else:
        center_x, center_y = sample_width / 2, sample_height / 2
        radius = max(sample_width, sample_height) / 2
        for y in range(sample_height):
            for x in range(sample_width):
                pixels.append(_interpolate(stops, math.hypot(x - center_x, y - center_y) / radius))
    image = Image.new("RGBA", (sample_width, sample_height))
    image.putdata(pixels)
    if image.size != (width, height):
        image = image.resize((width, height), Image.Resampling.LANCZOS)
    return image


def apply_paint(target: Image.Image, mask: Image.Image, value: str | None, fallback: str) -> None:
    target.alpha_composite(Image.composite(create_paint(value, target.size, fallback), Image.new("RGBA", target.size), mask))
