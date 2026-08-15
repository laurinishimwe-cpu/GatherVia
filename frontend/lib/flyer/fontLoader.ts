import {
  bundledFaceWeight,
  getBundledFont,
  normalizeFontFamily,
} from "@/lib/flyer/fontRegistry";

const flyerFontRequests = new Map<string, Promise<void>>();

export function loadFlyerFont(
  family: string,
  weight: string | number = "normal",
  style = "normal",
): Promise<void> {
  if (typeof document === "undefined" || typeof FontFace === "undefined") {
    return Promise.resolve();
  }

  const canonical = normalizeFontFamily(family);
  const font = getBundledFont(canonical);
  const faceWeight = bundledFaceWeight(weight);
  const faceStyle = style === "italic" || style === "oblique"
    ? "italic"
    : "normal";
  const filename = font.faces[faceStyle][faceWeight];
  const requestKey = `${canonical}:${faceWeight}:${faceStyle}`;
  const existing = flyerFontRequests.get(requestKey);
  if (existing) return existing;

  const request = new FontFace(
    canonical,
    `url("/fonts/${filename}") format("truetype")`,
    { weight: faceWeight, style: faceStyle },
  ).load().then((loadedFace) => {
    document.fonts.add(loadedFace);
  }).catch(() => undefined);

  flyerFontRequests.set(requestKey, request);
  return request;
}

export function loadCanvasLayerFonts(
  layers: Array<{
    type?: string;
    fontFamily?: string;
    fontWeight?: string;
    fontStyle?: string;
  }>,
): Promise<void> {
  const requests = layers
    .filter(({ type }) => type === "text")
    .map((layer) => loadFlyerFont(
      layer.fontFamily ?? "Inter",
      layer.fontWeight ?? "normal",
      layer.fontStyle ?? "normal",
    ));
  return Promise.all(requests).then(() => undefined);
}
