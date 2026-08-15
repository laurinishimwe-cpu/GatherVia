from __future__ import annotations

import base64
import binascii
import importlib
import io
import math
import re
from functools import lru_cache
from pathlib import Path
from urllib.parse import unquote, urlparse
from urllib.request import Request, urlopen

from defusedxml import ElementTree as DefusedElementTree
from PIL import Image, ImageOps

class AssetLoadError(RuntimeError):
    pass


REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
UPLOAD_ROOT = (REPOSITORY_ROOT / "uploads" / "flyers").resolve()
MAX_ASSET_BYTES = 25 * 1024 * 1024
MAX_SVG_ELEMENTS = 20_000
MAX_SVG_DIMENSION = 4_096
MAX_SVG_PIXELS = 16_000_000

_SVG_TAG_RE = re.compile(br"<\s*svg(?:\s|>)", re.IGNORECASE)
_CSS_URL_RE = re.compile(r"url\(\s*(['\"]?)(.*?)\1\s*\)", re.IGNORECASE)
_LENGTH_RE = re.compile(
    r"^\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)\s*([a-zA-Z%]*)\s*$"
)
_VIEWBOX_SPLIT_RE = re.compile(r"[\s,]+")
_BLOCKED_SVG_ELEMENTS = frozenset(
    {"script", "foreignobject", "iframe", "object", "embed", "audio", "video"}
)
_EXTERNAL_REFERENCE_ATTRIBUTES = frozenset({"href", "src"})
_SAFE_DATA_IMAGE_PREFIXES = (
    "data:image/png",
    "data:image/jpeg",
    "data:image/jpg",
    "data:image/gif",
    "data:image/webp",
)


def _local_name(value: str) -> str:
    return value.rsplit("}", 1)[-1].lower()


def _local_asset_path(source: str) -> Path | None:
    parsed = urlparse(source)
    path = unquote(parsed.path).replace("\\", "/")
    markers = ("/api/v1/flyers/assets/", "/flyers/assets/", "/uploads/flyers/")
    relative: str | None = None
    for marker in markers:
        if marker in path:
            relative = path.split(marker, 1)[1]
            break
    if relative is None:
        return None
    candidate = (UPLOAD_ROOT / relative).resolve()
    if UPLOAD_ROOT not in candidate.parents:
        raise AssetLoadError("Flyer asset path escapes the upload directory.")
    return candidate


@lru_cache(maxsize=128)
def _asset_bytes(source: str) -> bytes:
    if source.startswith("data:"):
        try:
            metadata, encoded = source.split(",", 1)
            data = (
                base64.b64decode(encoded, validate=True)
                if ";base64" in metadata
                else unquote(encoded).encode()
            )
        except (ValueError, binascii.Error) as exc:
            raise AssetLoadError("Invalid image data URL.") from exc
    else:
        local_path = _local_asset_path(source)
        if local_path is not None and local_path.exists():
            data = local_path.read_bytes()
        elif source.startswith(("http://", "https://")):
            request = Request(
                source,
                headers={"User-Agent": "GatherVia invitation renderer/1.0"},
            )
            try:
                with urlopen(request, timeout=15) as response:
                    data = response.read(MAX_ASSET_BYTES + 1)
            except OSError as exc:
                raise AssetLoadError(f"Could not download image asset: {source}") from exc
        else:
            raise AssetLoadError(f"Image asset was not found: {source}")

    if len(data) > MAX_ASSET_BYTES:
        raise AssetLoadError("Image asset exceeds the 25 MB rendering limit.")
    return data


def _is_svg(source: str, data: bytes) -> bool:
    if source.lower().startswith("data:image/svg+xml"):
        return True
    if urlparse(source).path.lower().endswith(".svg"):
        return True
    prefix = data[:4096].lstrip(b"\xef\xbb\xbf\x00\t\r\n ")
    return bool(_SVG_TAG_RE.search(prefix))


def _reference_is_safe(value: str) -> bool:
    candidate = value.strip().strip("\"'")
    if not candidate or candidate.startswith("#"):
        return True
    return candidate.lower().startswith(_SAFE_DATA_IMAGE_PREFIXES)


def _validate_css_references(value: str) -> None:
    if "@import" in value.lower():
        raise AssetLoadError("SVG styles may not import external stylesheets.")
    for match in _CSS_URL_RE.finditer(value):
        if not _reference_is_safe(match.group(2)):
            raise AssetLoadError("SVG contains an external resource reference.")


def _parse_svg_root(data: bytes):
    try:
        root = DefusedElementTree.fromstring(data)
    except Exception as exc:
        raise AssetLoadError("SVG markup is invalid or unsafe.") from exc

    if _local_name(root.tag) != "svg":
        raise AssetLoadError("Vector asset does not contain an SVG root element.")

    element_count = 0
    for element in root.iter():
        element_count += 1
        if element_count > MAX_SVG_ELEMENTS:
            raise AssetLoadError("SVG contains too many elements to render safely.")

        tag_name = _local_name(element.tag)
        if tag_name in _BLOCKED_SVG_ELEMENTS:
            raise AssetLoadError(f"SVG element <{tag_name}> is not allowed.")

        for attribute, raw_value in element.attrib.items():
            name = _local_name(attribute)
            value = str(raw_value)
            if name.startswith("on"):
                raise AssetLoadError("SVG event-handler attributes are not allowed.")
            if name in _EXTERNAL_REFERENCE_ATTRIBUTES and not _reference_is_safe(value):
                raise AssetLoadError("SVG contains an external resource reference.")
            _validate_css_references(value)

        if element.text:
            _validate_css_references(element.text)

    return root


def _css_length_to_pixels(value: str | None) -> float | None:
    if not value:
        return None
    match = _LENGTH_RE.match(value)
    if not match:
        return None
    number = float(match.group(1))
    unit = match.group(2).lower()
    if number <= 0 or unit == "%":
        return None
    factors = {
        "": 1.0,
        "px": 1.0,
        "pt": 96 / 72,
        "pc": 16.0,
        "in": 96.0,
        "cm": 96 / 2.54,
        "mm": 96 / 25.4,
        "q": 96 / 101.6,
    }
    factor = factors.get(unit)
    return number * factor if factor is not None else None


def _svg_aspect_ratio(root) -> float | None:
    view_box = root.attrib.get("viewBox") or root.attrib.get("viewbox")
    if view_box:
        try:
            values = [
                float(part)
                for part in _VIEWBOX_SPLIT_RE.split(view_box.strip())
                if part
            ]
            if len(values) == 4 and values[2] > 0 and values[3] > 0:
                return values[2] / values[3]
        except ValueError:
            pass

    width = _css_length_to_pixels(root.attrib.get("width"))
    height = _css_length_to_pixels(root.attrib.get("height"))
    if width and height:
        return width / height
    return None


def _bounded_svg_size(width: int, height: int) -> tuple[int, int]:
    width = max(1, width)
    height = max(1, height)
    scale = min(
        1.0,
        MAX_SVG_DIMENSION / width,
        MAX_SVG_DIMENSION / height,
        math.sqrt(MAX_SVG_PIXELS / (width * height)),
    )
    return max(1, round(width * scale)), max(1, round(height * scale))


def _svg_output_size(root, target_size: tuple[int, int] | None) -> tuple[int, int]:
    if target_size is None:
        width = round(_css_length_to_pixels(root.attrib.get("width")) or 1024)
        height = round(_css_length_to_pixels(root.attrib.get("height")) or 1024)
        return _bounded_svg_size(width, height)

    target_width = max(1, int(target_size[0]))
    target_height = max(1, int(target_size[1]))

    # preserveAspectRatio="none" intentionally stretches in browsers as well.
    preserve_aspect_ratio = str(
        root.attrib.get("preserveAspectRatio", "")
    ).strip().lower()
    if preserve_aspect_ratio == "none":
        return _bounded_svg_size(target_width, target_height)

    source_ratio = _svg_aspect_ratio(root)
    if not source_ratio:
        return _bounded_svg_size(target_width, target_height)

    # Rasterize large enough for the existing object-cover crop without first
    # distorting the vector's intrinsic aspect ratio.
    target_ratio = target_width / target_height
    if source_ratio >= target_ratio:
        output_height = target_height
        output_width = math.ceil(output_height * source_ratio)
    else:
        output_width = target_width
        output_height = math.ceil(output_width / source_ratio)
    return _bounded_svg_size(output_width, output_height)


def _decode_svg_markup(data: bytes) -> str:
    """Decode validated SVG bytes for renderers that accept Unicode markup."""
    for encoding in ("utf-8-sig", "utf-16", "latin-1"):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise AssetLoadError("SVG text encoding is not supported.")


def _load_svg_backend():
    """
    Load an SVG renderer only when an SVG is actually rendered.

    resvg_py is preferred because its Windows wheels bundle the native renderer.
    CairoSVG remains an optional fallback for deployments that already provide
    the native Cairo library.
    """
    errors: list[str] = []

    try:
        return "resvg_py", importlib.import_module("resvg_py")
    except (ImportError, OSError) as exc:
        errors.append(f"resvg_py: {exc}")

    try:
        return "cairosvg", importlib.import_module("cairosvg")
    except (ImportError, OSError) as exc:
        errors.append(f"CairoSVG: {exc}")

    details = "; ".join(errors)
    raise AssetLoadError(
        "No usable SVG rasterizer is installed. "
        "Install the Windows-safe backend with `python -m pip install "
        "resvg_py>=0.3.3,<0.4`. "
        f"Backend errors: {details}"
    )


@lru_cache(maxsize=128)
def _rasterized_svg_png(
    source: str,
    target_size: tuple[int, int] | None,
) -> bytes:
    data = _asset_bytes(source)
    root = _parse_svg_root(data)
    output_width, output_height = _svg_output_size(root, target_size)
    backend_name, backend = _load_svg_backend()

    try:
        if backend_name == "resvg_py":
            return backend.svg_to_bytes(
                svg_string=_decode_svg_markup(data),
                width=output_width,
                height=output_height,
                # External references were rejected during SVG validation.
                resources_dir=None,
                skip_system_fonts=False,
            )

        return backend.svg2png(
            bytestring=data,
            output_width=output_width,
            output_height=output_height,
            parent_width=target_size[0] if target_size else output_width,
            parent_height=target_size[1] if target_size else output_height,
            unsafe=False,
        )
    except AssetLoadError:
        raise
    except Exception as exc:
        raise AssetLoadError(
            f"SVG asset could not be rasterized by {backend_name}: {source}"
        ) from exc


def load_image(
    source: str,
    raster_size: tuple[int, int] | None = None,
) -> Image.Image:
    data = _asset_bytes(source)
    if _is_svg(source, data):
        data = _rasterized_svg_png(source, raster_size)

    try:
        with Image.open(io.BytesIO(data)) as image:
            image.load()
            return ImageOps.exif_transpose(image).convert("RGBA")
    except (OSError, ValueError) as exc:
        raise AssetLoadError(f"Image asset is not decodable: {source}") from exc


def cover_image(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    width, height = max(1, size[0]), max(1, size[1])
    return ImageOps.fit(
        image,
        (width, height),
        method=Image.Resampling.LANCZOS,
        centering=(0.5, 0.5),
    )
