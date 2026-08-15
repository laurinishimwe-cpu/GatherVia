import type { CanvasLayer } from "@/lib/types/canvas";
import { normalizeCanvasLayers } from "@/lib/flyer/normalizeLayers";
import { normalizeFlyerFontConfiguration } from "@/lib/flyer/fontRegistry";
import {
  DEFAULT_FLYER_CONFIGURATION,
  type FlyerConfiguration,
  type FlyerTemplate,
  type QrBounds,
} from "@/lib/types/flyer";

interface FlyerTemplateDraft {
  configuration: FlyerConfiguration;
  layers: CanvasLayer[];
}

type NullableFlyerConfiguration = {
  [Key in keyof FlyerConfiguration]?: FlyerConfiguration[Key] | null;
};

function qrBoundsFromLayer(
  layer: Pick<CanvasLayer, "x" | "y" | "width" | "height">,
  imageWidth: number,
  imageHeight: number,
): QrBounds {
  return {
    x: Math.round((layer.x / 100) * imageWidth),
    y: Math.round((layer.y / 100) * imageHeight),
    width: Math.round((layer.width / 100) * imageWidth),
    height: Math.round((layer.height / 100) * imageHeight),
  };
}

export function buildFlyerTemplateDraft(template: FlyerTemplate): FlyerTemplateDraft {
  const rawConfiguration = template.configuration as NullableFlyerConfiguration | undefined;
  const persistedConfiguration = Object.fromEntries(
    Object.entries(rawConfiguration ?? {}).filter(([, value]) => value !== null && value !== undefined),
  ) as Partial<FlyerConfiguration>;
  const imageWidth = persistedConfiguration.image_width ?? 1080;
  const imageHeight = persistedConfiguration.image_height ?? 1920;
  const defaults = DEFAULT_FLYER_CONFIGURATION(imageWidth, imageHeight);
  const qrLayer = template.layers?.find((layer) => layer.type === "qr");
  const qrBounds = persistedConfiguration.qr_bounds
    ? { ...defaults.qr_bounds, ...persistedConfiguration.qr_bounds }
    : qrLayer
      ? qrBoundsFromLayer(qrLayer, imageWidth, imageHeight)
      : defaults.qr_bounds;

  const configuration: FlyerConfiguration = normalizeFlyerFontConfiguration({
    ...defaults,
    ...persistedConfiguration,
    canvas_background_color:
      persistedConfiguration.canvas_background_color ?? template.canvas_background_color ?? defaults.canvas_background_color,
    qr_foreground_color:
      persistedConfiguration.qr_foreground_color ?? template.qr_foreground_color ?? defaults.qr_foreground_color,
    qr_background_color:
      persistedConfiguration.qr_background_color ?? template.qr_background_color ?? defaults.qr_background_color,
    qr_background_transparent:
      persistedConfiguration.qr_background_transparent ?? template.qr_background_transparent ?? defaults.qr_background_transparent,
    stub_accent_color:
      persistedConfiguration.stub_accent_color ?? template.accent_color ?? defaults.stub_accent_color,
    qr_bounds: qrBounds,
  });

  const layers = normalizeCanvasLayers(template.layers).map((layer, index): CanvasLayer => ({
    ...layer,
    id: layer.id || `template-${Date.now()}-${index}`,
    parentId: layer.parentId === undefined ? "main-frame" : layer.parentId,
    rotation: layer.rotation ?? 0,
    opacity: layer.opacity ?? 1,
    zIndex: layer.zIndex ?? index,
    visible: layer.visible ?? true,
    locked: layer.locked ?? false,
    closed: layer.closed ?? false,
  }));

  return { configuration, layers };
}
