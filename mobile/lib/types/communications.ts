export type CommunicationChannel = "email" | "whatsapp";

export interface AdminShareLinkRequest {
  event_id: string;
  link_label?: string;
}

export interface AdminAccessRequest {
  admin_name: string;
}

export interface AdminRsvpContextResponse {
  event_id: string;
  event_title: string;
}

export interface EventPublicLinksResponse {
  event_id: string;
  invite_url: string;
  admin_rsvp_url: string;
}

export interface AdminActivityEntry {
  timestamp: string;
  status: string;
  door_id: string;
  action: string;
  outcome: string;
  severity: string;
  lookup_method: string;
  reason?: string | null;
  guest_id: string;
  guest_name: string;
  guest_category: string;
}

export interface AdminActivitySummary {
  scanned_in: number;
  scanned_out: number;
  denied: number;
  duplicate_denied: number;
  logs: AdminActivityEntry[];
}

export interface AdminShareLinkResponse {
  id: string;
  user_id: string;
  event_id: string;
  link_label: string;
  share_token: string;
  share_url: string;
  enabled: boolean;
  pin_enabled: boolean;
  pin_code?: string | null;
  activity: AdminActivitySummary;
  created_at: string;
}

export interface AdminPinUpdateRequest {
  pin_enabled: boolean;
  pin_code?: string | null;
}

export interface FlyerEmailSendRequest {
  event_id: string;
  flyer_id: string;
  recipient_email: string;
  recipient_name: string;
  subject?: string;
  message?: string;
}

export interface FlyerWhatsAppSendRequest {
  event_id: string;
  flyer_id: string;
  recipient_phone: string;
  recipient_name: string;
  message?: string;
}

export interface FlyerDispatchResponse {
  id: string;
  channel: CommunicationChannel;
  status: string;
  provider_ready: boolean;
  event_id: string;
  flyer_id: string;
  recipient_name: string;
  recipient_contact: string;
  share_token: string;
  share_url: string;
  created_at: string;
}
