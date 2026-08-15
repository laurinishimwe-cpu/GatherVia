import { FlyerConfiguration } from "./flyer";
import type { CanvasLayer } from "./canvas";

export type EventType =
  | "marriage"
  | "corporate"
  | "private"
  | "conference"
  | "gala"
  | "other";

export interface WordingDictionary {
  guest_label_singular: string;
  guest_label_plural: string;
  [key: string]: string;
}

export interface EventConfiguration {
  ui_language: string;
  wording_dictionary: WordingDictionary;
  allowed_admin_fields: string[];
  invitation_categories_enabled?: boolean;
  invitation_categories?: string[];
}

export interface EventRecord {
  id: string;
  owner_id: string;
  title: string;
  slug: string;
  flyer_id?: string | null;
  event_type: EventType;
  event_date: string | null;
  event_time?: string | null;
  event_timezone?: string;
  event_location?: string | null;
  configuration: EventConfiguration;
  created_at: string;
  design_layers?: CanvasLayer[];
  design_configuration?: FlyerConfiguration;
  flyer_image_url?: string | null;
  require_rsvp_approval?: boolean;
}

export interface EventSessionPayload {
  event: EventRecord;
  language: string;
  wording: WordingDictionary;
}
