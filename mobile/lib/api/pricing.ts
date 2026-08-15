import { handler } from "@/lib/api/api";
import type {
  PricingQuote,
  SetupCompletePayload,
  SetupCompleteResponse,
} from "@/lib/types/pricing";

export function fetchPricingQuote(guestCapacity: number): Promise<PricingQuote> {
  return handler<PricingQuote>("/api/v1/pricing/quote", {
    method: "POST",
    json: { guest_capacity: guestCapacity },
    auth: false,
  });
}

export function completeSetup(
  payload: SetupCompletePayload,
): Promise<SetupCompleteResponse> {
  return handler<SetupCompleteResponse>("/api/v1/events/setup/complete", {
    method: "POST",
    json: payload,
  });
}
