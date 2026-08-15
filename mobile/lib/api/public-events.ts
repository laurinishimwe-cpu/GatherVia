import type { EventRecord } from "@/lib/types/event";
import { getApiBaseUrl } from "@/lib/api/api";

interface PublicEventResponse {
  event: EventRecord;
  flyer_image_url: string | null;
}

export async function fetchPublicEventBySlug(slug: string): Promise<PublicEventResponse> {
  const response = await fetch(`${getApiBaseUrl()}/api/v1/events/slug/${slug}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Event not found.");
  }

  return response.json() as Promise<PublicEventResponse>;
}
