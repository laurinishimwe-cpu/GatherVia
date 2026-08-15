export interface ProFeature {
  key: string;
  label: string;
  description: string;
  min_capacity: number;
}

export interface PricingQuote {
  guest_capacity: number;
  tier: string;
  tier_label: string;
  base_fee: number;
  price_per_guest: number;
  total_price: number;
  unlocked_pro_features: ProFeature[];
}

export interface SetupCompletePayload {
  flyer_id: string;
  guest_capacity: number;
  event_title: string;
  event_type: string;
  event_date: string;
}

export interface SetupCompleteResponse {
  event_id: string;
  flyer_id: string;
  tier: string;
  total_price: number;
  guest_capacity: number;
}
