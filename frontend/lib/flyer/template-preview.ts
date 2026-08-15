import {
  DEFAULT_FLYER_CONFIGURATION,
  type FlyerConfiguration,
  type FlyerTemplate,
  type QrBounds,
} from "@/lib/types/flyer";
import type { CanvasLayer } from "@/lib/types/canvas";
import { normalizeCanvasLayers } from "@/lib/flyer/normalizeLayers";
import { normalizeFlyerFontConfiguration } from "@/lib/flyer/fontRegistry";

export interface FlyerTemplateDraft {
  configuration: FlyerConfiguration;
  layers: CanvasLayer[];
}

const DEFAULT_TEMPLATE_WIDTH = 1080;
const DEFAULT_TEMPLATE_HEIGHT = 1920;

type NullableFlyerConfiguration = {
  [Key in keyof FlyerConfiguration]?: FlyerConfiguration[Key] | null;
};

export function qrBoundsFromLayer(
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

export function buildConfigurationFromTemplate(
  template: FlyerTemplate,
  imageWidth = DEFAULT_TEMPLATE_WIDTH,
  imageHeight = DEFAULT_TEMPLATE_HEIGHT,
): FlyerConfiguration {
  const rawPersistedConfiguration =
    template.configuration as NullableFlyerConfiguration | undefined;
  const persistedConfiguration = Object.fromEntries(
    Object.entries(rawPersistedConfiguration ?? {}).filter(
      ([, value]) => value !== null && value !== undefined,
    ),
  ) as Partial<FlyerConfiguration>;
  const resolvedImageWidth =
    persistedConfiguration?.image_width ?? imageWidth;
  const resolvedImageHeight =
    persistedConfiguration?.image_height ?? imageHeight;
  const defaults = DEFAULT_FLYER_CONFIGURATION(
    resolvedImageWidth,
    resolvedImageHeight,
  );
  const qrLayer = template.layers?.find((layer) => layer.type === "qr");
  const persistedQrBounds =
    persistedConfiguration?.qr_bounds;
  const qrBounds = persistedQrBounds
    ? {
        ...defaults.qr_bounds,
        ...persistedQrBounds,
      }
    : qrLayer
      ? qrBoundsFromLayer(
          qrLayer,
          resolvedImageWidth,
          resolvedImageHeight,
        )
      : defaults.qr_bounds;

  return normalizeFlyerFontConfiguration({
    ...defaults,
    ...persistedConfiguration,
    canvas_background_color:
      persistedConfiguration?.canvas_background_color ??
      template.canvas_background_color ??
      defaults.canvas_background_color,
    qr_foreground_color:
      persistedConfiguration?.qr_foreground_color ??
      template.qr_foreground_color ??
      defaults.qr_foreground_color,
    qr_background_color:
      persistedConfiguration?.qr_background_color ??
      template.qr_background_color ??
      defaults.qr_background_color,
    qr_background_transparent:
      persistedConfiguration?.qr_background_transparent ??
      template.qr_background_transparent ??
      defaults.qr_background_transparent,
    stub_accent_color:
      persistedConfiguration?.stub_accent_color ??
      template.accent_color ??
      defaults.stub_accent_color,
    qr_bounds: qrBounds,
    artboard_stroke_color:
      persistedConfiguration?.artboard_stroke_color ??
      defaults.artboard_stroke_color,
    artboard_stroke_width:
      persistedConfiguration?.artboard_stroke_width ??
      defaults.artboard_stroke_width,
  });
}

export function buildFlyerTemplateDraft(
  template: FlyerTemplate,
): FlyerTemplateDraft {
  const configuration = buildConfigurationFromTemplate(template);

  const layers: CanvasLayer[] = normalizeCanvasLayers(template.layers).map((l) => ({
    ...l,
    id: l.id || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    rotation: l.rotation ?? 0,
    opacity: l.opacity ?? 1,
    zIndex: l.zIndex ?? 0,
    visible: l.visible ?? true,
    locked: l.locked ?? false,
    parentId: "main-frame",      
  }));

  return {
    configuration,
    layers,
  };
}
