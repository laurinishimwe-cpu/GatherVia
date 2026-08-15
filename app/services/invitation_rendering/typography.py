from __future__ import annotations

import logging
import os
import re
import tempfile
import threading
import unicodedata
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from PIL import Image, ImageDraw, ImageFont

from app.services.invitation_rendering.font_registry import normalize_font_family


LOGGER = logging.getLogger(__name__)
_THIS_FILE = Path(__file__).resolve()
PACKAGE_ROOT = _THIS_FILE.parent
REPOSITORY_ROOT = _THIS_FILE.parents[3] if len(_THIS_FILE.parents) > 3 else PACKAGE_ROOT
MAX_REMOTE_FONT_BYTES = 20 * 1024 * 1024
REMOTE_FONT_USER_AGENT = "GatherVia invitation renderer/1.0"
GOOGLE_FONT_LICENSE_DIRS = ("ofl", "apache", "ufl")
GENERIC_FAMILIES = frozenset(
    {
        "serif",
        "sansserif",
        "monospace",
        "systemui",
        "cursive",
        "fantasy",
    }
)
SYSTEM_ONLY_FAMILIES = frozenset(
    {
        "systemui",
        "arial",
        "helvetica",
        "segoeui",
        "verdana",
        "tahoma",
        "trebuchetms",
        "gillsans",
        "avenir",
        "centurygothic",
        "franklingothicmedium",
        "impact",
        "georgia",
        "timesnewroman",
        "baskerville",
        "garamond",
        "palatinolinotype",
        "couriernew",
        "consolas",
        "monaco",
        "comicsansms",
    }
)


@dataclass(frozen=True)
class FontFace:
    path: Path
    family_key: str
    weight: int
    italic: bool


@dataclass(frozen=True)
class GoogleFontFace:
    filename: str
    weight: int
    italic: bool


# These aliases are fallbacks only. Unlike the old implementation, real Google
# families such as Inter and Roboto are never replaced with Arial before lookup.
FAMILY_FALLBACKS: dict[str, tuple[str, ...]] = {
    "systemui": ("segoeui", "sfprodisplay", "inter", "roboto", "liberationsans", "dejavusans"),
    "sansserif": ("arial", "helvetica", "liberationsans", "dejavusans"),
    "arial": ("arial", "liberationsans", "dejavusans"),
    "helvetica": ("helvetica", "arial", "liberationsans", "dejavusans"),
    "segoeui": ("segoeui", "liberationsans", "dejavusans"),
    "verdana": ("verdana", "liberationsans", "dejavusans"),
    "tahoma": ("tahoma", "liberationsans", "dejavusans"),
    "trebuchetms": ("trebuchetms", "liberationsans", "dejavusans"),
    "gillsans": ("gillsans", "liberationsans", "dejavusans"),
    "avenir": ("avenir", "liberationsans", "dejavusans"),
    "centurygothic": ("centurygothic", "liberationsans", "dejavusans"),
    "franklingothicmedium": ("franklingothicmedium", "liberationsans", "dejavusans"),
    "impact": ("impact", "liberationsans", "dejavusans"),
    "serif": ("timesnewroman", "times", "liberationserif", "dejavuserif"),
    "timesnewroman": ("timesnewroman", "times", "liberationserif", "dejavuserif"),
    "georgia": ("georgia", "liberationserif", "dejavuserif"),
    "baskerville": ("baskerville", "liberationserif", "dejavuserif"),
    "garamond": ("garamond", "liberationserif", "dejavuserif"),
    "palatinolinotype": ("palatinolinotype", "liberationserif", "dejavuserif"),
    "monospace": ("couriernew", "consolas", "liberationmono", "dejavusansmono"),
    "couriernew": ("couriernew", "cour", "liberationmono", "dejavusansmono"),
    "consolas": ("consolas", "liberationmono", "dejavusansmono"),
    "monaco": ("monaco", "liberationmono", "dejavusansmono"),
    "comicsansms": ("comicsansms", "liberationsans", "dejavusans"),
}

_WEIGHT_NAMES = (
    # More specific names must come before their shorter substrings.
    ("extralight", 200),
    ("ultralight", 200),
    ("semibold", 600),
    ("demibold", 600),
    ("extrabold", 800),
    ("ultrabold", 800),
    ("thin", 100),
    ("light", 300),
    ("medium", 500),
    ("black", 900),
    ("heavy", 900),
    ("bold", 700),
    ("book", 400),
    ("regular", 400),
    ("normal", 400),
)

_DOWNLOAD_LOCK = threading.RLock()


def _font_key(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "", ascii_value.lower())


def _first_css_family(family: str | None) -> str:
    return normalize_font_family(family)


def _weight_value(weight: str | int | float) -> int:
    text = str(weight or "normal").strip().lower().replace("-", "").replace("_", "")
    try:
        return max(1, min(1000, int(float(text))))
    except ValueError:
        pass
    for name, value in _WEIGHT_NAMES:
        if name in text:
            return value
    return 400


def _style_is_italic(style: str | None) -> bool:
    return str(style or "normal").strip().lower() in {"italic", "oblique"}


def _infer_face_weight(style_name: str, filename: str) -> int:
    probe = _font_key(f"{style_name} {Path(filename).stem}")
    for name, value in _WEIGHT_NAMES:
        if name in probe:
            return value
    return 400


def _remote_fonts_enabled() -> bool:
    return os.getenv("INVITATION_ALLOW_REMOTE_FONTS", "1").strip().lower() not in {
        "0",
        "false",
        "no",
        "off",
    }


def _font_cache_root() -> Path:
    configured = os.getenv("INVITATION_FONT_CACHE_DIR")
    if configured:
        return Path(configured).expanduser().resolve()
    return (Path(tempfile.gettempdir()) / "gatekeep-invitation-fonts").resolve()


def _font_roots() -> tuple[Path, ...]:
    roots: list[Path] = []
    configured = os.getenv("INVITATION_FONT_DIRS", "")
    roots.extend(Path(item).expanduser() for item in configured.split(os.pathsep) if item.strip())
    roots.extend(
        [
            PACKAGE_ROOT / "fonts",
            REPOSITORY_ROOT / "fonts",
            REPOSITORY_ROOT / "assets" / "fonts",
            REPOSITORY_ROOT / "public" / "fonts",
            REPOSITORY_ROOT / "static" / "fonts",
            _font_cache_root(),
            Path("C:/Windows/Fonts"),
            Path("/usr/share/fonts"),
            Path("/usr/local/share/fonts"),
            Path.home() / ".fonts",
            Path.home() / ".local" / "share" / "fonts",
            Path("/System/Library/Fonts"),
            Path("/Library/Fonts"),
        ]
    )
    unique: list[Path] = []
    seen: set[str] = set()
    for root in roots:
        try:
            resolved = root.resolve()
        except OSError:
            continue
        marker = str(resolved).casefold()
        if marker not in seen and resolved.exists() and resolved.is_dir():
            seen.add(marker)
            unique.append(resolved)
    return tuple(unique)


def _iter_font_files(root: Path):
    try:
        for path in root.rglob("*"):
            if path.is_file() and path.suffix.lower() in {".ttf", ".otf", ".ttc"}:
                yield path
    except OSError:
        return


@lru_cache(maxsize=1)
def _local_font_faces() -> tuple[FontFace, ...]:
    faces: list[FontFace] = []
    seen: set[str] = set()
    for root in _font_roots():
        for path in _iter_font_files(root):
            marker = str(path).casefold()
            if marker in seen:
                continue
            seen.add(marker)
            try:
                probe = ImageFont.truetype(str(path), 16)
                family_name, style_name = probe.getname()
            except (OSError, ValueError):
                continue
            combined_style = f"{style_name} {path.stem}"
            faces.append(
                FontFace(
                    path=path,
                    family_key=_font_key(family_name),
                    weight=_infer_face_weight(style_name, path.name),
                    italic="italic" in combined_style.lower() or "oblique" in combined_style.lower(),
                )
            )
    return tuple(faces)


def _target_family_keys(requested_key: str) -> tuple[str, ...]:
    return FAMILY_FALLBACKS.get(requested_key, (requested_key,))


def _best_local_face(requested_key: str, weight: int, italic: bool) -> FontFace | None:
    targets = _target_family_keys(requested_key)
    target_rank = {family_key: index for index, family_key in enumerate(targets)}
    candidates = [face for face in _local_font_faces() if face.family_key in target_rank]
    if not candidates:
        return None
    return min(
        candidates,
        key=lambda face: (
            target_rank[face.family_key] * 10_000,
            2_000 if face.italic != italic else 0,
            abs(face.weight - weight),
            len(face.path.name),
        ),
    )


def _http_bytes(url: str, maximum: int) -> bytes:
    timeout = max(1.0, float(os.getenv("INVITATION_FONT_TIMEOUT_SECONDS", "6")))
    request = Request(url, headers={"User-Agent": REMOTE_FONT_USER_AGENT})
    with urlopen(request, timeout=timeout) as response:
        data = response.read(maximum + 1)
    if len(data) > maximum:
        raise OSError(f"Remote font resource exceeds {maximum} bytes.")
    return data


def _parse_google_metadata(metadata: str) -> tuple[GoogleFontFace, ...]:
    faces: list[GoogleFontFace] = []
    for match in re.finditer(r"fonts\s*\{(.*?)\}", metadata, re.IGNORECASE | re.DOTALL):
        block = match.group(1)
        filename_match = re.search(r'filename:\s*"([^"]+)"', block)
        if not filename_match:
            continue
        filename = filename_match.group(1)
        if Path(filename).name != filename or Path(filename).suffix.lower() not in {".ttf", ".otf"}:
            continue
        weight_match = re.search(r"weight:\s*(\d+)", block)
        style_match = re.search(r'style:\s*"([^"]+)"', block)
        faces.append(
            GoogleFontFace(
                filename=filename,
                weight=int(weight_match.group(1)) if weight_match else 400,
                italic=bool(style_match and style_match.group(1).lower() in {"italic", "oblique"}),
            )
        )
    return tuple(faces)


def _valid_sfnt(data: bytes) -> bool:
    return data.startswith((b"\x00\x01\x00\x00", b"OTTO", b"ttcf", b"true"))


@lru_cache(maxsize=256)
def _google_family_metadata(family_key: str) -> tuple[str, tuple[GoogleFontFace, ...]] | None:
    revision = os.getenv("GOOGLE_FONTS_REVISION", "main").strip() or "main"
    for license_dir in GOOGLE_FONT_LICENSE_DIRS:
        url = (
            "https://raw.githubusercontent.com/google/fonts/"
            f"{quote(revision, safe='')}/{license_dir}/{family_key}/METADATA.pb"
        )
        try:
            metadata = _http_bytes(url, 2 * 1024 * 1024).decode("utf-8")
        except (HTTPError, URLError, OSError, UnicodeDecodeError):
            continue
        faces = _parse_google_metadata(metadata)
        if faces:
            return license_dir, faces
    return None


@lru_cache(maxsize=512)
def _download_google_face(family_key: str, weight: int, italic: bool) -> Path | None:
    if (
        not _remote_fonts_enabled()
        or family_key in GENERIC_FAMILIES
        or family_key in SYSTEM_ONLY_FAMILIES
    ):
        return None

    metadata = _google_family_metadata(family_key)
    if metadata is None:
        return None
    license_dir, faces = metadata
    selected = min(
        faces,
        key=lambda face: (
            5_000 if face.italic != italic else 0,
            abs(face.weight - weight),
        ),
    )

    revision = os.getenv("GOOGLE_FONTS_REVISION", "main").strip() or "main"
    family_root = _font_cache_root() / revision / license_dir / family_key
    destination = family_root / selected.filename
    if destination.exists():
        try:
            if _valid_sfnt(destination.read_bytes()[:4]):
                return destination
        except OSError:
            pass

    url = (
        "https://raw.githubusercontent.com/google/fonts/"
        f"{quote(revision, safe='')}/{license_dir}/{family_key}/"
        f"{quote(selected.filename, safe='[](),._-')}"
    )
    try:
        data = _http_bytes(url, MAX_REMOTE_FONT_BYTES)
    except (HTTPError, URLError, OSError):
        return None
    if not _valid_sfnt(data[:4]):
        return None

    with _DOWNLOAD_LOCK:
        try:
            family_root.mkdir(parents=True, exist_ok=True)
            temporary = destination.with_name(
                f".{destination.name}.{os.getpid()}.{threading.get_ident()}.tmp"
            )
            temporary.write_bytes(data)
            temporary.replace(destination)
        except OSError:
            return None
    return destination


def _fallback_group(requested_key: str) -> str:
    targets = _target_family_keys(requested_key)
    if any("mono" in key or "cour" in key or "consol" in key for key in targets):
        return "mono"
    if any(
        key in {"serif", "times", "timesnewroman", "georgia", "baskerville", "garamond", "palatinolinotype"}
        or key.endswith("serif")
        for key in targets
    ):
        return "serif"
    return "sans"


def _fallback_font_names(group: str, weight: int, italic: bool) -> tuple[str, ...]:
    bold = weight >= 600
    if group == "serif":
        if bold and italic:
            return ("DejaVuSerif-BoldItalic.ttf", "LiberationSerif-BoldItalic.ttf")
        if bold:
            return ("DejaVuSerif-Bold.ttf", "LiberationSerif-Bold.ttf")
        if italic:
            return ("DejaVuSerif-Italic.ttf", "LiberationSerif-Italic.ttf")
        return ("DejaVuSerif.ttf", "LiberationSerif-Regular.ttf")
    if group == "mono":
        if bold and italic:
            return ("DejaVuSansMono-BoldOblique.ttf", "LiberationMono-BoldItalic.ttf")
        if bold:
            return ("DejaVuSansMono-Bold.ttf", "LiberationMono-Bold.ttf")
        if italic:
            return ("DejaVuSansMono-Oblique.ttf", "LiberationMono-Italic.ttf")
        return ("DejaVuSansMono.ttf", "LiberationMono-Regular.ttf")
    if bold and italic:
        return ("DejaVuSans-BoldOblique.ttf", "LiberationSans-BoldItalic.ttf")
    if bold:
        return ("DejaVuSans-Bold.ttf", "LiberationSans-Bold.ttf")
    if italic:
        return ("DejaVuSans-Oblique.ttf", "LiberationSans-Italic.ttf")
    return ("DejaVuSans.ttf", "LiberationSans-Regular.ttf")


def _apply_variations(
    font: ImageFont.FreeTypeFont,
    size: int,
    weight: int,
    italic: bool,
) -> ImageFont.FreeTypeFont:
    try:
        axes = font.get_variation_axes()
    except (AttributeError, OSError):
        return font
    if not axes:
        return font

    values: list[float] = []
    changed = False
    for axis in axes:
        raw_name = axis.get("name", b"")
        name = raw_name.decode("utf-8", "ignore") if isinstance(raw_name, bytes) else str(raw_name)
        minimum = float(axis.get("minimum", axis.get("min", 0)))
        maximum = float(axis.get("maximum", axis.get("max", 1)))
        default = float(axis.get("default", minimum))
        key = name.lower()
        value = default
        if "weight" in key or key == "wght":
            value = float(weight)
            changed = True
        elif "optical" in key or key == "opsz":
            value = float(size)
            changed = True
        elif "italic" in key or key == "ital":
            value = 1.0 if italic else 0.0
            changed = True
        elif "slant" in key or key == "slnt":
            value = -10.0 if italic else 0.0
            changed = True
        values.append(max(minimum, min(maximum, value)))
    if changed:
        try:
            font.set_variation_by_axes(values)
        except (AttributeError, OSError, ValueError):
            pass
    return font


@lru_cache(maxsize=512)
def resolve_font(
    family: str,
    size: int,
    weight: str = "normal",
    style: str = "normal",
) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    requested_family = _first_css_family(family)
    requested_key = _font_key(requested_family)
    requested_weight = _weight_value(weight)
    requested_italic = _style_is_italic(style)
    font_size = max(1, int(size))

    local_face = _best_local_face(requested_key, requested_weight, requested_italic)
    path = local_face.path if local_face else None
    if path is None:
        path = _download_google_face(requested_key, requested_weight, requested_italic)

    if path is not None:
        try:
            font = ImageFont.truetype(str(path), font_size)
            return _apply_variations(font, font_size, requested_weight, requested_italic)
        except OSError:
            LOGGER.warning("Could not load resolved invitation font %s from %s", requested_family, path)

    for fallback_name in _fallback_font_names(
        _fallback_group(requested_key), requested_weight, requested_italic
    ):
        try:
            return ImageFont.truetype(fallback_name, font_size)
        except OSError:
            continue

    LOGGER.warning("Invitation font %r is unavailable; Pillow default font is being used.", requested_family)
    try:
        return ImageFont.load_default(size=font_size)
    except TypeError:
        return ImageFont.load_default()


def wrap_text(text: str, font: ImageFont.ImageFont, max_width: int) -> list[str]:
    draw = ImageDraw.Draw(Image.new("L", (1, 1)))
    lines: list[str] = []
    for paragraph in text.splitlines() or [""]:
        words = paragraph.split(" ")
        current = ""
        for word in words:
            candidate = word if not current else f"{current} {word}"
            if not current or draw.textlength(candidate, font=font) <= max_width:
                current = candidate
            else:
                lines.append(current)
                current = word
        lines.append(current)
    return lines or [""]


def render_text_mask(
    text: str,
    size: tuple[int, int],
    family: str,
    font_size: float,
    weight: str,
    style: str,
    align: str,
    scale: float,
) -> Image.Image:
    width, height = max(1, size[0]), max(1, size[1])
    mask = Image.new("L", (width, height))
    draw = ImageDraw.Draw(mask)
    font = resolve_font(family, round(font_size * scale), weight, style)
    lines = wrap_text(text, font, width)
    line_height = max(1, round(font_size * scale * 1.1))
    block_height = len(lines) * line_height
    y = (height - block_height) / 2
    for line in lines:
        line_width = draw.textlength(line, font=font)
        if align == "center":
            x = (width - line_width) / 2
        elif align == "right":
            x = width - line_width
        else:
            x = 0
        draw.text((x, y), line, fill=255, font=font, anchor="lt")
        y += line_height
    return mask


def fit_single_line_mask(
    text: str,
    font: ImageFont.ImageFont,
    max_width: int,
    height: int,
) -> tuple[Image.Image, int]:
    probe = ImageDraw.Draw(Image.new("L", (1, 1)))
    bounds = probe.textbbox((0, 0), text, font=font, anchor="lt")
    natural_width = max(1, bounds[2] - bounds[0])
    natural_height = max(1, bounds[3] - bounds[1])
    mask = Image.new("L", (natural_width + 4, max(height, natural_height + 4)))
    ImageDraw.Draw(mask).text((0, 0), text, font=font, fill=255, anchor="lt")
    if natural_width > max_width:
        mask = mask.resize((max_width, mask.height), Image.Resampling.LANCZOS)
        natural_width = max_width
    return mask, natural_width
