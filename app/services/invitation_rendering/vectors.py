from __future__ import annotations

import re

from PIL import Image, ImageDraw
from svg.path import Close, Move, parse_path


def polygon_mask(size: tuple[int, int], points: str | None) -> Image.Image:
    width, height = size
    mask = Image.new("L", size)
    parsed: list[tuple[float, float]] = []
    for pair in re.split(r"\s+", (points or "").strip()):
        if not pair or "," not in pair:
            continue
        x_value, y_value = pair.split(",", 1)
        try:
            x = float(x_value.rstrip("%"))
            y = float(y_value.rstrip("%"))
        except ValueError:
            continue
        parsed.append((width * x / 100, height * y / 100))
    if len(parsed) >= 3:
        ImageDraw.Draw(mask).polygon(parsed, fill=255)
    return mask


def path_masks(size: tuple[int, int], path_data: str | None, stroke_width: int) -> tuple[Image.Image, Image.Image]:
    fill_mask = Image.new("L", size)
    stroke_mask = Image.new("L", size)
    if not path_data:
        return fill_mask, stroke_mask
    try:
        path = parse_path(path_data)
    except (ValueError, IndexError):
        return fill_mask, stroke_mask

    scale_x, scale_y = size[0] / 100, size[1] / 100

    def scaled(point: complex) -> tuple[float, float]:
        return point.real * scale_x, point.imag * scale_y

    subpaths: list[list[tuple[float, float]]] = []
    current: list[tuple[float, float]] = []
    for segment in path:
        if isinstance(segment, Move):
            if current:
                subpaths.append(current)
            current = [scaled(segment.end)]
            continue
        samples = 1 if isinstance(segment, Close) else 24
        for index in range(1, samples + 1):
            current.append(scaled(segment.point(index / samples)))
        if isinstance(segment, Close) and current:
            subpaths.append(current)
            current = []
    if current:
        subpaths.append(current)

    fill_draw = ImageDraw.Draw(fill_mask)
    stroke_draw = ImageDraw.Draw(stroke_mask)
    for points in subpaths:
        if len(points) >= 3 and points[0] == points[-1]:
            fill_draw.polygon(points, fill=255)
        if len(points) >= 2 and stroke_width > 0:
            stroke_draw.line(points, fill=255, width=stroke_width, joint="curve")
    return fill_mask, stroke_mask
