import { handler } from "@/lib/api/api";
import { cachedQuery } from "@/lib/api/query-cache";
import type {
  AdminAccessRequest,
  AdminPinUpdateRequest,
  AdminRsvpContextResponse,
  AdminShareLinkRequest,
  AdminShareLinkResponse,
  FlyerDispatchResponse,
  FlyerEmailSendRequest,
  FlyerWhatsAppSendRequest,
  EventPublicLinksResponse,
} from "@/lib/types/communications";

export function fetchEventPublicLinks(eventId: string): Promise<EventPublicLinksResponse> {
  return cachedQuery(
    `event-public-links:${eventId}`,
    () => handler<EventPublicLinksResponse>(
      `/api/v1/communications/event-links/${encodeURIComponent(eventId)}`,
    ),
    { ttlMs: 300_000 },
  );
}

export function createAdminShareLink(
  eventIdOrPayload: string | AdminShareLinkRequest,
  label?: string,
): Promise<AdminShareLinkResponse> {
  const payload =
    typeof eventIdOrPayload === "string"
      ? {
          event_id: eventIdOrPayload,
          link_label: label?.trim() || "admin",
        }
      : eventIdOrPayload;

  return handler<AdminShareLinkResponse>("/api/v1/communications/admin-share-link", {
    method: "POST",
    json: payload,
  });
}

export function fetchAdminShareLinks(
  eventId: string,
): Promise<AdminShareLinkResponse[]> {
  return handler<AdminShareLinkResponse[]>(
    `/api/v1/communications/admin-links/${eventId}`,
  );
}

export function fetchAdminRsvpContext(
  eventId: string,
): Promise<AdminRsvpContextResponse> {
  return handler<AdminRsvpContextResponse>(
    `/api/v1/communications/admin-rsvp/${eventId}`,
    { auth: false },
  );
}

export function requestAdminAccess(
  eventId: string,
  payload: AdminAccessRequest,
): Promise<AdminShareLinkResponse> {
  return handler<AdminShareLinkResponse>(
    `/api/v1/communications/admin-rsvp/${eventId}`,
    {
      method: "POST",
      json: payload,
      auth: false,
    },
  );
}

export function toggleAdminShareLink(
  linkId: string,
): Promise<AdminShareLinkResponse> {
  return handler<AdminShareLinkResponse>(
    `/api/v1/communications/admin-links/${linkId}/toggle`,
    { method: "PATCH" },
  );
}

export function updateAdminShareLinkPin(
  linkId: string,
  payload: AdminPinUpdateRequest,
): Promise<AdminShareLinkResponse> {
  return handler<AdminShareLinkResponse>(
    `/api/v1/communications/admin-links/${linkId}/pin`,
    {
      method: "PATCH",
      json: payload,
    },
  );
}

export function deleteAdminShareLink(linkId: string): Promise<void> {
  return handler<void>(`/api/v1/communications/admin-links/${linkId}`, {
    method: "DELETE",
  });
}

export function sendFlyerByEmail(
  payload: FlyerEmailSendRequest,
): Promise<FlyerDispatchResponse> {
  return handler<FlyerDispatchResponse>("/api/v1/communications/flyers/email", {
    method: "POST",
    json: payload,
  });
}

export function sendFlyerByWhatsApp(
  payload: FlyerWhatsAppSendRequest,
): Promise<FlyerDispatchResponse> {
  return handler<FlyerDispatchResponse>(
    "/api/v1/communications/flyers/whatsapp",
    {
      method: "POST",
      json: payload,
    },
  );
}
