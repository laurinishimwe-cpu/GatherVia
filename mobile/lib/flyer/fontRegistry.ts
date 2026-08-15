import registry from "@/lib/flyer/font-registry.json";

export type BundledFontCategory = "sans" | "serif" | "handwriting" | "display";

interface BundledFontFamily {
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

export const MOBILE_FLYER_FONT_SOURCES = {
  "GV-Inter-Regular": require("../../assets/fonts/Inter-Regular.ttf"),
  "GV-Inter-Bold": require("../../assets/fonts/Inter-Bold.ttf"),
  "GV-Inter-Italic": require("../../assets/fonts/Inter-Italic.ttf"),
  "GV-Inter-BoldItalic": require("../../assets/fonts/Inter-BoldItalic.ttf"),
  "GV-SourceSerif4-Regular": require("../../assets/fonts/SourceSerif4-Regular.ttf"),
  "GV-SourceSerif4-Bold": require("../../assets/fonts/SourceSerif4-Bold.ttf"),
  "GV-SourceSerif4-Italic": require("../../assets/fonts/SourceSerif4-Italic.ttf"),
  "GV-SourceSerif4-BoldItalic": require("../../assets/fonts/SourceSerif4-BoldItalic.ttf"),
  "GV-DancingScript-Regular": require("../../assets/fonts/DancingScript-Regular.ttf"),
  "GV-DancingScript-Bold": require("../../assets/fonts/DancingScript-Bold.ttf"),
  "GV-Montserrat-Regular": require("../../assets/fonts/Montserrat-Regular.ttf"),
  "GV-Montserrat-Bold": require("../../assets/fonts/Montserrat-Bold.ttf"),
  "GV-Montserrat-Italic": require("../../assets/fonts/Montserrat-Italic.ttf"),
  "GV-Montserrat-BoldItalic": require("../../assets/fonts/Montserrat-BoldItalic.ttf"),
  "GV-PlayfairDisplay-Regular": require("../../assets/fonts/PlayfairDisplay-Regular.ttf"),
  "GV-PlayfairDisplay-Bold": require("../../assets/fonts/PlayfairDisplay-Bold.ttf"),
  "GV-PlayfairDisplay-Italic": require("../../assets/fonts/PlayfairDisplay-Italic.ttf"),
  "GV-PlayfairDisplay-BoldItalic": require("../../assets/fonts/PlayfairDisplay-BoldItalic.ttf"),
  "GV-LeagueSpartan-Regular": require("../../assets/fonts/LeagueSpartan-Regular.ttf"),
  "GV-LeagueSpartan-Bold": require("../../assets/fonts/LeagueSpartan-Bold.ttf"),
} as const;

function firstCssFamily(value: unknown): string {
  return String(value ?? "")
    .split(",", 1)[0]
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();
}

export function getBundledFont(value: unknown): BundledFontFamily {
  const requested = firstCssFamily(value).toLowerCase();
  return (
    FAMILY_BY_ALIAS.get(requested)
    ?? BUNDLED_FONT_FAMILIES.find(
      ({ family }) => family === DEFAULT_FLYER_FONT_FAMILY,
    )!
  );
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

export function resolveMobileFontFace(
  family: unknown,
  weight: unknown = "normal",
  style: unknown = "normal",
): keyof typeof MOBILE_FLYER_FONT_SOURCES {
  const font = getBundledFont(family);
  const bold = ["bold", "semibold", "600", "700"].includes(
    String(weight).toLowerCase(),
  );
  const italic = ["italic", "oblique"].includes(String(style).toLowerCase());
  const faceWeight = bold ? "700" : "400";
  const hasItalicFace = font.faces.italic[faceWeight] !== font.faces.normal[faceWeight];
  const face = `${bold ? "Bold" : "Regular"}${italic && hasItalicFace ? "Italic" : ""}`;
  return `GV-${font.key}-${face}` as keyof typeof MOBILE_FLYER_FONT_SOURCES;
}
