import type { FlyerConfiguration } from "@/lib/types/flyer";

export const STUB_BASE_WIDTH = 320;
export const STUB_BASE_HEIGHT = STUB_BASE_WIDTH * 16 / 9;
export const STUB_TOP_RATIO = 2 / 3;
export const STUB_REFERENCE_HEIGHT = STUB_BASE_HEIGHT * (1 - STUB_TOP_RATIO);
export const STUB_CURVE_DEPTH = 32;
export const STUB_CURVE_CONTROL_FACTOR = 0.45;
export const STUB_MIN_QR_BOTTOM = 38;
export const STUB_QR_PADDING = 12;
export const STUB_QR_RADIUS = 18;
export const STUB_DETAILS_WIDTH = 44;
export const STUB_FOOTER_BOTTOM = 6;
export const SECURE_QR_FOREGROUND = "#000000";
export const SECURE_QR_BACKGROUND = "#ffffff";

export function clampStubValue(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function getStubQrHeightPercent(size: number) {
  return size * (9 / 16) / (1 - STUB_TOP_RATIO);
}

export function getStubQrBottomRange(size: number) {
  return {
    minimum: Math.min(STUB_MIN_QR_BOTTOM, Math.max(0, 100 - getStubQrHeightPercent(size))),
    maximum: Math.max(0, 100 - getStubQrHeightPercent(size)),
  };
}

export function getStubGuestTopMaximum(configuration: FlyerConfiguration, guestNameLength = 4) {
  const nameSize = getStubGuestNameFontSize(configuration.stub_guest_name_font_size, "x".repeat(Math.max(guestNameLength, 1)));
  const categorySize = Math.max(11, Math.round(configuration.stub_guest_name_font_size * 0.68));
  const contentHeight = nameSize * 1.2 + (configuration.stub_show_guest_category ? 6 + categorySize * 1.2 + 12 : 0);
  return Math.max(0, 100 - contentHeight / STUB_REFERENCE_HEIGHT * 100);
}

export function getStubDetailsTopMaximum(configuration: FlyerConfiguration) {
  const count = [configuration.stub_show_event_date, configuration.stub_show_event_time, configuration.stub_show_event_location].filter(Boolean).length;
  const contentHeight = count * 15 + Math.max(0, count - 1) * 6;
  return Math.max(0, 100 - contentHeight / STUB_REFERENCE_HEIGHT * 100);
}

export function clampStubQrPosition(configuration: FlyerConfiguration) {
  const size = clampStubValue(configuration.stub_qr_size, 10, 36);
  const bottomRange = getStubQrBottomRange(size);
  return {
    stub_qr_size: size,
    stub_qr_right: clampStubValue(configuration.stub_qr_right, 0, 100 - size),
    stub_qr_bottom: clampStubValue(configuration.stub_qr_bottom, bottomRange.minimum, bottomRange.maximum),
  };
}

export function getStubGuestName(name: string, mode: FlyerConfiguration["stub_guest_name_mode"]) {
  const clean = name.trim() || "Preview Guest";
  if (mode === "full") return clean;
  const parts = clean.split(/\s+/);
  const first = parts[0] || clean;
  return first.length <= 14 ? first : (parts[1] || first);
}

export function getStubGuestNameFontSize(configuredSize: number, renderedName: string) {
  return Math.max(12, Math.round(configuredSize * Math.min(1, 14 / Math.max(renderedName.length, 1))));
}

export function stubFontWeight(weight: FlyerConfiguration["stub_guest_font_weight"]): "400" | "500" | "600" | "700" {
  if (weight === "medium") return "500";
  if (weight === "semibold") return "600";
  if (weight === "bold") return "700";
  return "400";
}

export function formatStubDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return value;
  const monthName = new Date(year, month - 1, day).toLocaleDateString("en", { month: "short" });
  return `${String(day).padStart(2, "0")} ${monthName} ${year}`;
}
