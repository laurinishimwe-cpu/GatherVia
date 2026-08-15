import { handler } from "@/lib/api/api";
import { cachedQuery, invalidateCachedQuery, prefetchQuery } from "@/lib/api/query-cache";
import { invalidateGuestLimit } from "@/lib/api/plans";
import type {
  GuestListResponse,
  GuestNameScanRequest,
  GuestQrCodeRequest,
  GuestQrCodeResponse,
  GuestOwnerView,
  GuestStaffCheckInRequest,
  GuestScanRequest,
  GuestScanResponse,
  GuestScannerContextResponse,
  GuestStatusUpdateRequest,
  EventAnalytics,
  GuestCreateRequest,
} from "@/lib/types/guest";

export function generateGuestQrCodes(
  payload: GuestQrCodeRequest,
): Promise<GuestQrCodeResponse> {
  return handler<GuestQrCodeResponse>("/api/v1/guests/qr-codes", {
    method: "POST",
    json: payload,
  });
}

export function resolveGuestScan(
  payload: GuestScanRequest,
): Promise<GuestScanResponse> {
  return handler<GuestScanResponse>("/api/v1/guests/staff/scan", {
    method: "POST",
    json: payload,
    auth: false,
  });
}

export function resolveGuestScanByName(
  payload: GuestNameScanRequest,
): Promise<GuestScanResponse> {
  return handler<GuestScanResponse>("/api/v1/guests/staff/scan-name", {
    method: "POST",
    json: payload,
    auth: false,
  });
}

export function fetchStaffScannerContext(
  shareToken: string,
): Promise<GuestScannerContextResponse> {
  return handler<GuestScannerContextResponse>(
    `/api/v1/guests/staff/context/${shareToken}`,
    { auth: false },
  );
}

export function checkInGuestFromStaff(
  payload: GuestStaffCheckInRequest,
): Promise<GuestScanResponse> {
  return handler<GuestScanResponse>("/api/v1/guests/staff/check-in", {
    method: "POST",
    json: payload,
    auth: false,
  });
}

export function fetchEventGuests(
  eventId: string,
  options: { force?: boolean } = {},
): Promise<GuestListResponse> {
  return cachedQuery(
    `event-guests:${eventId}`,
    () => handler<GuestListResponse>(`/api/v1/guests/events/${eventId}`, { auth: true }),
    { ttlMs: 15_000, force: options.force },
  );
}

export async function createEventGuest(
  eventId: string,
  payload: GuestCreateRequest,
): Promise<GuestOwnerView> {
  const guest = await handler<GuestOwnerView>(`/api/v1/guests/events/${encodeURIComponent(eventId)}`, {
    method: "POST",
    auth: true,
    json: payload,
  });
  invalidateCachedQuery(`event-guests:${eventId}`);
  invalidateCachedQuery(`event-analytics:${eventId}`);
  invalidateGuestLimit(eventId);
  return guest;
}

export async function updateGuestStatus(
  guestId: string,
  payload: GuestStatusUpdateRequest,
): Promise<GuestOwnerView> {
  const guest = await handler<GuestOwnerView>(`/api/v1/guests/${guestId}/status`, {
    method: "PATCH",
    json: payload,
  });
  invalidateCachedQuery("event-guests:");
  invalidateCachedQuery("event-analytics:");
  return guest;
}

export async function deleteGuest(guestId: string): Promise<void> {
  await handler(`/api/v1/guests/${guestId}`, {
    method: "DELETE",
    auth: true,
  });
  invalidateCachedQuery("event-guests:");
  invalidateCachedQuery("event-analytics:");
  invalidateGuestLimit();
}


export async function fetchEventAnalytics(eventId: string): Promise<EventAnalytics> {
  return cachedQuery(
    `event-analytics:${eventId}`,
    () => handler<EventAnalytics>(`/api/v1/guests/events/${eventId}/analytics`),
    { ttlMs: 15_000 },
  );
}

export function prefetchEventGuests(eventId: string) {
  prefetchQuery(fetchEventGuests(eventId));
}
