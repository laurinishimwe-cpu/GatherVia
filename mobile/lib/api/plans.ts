import { handler } from "@/lib/api/api";
import { cachedQuery, invalidateCachedQuery, prefetchQuery } from "@/lib/api/query-cache";
import type { UserTier } from "@/lib/types/auth";

export interface MobilePlanCatalogItem {
  tier: UserTier;
  name: string;
  guest_limit: number;
  billing_period: "P1M";
  description: string;
}

export interface PlanAvailability {
  google_play: boolean;
  app_store: boolean;
}

export interface PlanCatalogResponse {
  plans: MobilePlanCatalogItem[];
  availability: PlanAvailability;
}

export interface SubscriptionStatus {
  tier: UserTier;
  guest_limit: number;
  active: boolean;
  status: "free" | "active" | "cancelled" | "billing_issue" | "paused" | "expired";
  billing_period: "P1M" | null;
  started_at: string | null;
  expires_at: string | null;
  product_id: string | null;
  store: "google_play" | "app_store" | null;
  auto_renews: boolean;
  availability: PlanAvailability;
}

export interface GuestLimitStatus {
  allowed: boolean;
  current: number;
  limit: number;
  tier: UserTier;
}

export function fetchPlanCatalog(): Promise<PlanCatalogResponse> {
  return cachedQuery(
    "plan-catalog",
    () => handler<PlanCatalogResponse>("/api/v1/plans/catalog", { auth: false }),
    { ttlMs: 300_000 },
  );
}

export function fetchSubscriptionStatus(options: { force?: boolean } = {}): Promise<SubscriptionStatus> {
  return cachedQuery(
    "subscription-status",
    () => handler<SubscriptionStatus>("/api/v1/plans/status"),
    { ttlMs: 30_000, force: options.force },
  );
}

export async function syncPlanSubscription(): Promise<SubscriptionStatus> {
  const status = await handler<SubscriptionStatus>("/api/v1/plans/sync", { method: "POST" });
  invalidateCachedQuery("subscription-status");
  invalidateCachedQuery("guest-limit:");
  return status;
}

export function checkGuestLimit(
  eventId: string,
  options: { force?: boolean } = {},
): Promise<GuestLimitStatus> {
  return cachedQuery(
    `guest-limit:${eventId}`,
    () => handler<GuestLimitStatus>(
      `/api/v1/guests/events/${encodeURIComponent(eventId)}/limit`,
    ),
    { ttlMs: 15_000, force: options.force },
  );
}

export function invalidateGuestLimit(eventId?: string) {
  invalidateCachedQuery(eventId ? `guest-limit:${eventId}` : "guest-limit:");
}

export function prefetchWorkspacePlanData(eventId: string, includeGuestUsage = true) {
  prefetchQuery(fetchPlanCatalog());
  prefetchQuery(fetchSubscriptionStatus());
  if (includeGuestUsage) prefetchQuery(checkGuestLimit(eventId));
}
