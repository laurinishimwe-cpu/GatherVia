import { handler } from "@/lib/api/api";
import { cachedQuery, invalidateCachedQuery, setCachedQuery } from "@/lib/api/query-cache";
import type { EventRecord } from "@/lib/types/event";
import { normalizeCanvasLayers } from "@/lib/flyer/normalizeLayers";

interface BackendEventRecord extends Omit<EventRecord, "id"> {
  _id?: string;
  id?: string;
}

interface PublicEventResponse {
  event: BackendEventRecord;
  flyer_image_url: string | null;
}

export function normalizeEvent(record: BackendEventRecord): EventRecord{
  return {
    ...record,
    id: record.id ?? record._id ?? "",
    design_layers: normalizeCanvasLayers(record.design_layers),
    event_date: typeof record.event_date === "string" ? record.event_date : null,
    created_at:
      typeof record.created_at === "string"
        ? record.created_at
        : String(record.created_at),
  };
}

export async function fetchEventById(
  eventId: string,
  options: { force?: boolean } = {},
): Promise<EventRecord> {
  return cachedQuery(
    `event:${eventId}`,
    async () => normalizeEvent(await handler<BackendEventRecord>(`/api/v1/events/${eventId}`, { auth: true })),
    { ttlMs: 60_000, force: options.force },
  );
}

export async function fetchEventBySlug(slug: string): Promise<EventRecord> {
  const response = await handler<PublicEventResponse>(`/api/v1/events/slug/${slug}`, {
    auth: false,
  });
  return normalizeEvent(response.event);
}

export function createMockEvent(
  overrides: Partial<EventRecord> = {},
): EventRecord {
  return {
    id: overrides.id ?? "demo-corporate-event",   
    owner_id: overrides.owner_id ?? "demo-owner",
    title: overrides.title ?? "Acme Corporate Summit",
    slug: overrides.slug ?? `event-${overrides.id ?? "demo"}`,
    flyer_id: overrides.flyer_id ?? null,
    event_type: overrides.event_type ?? "corporate",
    event_date: Object.prototype.hasOwnProperty.call(overrides, "event_date")
      ? overrides.event_date ?? null
      : "2026-09-15",
    event_timezone: overrides.event_timezone ?? "UTC",
    configuration: {
      ui_language: "en",
      wording_dictionary: {
        guest_label_singular: "Client",
        guest_label_plural: "Clients",
      },
      allowed_admin_fields: ["name", "seat_assignment", "category"],
      invitation_categories_enabled: true,
      invitation_categories: ["General", "VIP"],
      ...overrides.configuration,
    },
    created_at: overrides.created_at ?? new Date().toISOString(),
  };
}

export async function deleteEvent(eventId: string): Promise<void> {
  await handler(`/api/v1/events/${eventId}`, {
    method: "DELETE",
    auth: true,
  });
  invalidateCachedQuery(`event:${eventId}`);
}

export async function updateEvent(
  eventId: string,
  patch: Partial<EventRecord>,
): Promise<EventRecord> {
  const response = await handler<BackendEventRecord | { status: string }>(`/api/v1/events/${eventId}`, {
    method: "PATCH",
    auth: true,
    json: patch,
  });
  if ("id" in response || "_id" in response) {
    const event = normalizeEvent(response as BackendEventRecord);
    setCachedQuery(`event:${eventId}`, event, 60_000);
    return event;
  }
  invalidateCachedQuery(`event:${eventId}`);
  return fetchEventById(eventId, { force: true });
}
