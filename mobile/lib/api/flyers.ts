import * as FileSystem from "expo-file-system/legacy";
import { getApiBaseUrl, handler, renewAuthToken, resolveAssetUrl } from "@/lib/api/api";
import { cachedQuery } from "@/lib/api/query-cache";
import type { FlyerConfiguration, FlyerRecord, FlyerTemplate } from "@/lib/types/flyer";
import type { EventType } from "@/lib/types/event";
import { normalizeCanvasLayers } from "@/lib/flyer/normalizeLayers";

export interface NativeImageUpload {
  uri: string;
  name: string;
  type: string;
}

export type FlyerUploadSource = File | NativeImageUpload;

export async function uploadFlyer(
  file: FlyerUploadSource,
  configuration: FlyerConfiguration,
  eventId?: string,
): Promise<FlyerRecord> {
  const formData = new FormData();
  formData.append("file", file as unknown as Blob);
  formData.append("image_width", String(configuration.image_width));
  formData.append("image_height", String(configuration.image_height));
  formData.append("canvas_background_color", configuration.canvas_background_color);
  formData.append("qr_foreground_color", configuration.qr_foreground_color);
  formData.append("qr_background_color", configuration.qr_background_color);
  formData.append(
    "qr_background_transparent",
    String(configuration.qr_background_transparent),
  );
  formData.append("qr_visibility", configuration.qr_visibility);
  formData.append("qr_bounds_json", JSON.stringify(configuration.qr_bounds));
  if (eventId) formData.append("event_id", eventId);

  const record = await handler<FlyerRecord>("/api/v1/flyers", {
    method: "POST",
    body: formData,
    auth: true,
  });

  return {
    ...record,
    image_url: resolveAssetUrl(record.image_url),
  };
}

export function updateFlyerConfiguration(
  flyerId: string,
  configuration: Partial<FlyerConfiguration>,
): Promise<FlyerRecord> {
  return handler<FlyerRecord>(`/api/v1/flyers/${flyerId}`, {
    method: "PATCH",
    json: configuration,
  });
}

export function fetchFlyerTemplates(
  eventType?: EventType,
): Promise<FlyerTemplate[]> {
  const query = eventType ? `?event_type=${eventType}` : "";
  return cachedQuery(
    `flyer-templates:${eventType ?? "all"}`,
    async () => {
      const templates = await handler<FlyerTemplate[]>(
        `/api/v1/flyers/templates${query}`,
        { auth: false },
      );
      return templates.map((template) => ({
        ...template,
        layers: normalizeCanvasLayers(template.layers),
      }));
    },
    { ttlMs: 300_000 },
  );
}

export async function downloadStoredGuestInvitation(
  eventId: string,
  guestId: string,
  format: "png" | "jpg",
  category?: string,
): Promise<string> {
  if (!FileSystem.cacheDirectory) throw new Error("Temporary storage is unavailable.");
  const token = await renewAuthToken();

  const destination = `${FileSystem.cacheDirectory}gatekeep-${eventId}-${guestId}-${Date.now()}.${format}`;
  const categoryQuery = category === undefined ? "" : `&category=${encodeURIComponent(category)}`;
  const url = `${getApiBaseUrl()}/api/v1/flyers/render-saved-invitation/${eventId}/${guestId}?format=${format}${categoryQuery}`;
  const result = await FileSystem.downloadAsync(url, destination, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (result.status < 200 || result.status >= 300) {
    await FileSystem.deleteAsync(destination, { idempotent: true });
    throw new Error("Could not generate the latest saved invitation.");
  }
  return result.uri;
}
