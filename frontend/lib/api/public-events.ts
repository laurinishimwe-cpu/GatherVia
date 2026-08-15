import type { EventRecord } from "@/lib/types/event";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

interface PublicEventResponse {
  event: EventRecord;
  flyer_image_url: string | null;
}

export async function fetchPublicEventBySlug(slug: string): Promise<PublicEventResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/events/slug/${slug}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Event not found.");
  }

  return response.json() as Promise<PublicEventResponse>;
}
