import type { EventType } from "@/lib/types/event";

export type GuestCategory = string;
export type GuestStatus = "pending" | "checked_in" | "rejected";
export type GuestScanMode = "in" | "out";

export interface GuestActivityLog {
  timestamp: string;
  status: string;
  door_id: string;
  action?: string | null;
  outcome?: string | null;
  severity?: string | null;
  lookup_method?: string | null;
}

export interface GuestRegistrationRequest {
  full_name: string;
  email?: string | null;
  phone?: string | null;
  custom_fields?: Record<string, unknown>;
}

export type GuestCreateRequest = GuestRegistrationRequest;

export interface GuestRegistrationResponse {
  guest_id: string;
  full_name: string;
  qr_hash: string;
  status: GuestStatus;
  message: string;
}

export interface GuestQrCodeRequest {
  event_type: EventType;
  guest_capacity: number;
}

export interface GuestQrCodeItem {
  index: number;
  label: string;
  qr_hash: string;
  qr_payload: string;
}

export interface GuestQrCodeResponse {
  event_type: EventType;
  guest_capacity: number;
  guest_label_singular: string;
  guest_label_plural: string;
  qr_codes: GuestQrCodeItem[];
}

export interface GuestStaffView {
  id: string;
  full_name: string;
  normalized_full_name?: string | null;
  category: GuestCategory;
  status: GuestStatus;
  custom_fields: Record<string, unknown>;
  check_in_logs: GuestActivityLog[];
}

export interface GuestOwnerView {
  id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  custom_notes?: string | null;
  category: GuestCategory;
  status: GuestStatus;
  qr_hash: string;
  normalized_full_name?: string | null;
  custom_fields: Record<string, unknown>;
  check_in_logs: GuestActivityLog[];
  created_at: string;
  status_updated_at: string;
}

export interface GuestScanRequest {
  share_token: string;
  qr_hash: string;
  mode?: GuestScanMode;
  pin_code?: string | null;
}

export interface GuestNameScanRequest {
  share_token: string;
  full_name: string;
  mode?: GuestScanMode;
  pin_code?: string | null;
}

export interface GuestScanResponse {
  found: boolean;
  accepted: boolean;
  message: string;
  event_id: string;
  event_title: string;
  admin_label?: string | null;
  allowed_admin_fields: string[];
  guest: GuestStaffView | null;
}

export interface GuestScannerContextResponse {
  event_id: string;
  event_title: string;
  admin_label: string;
  enabled: boolean;
  pin_required: boolean;
}

export interface GuestStatusUpdateRequest {
  status: GuestStatus;
}

export interface GuestStaffCheckInRequest {
  share_token: string;
  guest_id: string;
}

export interface GuestListSummary {
  total: number;
  pending: number;
  approved: number;
  checked_in: number;
  rejected: number;
  completion_rate: number;
}

export interface GuestListResponse {
  event_id: string;
  event_title: string;
  guests: GuestOwnerView[];
  summary: GuestListSummary;
}

export interface EventAnalytics {
  summary: GuestListSummary;
  checkInTimeline: { hour: string; count: number }[];
  categoryBreakdown: { category: string; count: number }[];
  recentActivity: {
    id: string;
    guest_name: string;
    action: string;
    timestamp: string;
    category: string;
  }[];
  duplicateAttempts: {
    id: string;
    guest_name: string;
    action: string;
    timestamp: string;
    category: string;
  }[];
}
