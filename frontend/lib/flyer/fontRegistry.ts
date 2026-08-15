import registry from "@/lib/flyer/font-registry.json";

export type BundledFontCategory = "sans" | "serif" | "handwriting" | "display";

export interface BundledFontFamily {
  key: string;
  family: string;
  category: BundledFontCategory;
  aliases: string[];
  faces: {
    normal: Record<"400" | "700", string>;
    italic: Record<"400" | "700", string>;
  };
}

export const DEFAULT_FLYER_FONT_FAMILY = registry.defaultFamily;
export const BUNDLED_FONT_FAMILIES = registry.families as BundledFontFamily[];
export const BUNDLED_FONT_FAMILY_NAMES = BUNDLED_FONT_FAMILIES.map(
  ({ family }) => family,
);

const FAMILY_BY_ALIAS = new Map<string, BundledFontFamily>();
for (const font of BUNDLED_FONT_FAMILIES) {
  for (const name of [font.family, ...font.aliases]) {
    FAMILY_BY_ALIAS.set(name.trim().toLowerCase(), font);
  }
}

function firstCssFamily(value: unknown): string {
  return String(value ?? "")
    .split(",", 1)[0]
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();
}

export function getBundledFont(value: unknown): BundledFontFamily {
  const requested = firstCssFamily(value).toLowerCase();
  return FAMILY_BY_ALIAS.get(requested)
    ?? BUNDLED_FONT_FAMILIES.find(
      ({ family }) => family === DEFAULT_FLYER_FONT_FAMILY,
    )!;
}

export function normalizeFontFamily(value: unknown): string {
  return getBundledFont(value).family;
}

export function normalizeFlyerFontConfiguration<
  T extends { stub_guest_font_family?: unknown },
>(configuration: T): T & { stub_guest_font_family: string } {
  return {
    ...configuration,
    stub_guest_font_family: normalizeFontFamily(
      configuration.stub_guest_font_family,
    ),
  };
}

export function bundledFaceWeight(weight: unknown): "400" | "700" {
  const normalized = String(weight ?? "normal").toLowerCase();
  return normalized === "bold" || normalized === "semibold"
    || Number(normalized) >= 600
    ? "700"
    : "400";
}
