import type { CanvasLayer } from "@/lib/types/canvas";

export const FLYER_TEXT_LINE_HEIGHT = 1.1;

export function resolveLayerFontWeight(weight: CanvasLayer["fontWeight"]): number {
  if (weight === "semibold" || weight === "bold") return 700;
  return 400;
}
