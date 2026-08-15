import type { CanvasLayer, MirrorMode, VectorNode } from "@/lib/types/canvas";
import { normalizeFontFamily } from "@/lib/flyer/fontRegistry";

export const CANVAS_LAYER_CONTRACT_VERSION = 1;
export const EDITOR_REFERENCE_WIDTH = 320;
export const DESIGN_ASPECT_RATIO = 27 / 32;

type UnknownRecord = Record<string, unknown>;

const LAYER_TYPES = new Set<CanvasLayer["type"]>([
  "text",
  "image",
  "rect",
  "ellipse",
  "polygon",
  "qr",
  "frame",
  "path",
]);

const MIRROR_MODES = new Set<MirrorMode>([
  "mirrored",
  "asymmetric",
  "disconnected",
  "straight",
]);

function asRecord(value: unknown): UnknownRecord {
  return value !== null && typeof value === "object"
    ? value as UnknownRecord
    : {};
}

function first(source: UnknownRecord, ...names: string[]): unknown {
  for (const name of names) {
    if (source[name] !== undefined && source[name] !== null) {
      return source[name];
    }
  }
  return undefined;
}

function finiteNumber(value: unknown, fallback: number): number {
  const resolved = typeof value === "number" ? value : Number(value);
  return Number.isFinite(resolved) ? resolved : fallback;
}

function optionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const resolved = typeof value === "number" ? value : Number(value);
  return Number.isFinite(resolved) ? resolved : undefined;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return fallback;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function normalizeLayerType(value: unknown): CanvasLayer["type"] {
  const raw = String(value ?? "").trim().toLowerCase();
  const aliased = {
    rectangle: "rect",
    circle: "ellipse",
    text_layer: "text",
    image_layer: "image",
    qr_code: "qr",
  }[raw] ?? raw;
  return LAYER_TYPES.has(aliased as CanvasLayer["type"])
    ? aliased as CanvasLayer["type"]
    : "rect";
}

function normalizeFontWeight(value: unknown): CanvasLayer["fontWeight"] {
  const raw = String(value ?? "").trim().toLowerCase();
  return {
    "400": "normal",
    "500": "medium",
    "600": "semibold",
    "700": "bold",
    regular: "normal",
    "semi-bold": "semibold",
    semi_bold: "semibold",
  }[raw] as CanvasLayer["fontWeight"] | undefined
    ?? (["normal", "medium", "semibold", "bold"].includes(raw)
      ? raw as CanvasLayer["fontWeight"]
      : undefined);
}

function normalizeTextAlign(value: unknown): CanvasLayer["textAlign"] {
  const raw = String(value ?? "").trim().toLowerCase();
  const aliased = {
    start: "left",
    middle: "center",
    end: "right",
  }[raw] ?? raw;
  return ["left", "center", "right", "justify"].includes(aliased)
    ? aliased as CanvasLayer["textAlign"]
    : undefined;
}

function normalizeFontStyle(value: unknown): CanvasLayer["fontStyle"] {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "italic" || raw === "oblique") return "italic";
  return raw === "normal" ? "normal" : undefined;
}

function normalizeVectorNode(value: unknown, index: number): VectorNode {
  const source = asRecord(value);
  const mirrorValue = String(first(source, "mirror") ?? "straight") as MirrorMode;
  return {
    id: optionalString(first(source, "id"))?.trim() || `node-${index}`,
    x: finiteNumber(first(source, "x"), 0),
    y: finiteNumber(first(source, "y"), 0),
    handleIn: asPoint(first(source, "handleIn", "handle_in")),
    handleOut: asPoint(first(source, "handleOut", "handle_out")),
    mirror: MIRROR_MODES.has(mirrorValue) ? mirrorValue : "straight",
  };
}

function asPoint(value: unknown): { x: number; y: number } | undefined {
  if (value === undefined || value === null) return undefined;
  const source = asRecord(value);
  return {
    x: finiteNumber(source.x, 0),
    y: finiteNumber(source.y, 0),
  };
}

function normalizeShadow(value: unknown): CanvasLayer["shadow"] {
  if (value === undefined || value === null) return undefined;
  const source = asRecord(value);
  return {
    color:
      optionalString(first(source, "color", "shadowColor", "shadow_color"))
        ?? "#000000",
    blur: Math.max(
      finiteNumber(first(source, "blur", "shadowBlur", "shadow_blur"), 0),
      0,
    ),
    offsetX: finiteNumber(
      first(source, "offsetX", "offset_x", "shadowOffsetX", "shadow_offset_x"),
      0,
    ),
    offsetY: finiteNumber(
      first(source, "offsetY", "offset_y", "shadowOffsetY", "shadow_offset_y"),
      0,
    ),
  };
}

export function normalizeCanvasLayer(
  value: unknown,
  index = 0,
): CanvasLayer {
  const source = asRecord(value);
  const parent = first(source, "parentId", "parent_id");
  const nodes = first(source, "nodes");
  const layerType = normalizeLayerType(first(source, "type"));

  return {
    id: optionalString(first(source, "id"))?.trim() || `layer-${index}`,
    parentId:
      parent === null
        ? null
        : optionalString(parent),
    type: layerType,
    name: optionalString(first(source, "name")),
    x: finiteNumber(first(source, "x"), 0),
    y: finiteNumber(first(source, "y"), 0),
    width: Math.max(finiteNumber(first(source, "width"), 0), 0),
    height: Math.max(finiteNumber(first(source, "height"), 0), 0),
    rotation: finiteNumber(first(source, "rotation"), 0),
    opacity: Math.min(Math.max(finiteNumber(first(source, "opacity"), 1), 0), 1),
    zIndex: Math.round(finiteNumber(first(source, "zIndex", "z_index"), index)),
    visible: booleanValue(first(source, "visible"), true),
    locked: booleanValue(first(source, "locked"), false),
    text: optionalString(first(source, "text")),
    fontFamily: layerType === "text" || first(source, "fontFamily", "font_family")
      ? normalizeFontFamily(first(source, "fontFamily", "font_family"))
      : undefined,
    fontSize: optionalNumber(first(source, "fontSize", "font_size")),
    fontWeight: normalizeFontWeight(first(source, "fontWeight", "font_weight")),
    fontStyle: normalizeFontStyle(first(source, "fontStyle", "font_style")),
    textAlign: normalizeTextAlign(first(source, "textAlign", "text_align")),
    color: optionalString(first(source, "color")),
    fill: optionalString(first(source, "fill")),
    stroke: optionalString(first(source, "stroke")),
    strokeWidth: optionalNumber(first(source, "strokeWidth", "stroke_width")),
    borderRadius: optionalNumber(first(source, "borderRadius", "border_radius")),
    pathData: optionalString(first(source, "pathData", "path", "path_data")),
    closed: booleanValue(first(source, "closed"), false),
    points: optionalString(first(source, "points", "polygon")),
    shadow: normalizeShadow(first(source, "shadow")),
    imageUrl: optionalString(first(source, "imageUrl", "image_url")),
    qrValue: optionalString(first(source, "qrValue", "qr_value")),
    nodes: Array.isArray(nodes)
      ? nodes.map(normalizeVectorNode)
      : undefined,
  };
}

export function normalizeCanvasLayers(value: unknown): CanvasLayer[] {
  return Array.isArray(value)
    ? value.map(normalizeCanvasLayer)
    : [];
}
