import { SETUP_FLOW_STORAGE_KEY } from "@/lib/constants/cookies";
import type { FlyerConfiguration } from "@/lib/types/flyer";
import type { PricingQuote } from "@/lib/types/pricing";

export interface SetupFlowState {
  flyerId: string | null;
  flyerImageUrl: string | null;
  flyerConfiguration: FlyerConfiguration | null;
  flyerTemplateId: string | null;
  flyerTemplateTitle: string | null;
  pricingQuote: PricingQuote | null;
  guestCapacity: number;
  eventTitle: string;
}

export const DEFAULT_SETUP_FLOW: SetupFlowState = {
  flyerId: null,
  flyerImageUrl: null,
  flyerConfiguration: null,
  flyerTemplateId: null,
  flyerTemplateTitle: null,
  pricingQuote: null,
  guestCapacity: 75,
  eventTitle: "My Event",
};

export function readSetupFlow(): SetupFlowState {
  if (typeof window === "undefined") {
    return DEFAULT_SETUP_FLOW;
  }

  const raw = window.sessionStorage.getItem(SETUP_FLOW_STORAGE_KEY);
  if (!raw) {
    return DEFAULT_SETUP_FLOW;
  }

  try {
    return { ...DEFAULT_SETUP_FLOW, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETUP_FLOW;
  }
}

export function persistSetupFlow(state: SetupFlowState): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(SETUP_FLOW_STORAGE_KEY, JSON.stringify(state));
}

export function clearSetupFlow(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(SETUP_FLOW_STORAGE_KEY);
}
