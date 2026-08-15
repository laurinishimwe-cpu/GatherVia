import type { EventType } from "@/lib/types/event";
import type { CanvasLayer } from "./canvas";

export interface QrBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type QrVisibility = "visible" | "hidden";

export type TemplateCategory =
  | "wedding"
  | "corporate"
  | "birthday"
  | "party"
  | "conference"
  | "gala"
  | "other";

export interface FlyerTemplate {
  id: string;
  title: string;
  category: TemplateCategory;
  event_type: EventType;

  description: string;
  headline: string;
  subheadline: string;

  accent_color: string;
  canvas_background_color: string;
  qr_foreground_color: string;
  qr_background_color: string;
  qr_background_transparent: boolean;
  configuration?: FlyerConfiguration;

  layers: CanvasLayer[];
}

export interface FlyerConfiguration {
  canvas_background_color: string;

  qr_foreground_color: string;
  qr_background_color: string;
  qr_background_transparent: boolean;
  qr_visibility: QrVisibility;
  qr_bounds: QrBounds;

  image_width: number;
  image_height: number;

  use_ticket_stub: boolean;

  stub_background_color: string;
  stub_text_color: string;
  stub_accent_color: string;

  stub_qr_right: number;
  stub_qr_bottom: number;
  stub_qr_size: number;

  stub_guest_info_top: number;
  stub_guest_info_left: number;

  stub_guest_name_mode: "first" | "full";
  stub_guest_font_family: string;
  stub_guest_font_weight:
    | "normal"
    | "medium"
    | "semibold"
    | "bold";
  stub_guest_font_style: "normal" | "italic";
  stub_guest_name_font_size: number;

  stub_show_event_date: boolean;
  stub_show_event_time: boolean;
  stub_show_event_location: boolean;

  stub_event_details_icon_color: string;
  stub_event_details_top: number;
  stub_event_details_left: number;

  stub_show_guest_category: boolean;

  stub_curve_shadow_color: string;
  stub_curve_shadow_opacity: number;
  stub_curve_shadow_blur: number;
  stub_curve_shadow_offset: number;

  artboard_stroke_color: string;
  artboard_stroke_width: number;
}

export const DEFAULT_FLYER_CONFIGURATION = (
  width = 1080,
  height = 1920,
): FlyerConfiguration => ({
  canvas_background_color: "#ffffff",

  qr_foreground_color: "#000000",
  qr_background_color: "#ffffff",
  qr_background_transparent: false,
  qr_visibility: "visible",
  qr_bounds: {
    x: Math.round(width * 0.7),
    y: Math.round(height * 0.8),
    width: Math.round(width * 0.2),
    height: Math.round(width * 0.2),
  },

  image_width: width,
  image_height: height,

  use_ticket_stub: true,

  stub_background_color: "#1e293b",
  stub_text_color: "#ffffff",
  stub_accent_color: "#3a7e94",

  stub_qr_right: 7,
  stub_qr_bottom: 10,
  stub_qr_size: 30,

  stub_guest_info_top: 26,
  stub_guest_info_left: 8.75,

  stub_guest_name_mode: "first",
  stub_guest_font_family: "Inter",
  stub_guest_font_weight: "bold",
  stub_guest_font_style: "normal",
  stub_guest_name_font_size: 22,

  stub_show_event_date: true,
  stub_show_event_time: true,
  stub_show_event_location: true,

  stub_event_details_icon_color: "#3a7e94",
  stub_event_details_top: 58,
  stub_event_details_left: 8.75,

  stub_show_guest_category: true,

  stub_curve_shadow_color: "#000000",
  stub_curve_shadow_opacity: 50,
  stub_curve_shadow_blur: 16,
  stub_curve_shadow_offset: 8,

  artboard_stroke_color: "#000000",
  artboard_stroke_width: 1,
});

export interface FlyerRecord {
  _id?: string;
  id?: string;

  owner_id: string;
  event_id?: string | null;

  image_filename: string;
  image_url: string;

  storage_provider?: string;
  storage_bucket?: string | null;
  storage_path?: string | null;

  configuration: FlyerConfiguration;

  created_at: string;
  updated_at: string;
}

export interface FlyerDraft {
  file: File | null;
  previewUrl: string | null;
  configuration: FlyerConfiguration;

  templateId?: string | null;
  templateTitle?: string | null;
  templateCategory?: TemplateCategory | null;
  templateEventType?: EventType | null;
}
