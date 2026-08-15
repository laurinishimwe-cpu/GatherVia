from __future__ import annotations

import io
import logging
import math
import re
from collections.abc import Mapping, Sequence
from typing import Any

import qrcode
from PIL import Image, ImageChops, ImageDraw, ImageFilter

from app.services.invitation_rendering.assets import AssetLoadError, cover_image, load_image
from app.services.invitation_rendering.constants import (
    BADGE_HEIGHT,
    BADGE_HORIZONTAL_PADDING,
    BADGE_MIN_WIDTH,
    CANVAS_HEIGHT,
    CANVAS_WIDTH,
    CURVE_CONTROL_FACTOR,
    CURVE_DEPTH,
    DETAILS_FONT_SIZE,
    DETAILS_GAP,
    DETAILS_ICON_SIZE,
    DETAILS_WIDTH_PERCENT,
    FOOTER_BOTTOM_PERCENT,
    FOOTER_FONT_SIZE,
    MIN_QR_BOTTOM_PERCENT,
    QR_PADDING,
    QR_RADIUS,
    SCALE,
    SECURE_QR_BACKGROUND,
    SECURE_QR_FOREGROUND,
    STUB_HEIGHT,
    SUPPORTED_LAYER_TYPES,
    TOP_HEIGHT,
)
from app.services.invitation_rendering.paint import create_paint, parse_color
from app.services.invitation_rendering.typography import (
    fit_single_line_mask,
    render_text_mask,
    resolve_font,
)
from app.services.invitation_rendering.vectors import path_masks, polygon_mask


logger = logging.getLogger(__name__)


class InvitationRenderError(RuntimeError):
    pass


class InvitationRenderDependencyError(InvitationRenderError):
    pass


def _snake_to_camel(key: str) -> str:
    head, *tail = key.split("_")
    return head + "".join(part[:1].upper() + part[1:] for part in tail)


def _camel_to_snake(key: str) -> str:
    return re.sub(r"(?<!^)(?=[A-Z])", "_", key).lower()


def _mapping(value: Any) -> dict[str, Any]:
    if hasattr(value, "model_dump"):
        try:
            data = value.model_dump(mode="python", by_alias=True)
        except TypeError:
            # Compatibility with older Pydantic-style model_dump wrappers.
            data = value.model_dump(mode="python")
    elif isinstance(value, Mapping):
        data = dict(value)
    else:
        raise InvitationRenderError("Renderer input must be a mapping or Pydantic model.")

    # The browser payload uses camelCase for CanvasLayer fields while Python and
    # MongoDB models may expose snake_case. Preserve the original keys and add
    # the equivalent spelling so both paths render the same saved document.
    normalized = dict(data)
    for key, item in data.items():
        if not isinstance(key, str):
            continue
        if "_" in key:
            normalized.setdefault(_snake_to_camel(key), item)
        if any(character.isupper() for character in key):
            normalized.setdefault(_camel_to_snake(key), item)
    return normalized


def _number(value: Any, fallback: float = 0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def _top_mask() -> Image.Image:
    mask = Image.new("L", (CANVAS_WIDTH, CANVAS_HEIGHT))
    points: list[tuple[float, float]] = [(0, 0), (CANVAS_WIDTH, 0), (CANVAS_WIDTH, TOP_HEIGHT - CURVE_DEPTH)]
    start_x, start_y = CANVAS_WIDTH, TOP_HEIGHT - CURVE_DEPTH
    control_x, control_y = (
        CANVAS_WIDTH / 2,
        TOP_HEIGHT + CURVE_DEPTH * CURVE_CONTROL_FACTOR,
    )
    end_x, end_y = 0, TOP_HEIGHT - CURVE_DEPTH
    for index in range(1, 65):
        t = index / 64
        inverse = 1 - t
        points.append(
            (
                inverse * inverse * start_x + 2 * inverse * t * control_x + t * t * end_x,
                inverse * inverse * start_y + 2 * inverse * t * control_y + t * t * end_y,
            )
        )
    ImageDraw.Draw(mask).polygon(points, fill=255)
    return mask


def _rounded_mask(size: tuple[int, int], radius: float) -> Image.Image:
    mask = Image.new("L", size)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=max(0, radius), fill=255)
    return mask


def _paint_into(target: Image.Image, mask: Image.Image, value: str | None, fallback: str) -> None:
    target.alpha_composite(Image.composite(create_paint(value, target.size, fallback), Image.new("RGBA", target.size), mask))


def _qr_image(
    value: str,
    size: tuple[int, int],
    foreground: str = "#000000",
    background: str = "#ffffff",
    background_transparent: bool = False,
) -> Image.Image:
    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, border=1, box_size=10)
    qr.add_data(value)
    qr.make(fit=True)
    monochrome = qr.make_image(fill_color="black", back_color="white").convert("L")
    monochrome = monochrome.resize(size, Image.Resampling.NEAREST)
    module_mask = monochrome.point(lambda pixel: 255 if pixel < 128 else 0)
    result = Image.new(
        "RGBA",
        size,
        (0, 0, 0, 0) if background_transparent else parse_color(background, "#ffffff"),
    )
    result.paste(
        Image.new("RGBA", size, parse_color(foreground, "#000000")),
        mask=module_mask,
    )
    return result


def _render_layer(layer: dict[str, Any], guest_qr_hash: str) -> Image.Image:
    width = max(1, round(_number(layer.get("width")) * CANVAS_WIDTH / 100))
    height = max(1, round(_number(layer.get("height")) * TOP_HEIGHT / 100))
    layer_type = layer.get("type")
    result = Image.new("RGBA", (width, height))
    radius = max(0, _number(layer.get("borderRadius")) * SCALE)
    stroke_width = max(0, round(_number(layer.get("strokeWidth")) * SCALE))

    if layer_type == "text":
        mask = render_text_mask(
            layer.get("text") or "",
            result.size,
            layer.get("fontFamily") or "Arial",
            _number(layer.get("fontSize"), 16),
            str(layer.get("fontWeight") or "normal"),
            str(layer.get("fontStyle") or "normal"),
            str(layer.get("textAlign") or "center"),
            SCALE,
        )
        _paint_into(result, mask, layer.get("color") or layer.get("fill"), "#000000")
    elif layer_type in {"rect", "frame"}:
        fill_mask = _rounded_mask(result.size, radius)
        _paint_into(result, fill_mask, layer.get("fill"), "transparent")
        if stroke_width:
            stroke_mask = Image.new("L", result.size)
            ImageDraw.Draw(stroke_mask).rounded_rectangle(
                (stroke_width / 2, stroke_width / 2, width - 1 - stroke_width / 2, height - 1 - stroke_width / 2),
                radius=radius,
                outline=255,
                width=stroke_width,
            )
            _paint_into(result, stroke_mask, layer.get("stroke"), "#000000")
    elif layer_type == "ellipse":
        fill_mask = Image.new("L", result.size)
        ImageDraw.Draw(fill_mask).ellipse((0, 0, width - 1, height - 1), fill=255)
        _paint_into(result, fill_mask, layer.get("fill"), "transparent")
        if stroke_width:
            stroke_mask = Image.new("L", result.size)
            ImageDraw.Draw(stroke_mask).ellipse(
                (stroke_width / 2, stroke_width / 2, width - 1 - stroke_width / 2, height - 1 - stroke_width / 2),
                outline=255,
                width=stroke_width,
            )
            _paint_into(result, stroke_mask, layer.get("stroke"), "#000000")
    elif layer_type == "polygon":
        fill_mask = polygon_mask(result.size, layer.get("points"))
        _paint_into(result, fill_mask, layer.get("fill"), "transparent")
        if stroke_width:
            outline = fill_mask.filter(ImageFilter.MaxFilter(max(3, stroke_width * 2 + 1)))
            outline = ImageChops.subtract(outline, fill_mask)
            _paint_into(result, outline, layer.get("stroke"), "#000000")
    elif layer_type == "path":
        fill_mask, stroke_mask = path_masks(result.size, layer.get("pathData"), stroke_width)
        if layer.get("closed", False):
            _paint_into(result, fill_mask, layer.get("fill"), "transparent")
        if stroke_width:
            _paint_into(result, stroke_mask, layer.get("stroke"), "#000000")
    elif layer_type == "image" and layer.get("imageUrl"):
        source = str(layer["imageUrl"])
        try:
            # SVGs are rasterized at this layer's output resolution before the
            # normal object-cover crop. Raster images keep the same pipeline.
            image = cover_image(
                load_image(source, raster_size=result.size),
                result.size,
            )
            if radius:
                image.putalpha(
                    Image.composite(
                        image.getchannel("A"),
                        Image.new("L", result.size),
                        _rounded_mask(result.size, radius),
                    )
                )
            result.alpha_composite(image)
        except AssetLoadError as exc:
            # A bad optional image should not cancel the full invitation render,
            # but it must no longer disappear without a diagnostic.
            logger.warning(
                "Invitation image layer %s could not be rendered from %s: %s",
                layer.get("id", "<unknown>"),
                source[:240],
                exc,
            )
    elif layer_type == "qr":
        fill_mask = _rounded_mask(result.size, radius)
        _paint_into(result, fill_mask, layer.get("fill"), "#ffffff")
        qr_layer = _qr_image(str(layer.get("qrValue") or guest_qr_hash), result.size)
        qr_layer.putalpha(Image.composite(qr_layer.getchannel("A"), Image.new("L", result.size), fill_mask))
        result.alpha_composite(qr_layer)

    opacity = max(0.0, min(1.0, _number(layer.get("opacity"), 1)))
    if opacity < 1:
        result.putalpha(result.getchannel("A").point(lambda alpha: round(alpha * opacity)))
    rotation = _number(layer.get("rotation"))
    if rotation:
        result = result.rotate(-rotation, resample=Image.Resampling.BICUBIC, expand=True)
    return result


def _composite_layer(surface: Image.Image, layer: dict[str, Any], guest_qr_hash: str) -> None:
    rendered = _render_layer(layer, guest_qr_hash)
    original_width = max(1, round(_number(layer.get("width")) * CANVAS_WIDTH / 100))
    original_height = max(1, round(_number(layer.get("height")) * TOP_HEIGHT / 100))
    center_x = _number(layer.get("x")) * CANVAS_WIDTH / 100 + original_width / 2
    center_y = _number(layer.get("y")) * TOP_HEIGHT / 100 + original_height / 2
    position = (round(center_x - rendered.width / 2), round(center_y - rendered.height / 2))

    shadow = layer.get("shadow")
    if shadow and rendered.getbbox():
        shadow_data = _mapping(shadow)
        blur_radius = max(0, _number(shadow_data.get("blur")) * SCALE)
        # A blur needs transparent space around the source mask. Blurring the
        # layer-sized alpha channel in place clamps the filter at its bounds,
        # which clips the soft edge and leaves an apparently solid silhouette.
        # Three radii contain practically all of Pillow's Gaussian kernel while
        # preserving the same CSS-pixel scale used by the browser preview.
        padding = math.ceil(blur_radius * 3)
        alpha = Image.new(
            "L",
            (rendered.width + padding * 2, rendered.height + padding * 2),
        )
        alpha.paste(rendered.getchannel("A"), (padding, padding))
        if blur_radius:
            alpha = alpha.filter(ImageFilter.GaussianBlur(blur_radius))
        color = parse_color(shadow_data.get("color"), "#000000")
        shadow_image = Image.new("RGBA", alpha.size, color)
        shadow_image.putalpha(alpha.point(lambda value: round(value * color[3] / 255)))
        surface.alpha_composite(
            shadow_image,
            (
                position[0] + round(_number(shadow_data.get("offsetX")) * SCALE) - padding,
                position[1] + round(_number(shadow_data.get("offsetY")) * SCALE) - padding,
            ),
        )
    surface.alpha_composite(rendered, position)


def _display_guest_name(name: str, mode: str) -> str:
    parts = [part for part in name.strip().split() if part]
    if not parts:
        return "Guest"
    if mode == "full":
        return " ".join(parts)
    if len(parts[0]) <= 14:
        return parts[0]
    return parts[1] if len(parts) > 1 else parts[0]


def _format_event_date(value: Any) -> str:
    if not value:
        return ""
    text = str(value)
    try:
        from datetime import date

        return date.fromisoformat(text[:10]).strftime("%d %b %Y")
    except ValueError:
        return text[:40]


def _draw_detail_icon(draw: ImageDraw.ImageDraw, kind: str, box: tuple[int, int, int, int], color: tuple[int, int, int, int]) -> None:
    left, top, right, bottom = box
    width = max(2, round((right - left) * 0.11))
    if kind == "date":
        draw.rounded_rectangle(box, radius=3 * SCALE, outline=color, width=width)
        header_y = top + round((bottom - top) * 0.32)
        draw.line((left, header_y, right, header_y), fill=color, width=width)
        draw.line((left + 4 * SCALE, top - 2 * SCALE, left + 4 * SCALE, top + 4 * SCALE), fill=color, width=width)
        draw.line((right - 4 * SCALE, top - 2 * SCALE, right - 4 * SCALE, top + 4 * SCALE), fill=color, width=width)
        dot = max(1, round(SCALE))
        for x_ratio in (0.32, 0.68):
            for y_ratio in (0.57, 0.78):
                x = round(left + (right - left) * x_ratio)
                y = round(top + (bottom - top) * y_ratio)
                draw.ellipse((x - dot, y - dot, x + dot, y + dot), fill=color)
    elif kind == "time":
        draw.ellipse(box, outline=color, width=width)
        center = ((left + right) // 2, (top + bottom) // 2)
        draw.line((center[0], center[1], center[0], top + 4 * SCALE), fill=color, width=width)
        draw.line((center[0], center[1], right - 4 * SCALE, center[1]), fill=color, width=width)
    else:
        center_x = (left + right) // 2
        pin_bottom = bottom
        pin_circle_bottom = top + round((bottom - top) * 0.72)
        draw.ellipse((left + 2 * SCALE, top, right - 2 * SCALE, pin_circle_bottom), outline=color, width=width)
        draw.line((left + 4 * SCALE, pin_circle_bottom - 2 * SCALE, center_x, pin_bottom), fill=color, width=width)
        draw.line((right - 4 * SCALE, pin_circle_bottom - 2 * SCALE, center_x, pin_bottom), fill=color, width=width)
        dot = max(1, round(1.5 * SCALE))
        center_y = top + round((pin_circle_bottom - top) * 0.48)
        draw.ellipse((center_x - dot, center_y - dot, center_x + dot, center_y + dot), fill=color)


def _draw_event_details(surface: Image.Image, configuration: dict[str, Any], event_details: dict[str, Any]) -> None:
    rows: list[tuple[str, str]] = []
    if configuration.get("stub_show_event_date", True):
        date_text = _format_event_date(event_details.get("date"))
        if date_text:
            rows.append(("date", date_text))
    if configuration.get("stub_show_event_time", True) and event_details.get("time"):
        rows.append(("time", str(event_details["time"])[:5]))
    if configuration.get("stub_show_event_location", True) and event_details.get("location"):
        rows.append(("location", str(event_details["location"]).strip()))
    if not rows:
        return

    text_color = parse_color(configuration.get("stub_text_color"), "#ffffff")
    icon_color = parse_color(configuration.get("stub_event_details_icon_color"), "#3A7E94")
    font = resolve_font(
        str(configuration.get("stub_guest_font_family") or "Inter"),
        round(DETAILS_FONT_SIZE),
        "normal",
        "normal",
    )
    left = round(CANVAS_WIDTH * _number(configuration.get("stub_event_details_left"), 8.75) / 100)
    top = round(TOP_HEIGHT + STUB_HEIGHT * _number(configuration.get("stub_event_details_top"), 58) / 100)
    row_height = round(DETAILS_ICON_SIZE + DETAILS_GAP)
    icon_size = round(DETAILS_ICON_SIZE)
    text_gap = round(DETAILS_GAP)
    max_width = max(
        1,
        round(CANVAS_WIDTH * DETAILS_WIDTH_PERCENT / 100) - icon_size - text_gap,
    )
    draw = ImageDraw.Draw(surface)
    for index, (kind, value) in enumerate(rows[:3]):
        y = top + index * row_height
        _draw_detail_icon(draw, kind, (left, y, left + icon_size, y + icon_size), icon_color)
        displayed_value = value
        if draw.textlength(displayed_value, font=font) > max_width:
            displayed_value = value
            while displayed_value and draw.textlength(f"{displayed_value}...", font=font) > max_width:
                displayed_value = displayed_value[:-1]
            displayed_value = f"{displayed_value}..."
        draw.text(
            (left + icon_size + text_gap, y + icon_size / 2),
            displayed_value,
            fill=text_color,
            font=font,
            anchor="lm",
            stroke_width=0,
        )


def _draw_stub_details(surface: Image.Image, configuration: dict[str, Any], guest: dict[str, Any], event_details: dict[str, Any]) -> None:
    text_color = configuration.get("stub_text_color") or "#ffffff"
    accent_color = configuration.get("stub_accent_color") or "#3A7E94"
    qr_frame_color = configuration.get("qr_foreground_color") or "#000000"
    family = str(configuration.get("stub_guest_font_family") or "Inter")
    weight = str(configuration.get("stub_guest_font_weight") or "bold")
    style = str(configuration.get("stub_guest_font_style") or "normal")
    name_size = _number(configuration.get("stub_guest_name_font_size"), 22)
    info_top = TOP_HEIGHT + STUB_HEIGHT * _number(configuration.get("stub_guest_info_top"), 26) / 100
    left = round(CANVAS_WIDTH * _number(configuration.get("stub_guest_info_left"), 8.75) / 100)
    max_name_width = max(round(40 * SCALE), round(CANVAS_WIDTH * 0.60) - left)
    displayed_name = _display_guest_name(
        str(guest.get("name") or "Guest"),
        str(configuration.get("stub_guest_name_mode") or "first"),
    )
    rendered_name_size = max(
        12,
        round(name_size * min(1, 14 / max(len(displayed_name.strip()), 1))),
    )
    font = resolve_font(family, round(rendered_name_size * SCALE), weight, style)
    name_mask, _ = fit_single_line_mask(
        displayed_name,
        font,
        max_name_width,
        round(48 * SCALE),
    )
    name_color = create_paint(text_color, name_mask.size, "#ffffff")
    name_color.putalpha(ImageChops.multiply(name_color.getchannel("A"), name_mask))
    surface.alpha_composite(name_color, (left, round(info_top)))

    category = str(guest.get("category", "General")).strip()
    if not configuration.get("stub_show_guest_category", True):
        category = ""
    category_font_size = max(11, name_size * 0.68)
    category_font = resolve_font(family, round(category_font_size * SCALE), weight, style)
    probe = ImageDraw.Draw(Image.new("L", (1, 1)))
    if category:
        category_width = max(
            round(BADGE_MIN_WIDTH),
            round(probe.textlength(category, font=category_font) + BADGE_HORIZONTAL_PADDING * 2),
        )
        category_height = round(BADGE_HEIGHT)
        category_y = round(info_top + (name_size + 18) * SCALE)
        badge = Image.new("RGBA", (category_width, category_height))
        badge_mask = _rounded_mask(badge.size, category_height / 2)
        _paint_into(badge, badge_mask, accent_color, "#3A7E94")
        category_mask = Image.new("L", badge.size)
        ImageDraw.Draw(category_mask).text(
            (category_width / 2, category_height / 2 + 1), category, fill=255, font=category_font, anchor="mm"
        )
        category_text = create_paint(text_color, badge.size, "#ffffff")
        category_text.putalpha(ImageChops.multiply(category_text.getchannel("A"), category_mask))
        badge.alpha_composite(category_text)
        surface.alpha_composite(badge, (left, category_y))

    qr_size = max(1, round(CANVAS_WIDTH * _number(configuration.get("stub_qr_size"), 30) / 100))
    qr_right = CANVAS_WIDTH * _number(configuration.get("stub_qr_right"), 7) / 100
    configured_bottom = _number(configuration.get("stub_qr_bottom"), 10)
    qr_bottom = STUB_HEIGHT * max(configured_bottom, MIN_QR_BOTTOM_PERCENT) / 100
    qr_x = round(CANVAS_WIDTH - qr_right - qr_size)
    qr_y = round(CANVAS_HEIGHT - qr_bottom - qr_size)
    padding = round(QR_PADDING)
    radius = round(QR_RADIUS)
    qr_card = create_paint(qr_frame_color, (qr_size, qr_size), "#000000")
    qr_card.putalpha(ImageChops.multiply(qr_card.getchannel("A"), _rounded_mask(qr_card.size, radius)))
    inner_size = max(1, qr_size - padding * 2)
    qr_card.alpha_composite(
        _qr_image(
            str(guest.get("qr_hash") or "GatherVia"),
            (inner_size, inner_size),
            SECURE_QR_FOREGROUND,
            SECURE_QR_BACKGROUND,
            False,
        ),
        (padding, padding),
    )
    surface.alpha_composite(qr_card, (qr_x, qr_y))

    _draw_event_details(surface, configuration, event_details)

    footer_y = round(CANVAS_HEIGHT - STUB_HEIGHT * FOOTER_BOTTOM_PERCENT / 100)
    prefix_font = resolve_font("Arial", round(FOOTER_FONT_SIZE), "normal", "normal")
    brand_font = resolve_font("Arial", round(FOOTER_FONT_SIZE), "semibold", "normal")
    footer = (("powered by ", prefix_font, text_color), ("Gather", brand_font, text_color), ("Via", brand_font, qr_frame_color))
    measure = ImageDraw.Draw(Image.new("L", (1, 1)))
    widths = [measure.textlength(text, font=font_value) for text, font_value, _ in footer]
    x = (CANVAS_WIDTH - sum(widths)) / 2
    for (text, font_value, color), width in zip(footer, widths):
        text_width = max(1, math.ceil(width) + 4)
        text_height = round(24 * SCALE)
        text_mask = Image.new("L", (text_width, text_height))
        ImageDraw.Draw(text_mask).text((0, text_height / 2), text, font=font_value, fill=191, anchor="lm")
        text_image = create_paint(color, text_mask.size, "#ffffff")
        text_image.putalpha(ImageChops.multiply(text_image.getchannel("A"), text_mask))
        surface.alpha_composite(text_image, (round(x), round(footer_y - text_height / 2)))
        x += width


def _draw_artboard_stroke(surface: Image.Image, configuration: dict[str, Any], mask: Image.Image) -> None:
    width = round(_number(configuration.get("artboard_stroke_width"), 1) * SCALE)
    if width <= 0:
        return
    expanded = mask.filter(ImageFilter.MaxFilter(width * 2 + 1 if width % 2 == 1 else width * 2 + 3))
    outline = Image.eval(expanded, lambda pixel: 255 if pixel else 0)
    inner = mask.filter(ImageFilter.MinFilter(width * 2 + 1 if width % 2 == 1 else width * 2 + 3))
    outline = ImageChops.subtract(outline, inner)
    _paint_into(surface, outline, configuration.get("artboard_stroke_color"), "#000000")


def render_guest_invitation(
    configuration: Mapping[str, Any] | Any,
    layers: Sequence[Mapping[str, Any] | Any],
    guest: Mapping[str, Any] | Any,
    image_format: str = "png",
    event_details: Mapping[str, Any] | Any | None = None,
) -> bytes:
    config = _mapping(configuration)
    guest_data = _mapping(guest)
    event_data = _mapping(event_details) if event_details is not None else {}
    layer_data = [_mapping(layer) for layer in layers]
    unsupported = {str(layer.get("type")) for layer in layer_data} - SUPPORTED_LAYER_TYPES
    if unsupported:
        raise InvitationRenderError(f"Unsupported invitation layer types: {', '.join(sorted(unsupported))}")

    surface = create_paint(config.get("stub_background_color"), (CANVAS_WIDTH, CANVAS_HEIGHT), "#1e293b")
    top_mask = _top_mask()

    shadow_opacity = max(0.0, min(1.0, _number(config.get("stub_curve_shadow_opacity"), 50) / 100))
    if shadow_opacity:
        shadow_alpha = top_mask.filter(ImageFilter.GaussianBlur(_number(config.get("stub_curve_shadow_blur"), 16) * SCALE))
        color = parse_color(config.get("stub_curve_shadow_color"), "#000000")
        shadow = Image.new("RGBA", surface.size, color)
        shadow.putalpha(shadow_alpha.point(lambda alpha: round(alpha * shadow_opacity * color[3] / 255)))
        shifted = Image.new("RGBA", surface.size)
        shifted.alpha_composite(shadow, (0, round(_number(config.get("stub_curve_shadow_offset"), 8) * SCALE)))
        surface.alpha_composite(shifted)

    top_surface = Image.new("RGBA", surface.size)
    top_background = create_paint(config.get("canvas_background_color"), surface.size, "#f0fdfa")
    top_surface.alpha_composite(Image.composite(top_background, Image.new("RGBA", surface.size), top_mask))
    for layer in sorted(layer_data, key=lambda item: int(_number(item.get("zIndex")))):
        parent_id = layer.get("parentId")
        if layer.get("visible", True) and parent_id in {None, "", "main-frame"}:
            _composite_layer(top_surface, layer, str(guest_data.get("qr_hash") or "GatherVia"))
    top_surface.putalpha(Image.composite(top_surface.getchannel("A"), Image.new("L", surface.size), top_mask))
    surface.alpha_composite(top_surface)
    _draw_artboard_stroke(surface, config, top_mask)
    _draw_stub_details(surface, config, guest_data, event_data)

    output = io.BytesIO()
    normalized_format = image_format.lower()
    if normalized_format in {"jpg", "jpeg"}:
        flattened = Image.new("RGB", surface.size, "white")
        flattened.paste(surface, mask=surface.getchannel("A"))
        flattened.save(output, format="JPEG", quality=95, optimize=True)
    elif normalized_format == "png":
        surface.save(output, format="PNG", compress_level=6)
    else:
        raise InvitationRenderError("Invitation format must be png, jpg, or jpeg.")
    return output.getvalue()
