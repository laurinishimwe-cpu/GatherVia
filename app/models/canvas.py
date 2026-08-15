from typing import Optional, Literal
from pydantic import BaseModel, model_validator

from app.services.invitation_rendering.font_registry import normalize_font_family


def _copy_aliases(value: object, aliases: dict[str, tuple[str, ...]]) -> object:
    if not isinstance(value, dict):
        return value
    normalized = dict(value)
    for canonical, legacy_names in aliases.items():
        if canonical in normalized:
            continue
        for legacy_name in legacy_names:
            if legacy_name in normalized:
                normalized[canonical] = normalized[legacy_name]
                break
    return normalized

class Shadow(BaseModel):
    color: str
    blur: float
    offsetX: float
    offsetY: float

    @model_validator(mode="before")
    @classmethod
    def normalize_legacy_names(cls, value: object) -> object:
        return _copy_aliases(
            value,
            {
                "color": ("shadowColor", "shadow_color"),
                "blur": ("shadowBlur", "shadow_blur"),
                "offsetX": ("offset_x", "shadowOffsetX", "shadow_offset_x"),
                "offsetY": ("offset_y", "shadowOffsetY", "shadow_offset_y"),
            },
        )

class VectorNode(BaseModel):
    id: str
    x: float
    y: float
    handleIn: Optional[dict] = None   
    handleOut: Optional[dict] = None
    mirror: Literal["mirrored", "asymmetric", "disconnected", "straight"] = "straight"

    @model_validator(mode="before")
    @classmethod
    def normalize_legacy_names(cls, value: object) -> object:
        return _copy_aliases(
            value,
            {
                "handleIn": ("handle_in",),
                "handleOut": ("handle_out",),
            },
        )

class CanvasLayer(BaseModel):
    id: str
    type: Literal["text", "image", "rect", "ellipse", "polygon", "qr", "frame", "path"]
    name: Optional[str] = None
    x: float = 0
    y: float = 0
    width: float = 0
    height: float = 0
    rotation: float = 0
    opacity: float = 1
    zIndex: int = 0
    visible: bool = True
    locked: bool = False
    parentId: Optional[str] = None

    # Text
    text: Optional[str] = None
    fontFamily: Optional[str] = None
    fontSize: Optional[float] = None
    fontWeight: Optional[Literal["normal", "medium", "semibold", "bold"]] = None
    fontStyle: Optional[Literal["normal", "italic"]] = None
    textAlign: Optional[Literal["left", "center", "right", "justify"]] = None
    color: Optional[str] = None


    fill: Optional[str] = None
    stroke: Optional[str] = None
    strokeWidth: Optional[float] = None
    borderRadius: Optional[float] = None

   
    pathData: Optional[str] = None
    closed: bool = False
    points: Optional[str] = None

  
    nodes: Optional[list[VectorNode]] = None

  
    imageUrl: Optional[str] = None


    qrValue: Optional[str] = None

    shadow: Optional[Shadow] = None

    @model_validator(mode="before")
    @classmethod
    def normalize_legacy_names(cls, value: object) -> object:
        normalized = _copy_aliases(
            value,
            {
                "parentId": ("parent_id",),
                "zIndex": ("z_index",),
                "fontFamily": ("font_family",),
                "fontSize": ("font_size",),
                "fontWeight": ("font_weight",),
                "fontStyle": ("font_style",),
                "textAlign": ("text_align",),
                "strokeWidth": ("stroke_width",),
                "borderRadius": ("border_radius",),
                "pathData": ("path", "path_data"),
                "points": ("polygon",),
                "imageUrl": ("image_url",),
                "qrValue": ("qr_value",),
            },
        )
        if not isinstance(normalized, dict):
            return normalized

        layer_type = str(normalized.get("type") or "").strip().lower()
        normalized["type"] = {
            "rectangle": "rect",
            "circle": "ellipse",
            "text_layer": "text",
            "image_layer": "image",
            "qr_code": "qr",
        }.get(layer_type, layer_type)

        if normalized["type"] == "text" or normalized.get("fontFamily"):
            normalized["fontFamily"] = normalize_font_family(normalized.get("fontFamily"))

        weight = str(normalized.get("fontWeight") or "").strip().lower()
        normalized["fontWeight"] = {
            "400": "normal",
            "500": "medium",
            "600": "semibold",
            "700": "bold",
            "regular": "normal",
            "semi-bold": "semibold",
            "semi_bold": "semibold",
        }.get(weight, normalized.get("fontWeight"))

        style = str(normalized.get("fontStyle") or "").strip().lower()
        normalized["fontStyle"] = {
            "oblique": "italic",
        }.get(style, normalized.get("fontStyle"))

        alignment = str(normalized.get("textAlign") or "").strip().lower()
        normalized["textAlign"] = {
            "start": "left",
            "middle": "center",
            "end": "right",
        }.get(alignment, normalized.get("textAlign"))
        return normalized
