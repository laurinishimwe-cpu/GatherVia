import { handler } from "@/lib/api/api";
import { cachedQuery, invalidateCachedQuery, prefetchQuery } from "@/lib/api/query-cache";
import type { AuthUser, UserTier } from "@/lib/types/auth";

export interface PlanDefinition {
  tier: UserTier;
  name: string;
  price: number | null;
  guestLimit: number;
  description: string;
}

export interface GuestLimitStatus {
  allowed: boolean;
  current: number;
  limit: number;
  tier: UserTier;
}

export const PLAN_DEFINITIONS: readonly PlanDefinition[] = [
  {
    tier: "free",
    name: "Free",
    price: 0,
    guestLimit: 50,
    description: "Everything needed for intimate events.",
  },
  {
    tier: "basic",
    name: "Basic",
    price: null,
    guestLimit: 150,
    description: "Monthly capacity for growing guest lists.",
  },
  {
    tier: "pro",
    name: "Pro",
    price: null,
    guestLimit: 500,
    description: "Monthly capacity for large events.",
  },
] as const;

export async function fetchUserTier(): Promise<UserTier> {
  const user = await cachedQuery(
    "user-tier",
    () => handler<Pick<AuthUser, "tier">>("/api/v1/auth/me"),
    { ttlMs: 60_000 },
  );
  return user.tier;
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
  prefetchQuery(fetchUserTier());
  if (includeGuestUsage) prefetchQuery(checkGuestLimit(eventId));
}
