export const ORIGINAL_FLYER_BASE_WIDTH = 320;
export const ORIGINAL_FLYER_BASE_HEIGHT = (ORIGINAL_FLYER_BASE_WIDTH * 16) / 9;
export const ORIGINAL_FLYER_TOP_RATIO = 2 / 3;
export const ORIGINAL_FLYER_CURVE_DEPTH = 32;
export const ORIGINAL_FLYER_CURVE_CONTROL_FACTOR = 0.45;
export const ORIGINAL_FLYER_MIN_QR_BOTTOM_PERCENT = 38;
export const ORIGINAL_FLYER_QR_PADDING = 12;
export const ORIGINAL_FLYER_QR_RADIUS = 18;
export const ORIGINAL_FLYER_BADGE_MIN_WIDTH = 96;
export const ORIGINAL_FLYER_BADGE_HEIGHT = 32;
export const ORIGINAL_FLYER_BADGE_HORIZONTAL_PADDING = 18;
export const ORIGINAL_FLYER_FOOTER_BOTTOM_PERCENT = 6;
export const ORIGINAL_FLYER_FOOTER_FONT_SIZE = 13;
export const ORIGINAL_FLYER_DETAILS_WIDTH_PERCENT = 44;
export const ORIGINAL_FLYER_DETAILS_FONT_SIZE = 10;
export const ORIGINAL_FLYER_DETAILS_ICON_SIZE = 12;
export const ORIGINAL_FLYER_DETAILS_GAP = 6;
export const SECURE_QR_FOREGROUND_COLOR = "#000000";
export const SECURE_QR_BACKGROUND_COLOR = "#ffffff";

export const ORIGINAL_FLYER_TOP_HEIGHT =
  ORIGINAL_FLYER_BASE_HEIGHT * ORIGINAL_FLYER_TOP_RATIO;
export const ORIGINAL_FLYER_STUB_HEIGHT =
  ORIGINAL_FLYER_BASE_HEIGHT - ORIGINAL_FLYER_TOP_HEIGHT;

export const ORIGINAL_FLYER_CURVE_PATH = [
  "M 0 0",
  `H ${ORIGINAL_FLYER_BASE_WIDTH}`,
  `V ${ORIGINAL_FLYER_TOP_HEIGHT - ORIGINAL_FLYER_CURVE_DEPTH}`,
  `Q ${ORIGINAL_FLYER_BASE_WIDTH / 2} ${
    ORIGINAL_FLYER_TOP_HEIGHT +
    ORIGINAL_FLYER_CURVE_DEPTH * ORIGINAL_FLYER_CURVE_CONTROL_FACTOR
  } 0 ${ORIGINAL_FLYER_TOP_HEIGHT - ORIGINAL_FLYER_CURVE_DEPTH}`,
  "Z",
].join(" ");

export function getCompactGuestName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return name;
  if (parts[0].length <= 14) return parts[0];
  return parts[1] ?? parts[0];
}

export function getStubGuestNameFontSize(name: string, configuredSize: number) {
  return Math.max(
    12,
    Math.round(
      configuredSize * Math.min(1, 14 / Math.max(name.trim().length, 1)),
    ),
  );
}

export function hexToRgba(hex: string, opacity: number) {
  const normalized = hex.replace("#", "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : normalized;
  const numeric = Number.parseInt(expanded, 16);
  const red = (numeric >> 16) & 255;
  const green = (numeric >> 8) & 255;
  const blue = numeric & 255;

  return `rgba(${red},${green},${blue},${Math.min(Math.max(opacity, 0), 1)})`;
}
