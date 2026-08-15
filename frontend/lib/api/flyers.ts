import {
  blobHandler,
  handler,
  resolveAssetUrl,
} from "@/lib/api/api";
import { cachedQuery } from "@/lib/api/query-cache";

import type { EventType } from "@/lib/types/event";
import type {
  FlyerConfiguration,
  FlyerRecord,
  FlyerTemplate,
  TemplateCategory,
} from "@/lib/types/flyer";
import { normalizeCanvasLayers } from "@/lib/flyer/normalizeLayers";

export interface FlyerTemplateFilters {
  category?: TemplateCategory;
  eventType?: EventType;
}

export async function uploadFlyer(
  file: File,
  configuration: FlyerConfiguration,
  eventId?: string,
): Promise<FlyerRecord> {
  const formData = new FormData();

  formData.append("file", file);
  formData.append(
    "image_width",
    String(configuration.image_width),
  );
  formData.append(
    "image_height",
    String(configuration.image_height),
  );
  formData.append(
    "canvas_background_color",
    configuration.canvas_background_color,
  );
  formData.append(
    "qr_foreground_color",
    configuration.qr_foreground_color,
  );
  formData.append(
    "qr_background_color",
    configuration.qr_background_color,
  );
  formData.append(
    "qr_background_transparent",
    String(configuration.qr_background_transparent),
  );
  formData.append(
    "qr_visibility",
    configuration.qr_visibility,
  );
  formData.append(
    "qr_bounds_json",
    JSON.stringify(configuration.qr_bounds),
  );

  if (eventId) {
    formData.append("event_id", eventId);
  }

  const record = await handler<FlyerRecord>(
    "/api/v1/flyers",
    {
      method: "POST",
      body: formData,
      auth: true,
    },
  );

  return {
    ...record,
    image_url: resolveAssetUrl(record.image_url),
  };
}

export function updateFlyerConfiguration(
  flyerId: string,
  configuration: Partial<FlyerConfiguration>,
): Promise<FlyerRecord> {
  return handler<FlyerRecord>(
    `/api/v1/flyers/${encodeURIComponent(flyerId)}`,
    {
      method: "PATCH",
      json: configuration,
      auth: true,
    },
  );
}

export function fetchFlyerTemplates(
  filters: FlyerTemplateFilters = {},
): Promise<FlyerTemplate[]> {
  const searchParams = new URLSearchParams();

  if (filters.category) {
    searchParams.set(
      "category",
      filters.category,
    );
  }

  if (filters.eventType) {
    searchParams.set(
      "event_type",
      filters.eventType,
    );
  }

  const query = searchParams.toString();

  const path = `/api/v1/flyers/templates${query ? `?${query}` : ""}`;
  return cachedQuery(
    `flyer-templates:${query}`,
    async () => {
      const templates = await handler<FlyerTemplate[]>(path, { auth: false });
      return templates.map((template) => ({
        ...template,
        layers: normalizeCanvasLayers(template.layers),
      }));
    },
    { ttlMs: 300_000 },
  );
}

export function renderStoredGuestInvitation(
  eventId: string,
  guestId: string,
  format: "png" | "jpg",
  category?: string,
): Promise<Blob> {
  return blobHandler(
    "/api/v1/flyers/render-saved-invitation",
    {
      method: "POST",
      auth: true,
      json: {
        event_id: eventId,
        guest_id: guestId,
        format,
        category: category?.trim() || null,
      },
    },
  );
}
