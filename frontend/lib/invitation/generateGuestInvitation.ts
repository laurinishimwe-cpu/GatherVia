import QRCode from "qrcode";
import type { CanvasLayer } from "@/lib/types/canvas";
import { FLYER_TEXT_LINE_HEIGHT } from "@/lib/flyer/textLayout";
import type { FlyerConfiguration } from "@/lib/types/flyer";
import { createCanvasPaint } from "@/lib/flyer/paint";
import { loadCanvasLayerFonts, loadFlyerFont } from "@/lib/flyer/fontLoader";
import {
  getCompactGuestName,
  getStubGuestNameFontSize,
  hexToRgba,
  ORIGINAL_FLYER_BADGE_HEIGHT,
  ORIGINAL_FLYER_BADGE_HORIZONTAL_PADDING,
  ORIGINAL_FLYER_BADGE_MIN_WIDTH,
  ORIGINAL_FLYER_BASE_WIDTH,
  ORIGINAL_FLYER_CURVE_CONTROL_FACTOR,
  ORIGINAL_FLYER_CURVE_DEPTH,
  ORIGINAL_FLYER_DETAILS_FONT_SIZE,
  ORIGINAL_FLYER_DETAILS_GAP,
  ORIGINAL_FLYER_DETAILS_ICON_SIZE,
  ORIGINAL_FLYER_DETAILS_WIDTH_PERCENT,
  ORIGINAL_FLYER_FOOTER_BOTTOM_PERCENT,
  ORIGINAL_FLYER_FOOTER_FONT_SIZE,
  ORIGINAL_FLYER_MIN_QR_BOTTOM_PERCENT,
  ORIGINAL_FLYER_QR_PADDING,
  ORIGINAL_FLYER_QR_RADIUS,
  ORIGINAL_FLYER_TOP_RATIO,
  SECURE_QR_BACKGROUND_COLOR,
  SECURE_QR_FOREGROUND_COLOR,
} from "@/lib/invitation/originalFlyerLayout";

export interface GuestInvitationData {
  guestName: string;
  guestCategory: string;
  qrHash: string;
}

export interface GuestInvitationEventDetails {
  date?: string | null;
  time?: string | null;
  location?: string | null;
}

export type GuestInvitationImageFormat = "png" | "jpg";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

function resolveImageUrl(url: string) {
  if (url.startsWith("http") || url.startsWith("data:") || url.startsWith("blob:")) {
    return url;
  }
  if (url.startsWith("/uploads/")) {
    return `${API_BASE_URL}${url}`;
  }
  if (url.startsWith("/")) {
    return new URL(url, window.location.origin).href;
  }
  return url;
}

function getProxiedImageUrl(url: string) {
  const resolvedUrl = resolveImageUrl(url);
  if (resolvedUrl.startsWith("data:") || resolvedUrl.startsWith("blob:")) {
    return resolvedUrl;
  }
  return `/api/invitation-image?url=${encodeURIComponent(resolvedUrl)}`;
}

function loadImageElement(url: string, crossOrigin = false): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (crossOrigin) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  if (url.startsWith("data:") || url.startsWith("blob:")) {
    return loadImageElement(url);
  }

  try {
    return await loadImageElement(getProxiedImageUrl(url));
  } catch {
    return loadImageElement(resolveImageUrl(url), true);
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function fontWeightToCanvas(weight: CanvasLayer["fontWeight"]) {
  return weight === "semibold" || weight === "bold" ? "700" : "400";
}

function quoteFontFamily(fontFamily?: string) {
  const family = fontFamily ?? "Inter";
  return family.includes(" ") ? `"${family}"` : family;
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  const wrappedLines: string[] = [];

  for (const sourceLine of text.split("\n")) {
    const words = sourceLine.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      wrappedLines.push("");
      continue;
    }

    let line = words[0];
    for (const word of words.slice(1)) {
      const nextLine = `${line} ${word}`;
      if (ctx.measureText(nextLine).width <= maxWidth) {
        line = nextLine;
      } else {
        wrappedLines.push(line);
        line = word;
      }
    }
    wrappedLines.push(line);
  }

  return wrappedLines;
}

function createTopSectionPath(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  curveDepth: number,
) {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(width, 0);
  ctx.lineTo(width, height - curveDepth);
  ctx.quadraticCurveTo(
    width / 2,
    height + curveDepth * ORIGINAL_FLYER_CURVE_CONTROL_FACTOR,
    0,
    height - curveDepth,
  );
  ctx.closePath();
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.naturalWidth - sourceWidth) / 2;
  const sourceY = (image.naturalHeight - sourceHeight) / 2;
  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

async function drawLayers(
  ctx: CanvasRenderingContext2D,
  layers: CanvasLayer[],
  canvasWidth: number,
  canvasHeight: number,
  scale: number,
  guestQrHash: string,
) {
  const orderedLayers = [...layers]
    .filter((layer) => layer.parentId === "main-frame" || layer.parentId === undefined || layer.parentId === null)
    .sort((a, b) => a.zIndex - b.zIndex);

  for (const layer of orderedLayers) {
    if (!layer.visible) continue;

    const x = (layer.x / 100) * canvasWidth;
    const y = (layer.y / 100) * canvasHeight;
    const width = (layer.width / 100) * canvasWidth;
    const height = (layer.height / 100) * canvasHeight;

    ctx.save();
    ctx.globalAlpha = layer.opacity;
    ctx.translate(x + width / 2, y + height / 2);
    ctx.rotate(((layer.rotation ?? 0) * Math.PI) / 180);
    ctx.translate(-(x + width / 2), -(y + height / 2));

    if (layer.shadow) {
      ctx.shadowColor = layer.shadow.color;
      ctx.shadowBlur = layer.shadow.blur * scale;
      ctx.shadowOffsetX = layer.shadow.offsetX * scale;
      ctx.shadowOffsetY = layer.shadow.offsetY * scale;
    }

    const bounds = { x, y, width, height };

    if (layer.type === "rect" || layer.type === "frame") {
      roundRect(ctx, x, y, width, height, (layer.borderRadius ?? 0) * scale);
      if (layer.fill) {
        ctx.fillStyle = createCanvasPaint(ctx, layer.fill, bounds);
        ctx.fill();
      }
      if (layer.strokeWidth) {
        ctx.strokeStyle = createCanvasPaint(ctx, layer.stroke, bounds, "#000000");
        ctx.lineWidth = layer.strokeWidth * scale;
        ctx.stroke();
      }
    }

    if (layer.type === "ellipse") {
      ctx.beginPath();
      ctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
      if (layer.fill) {
        ctx.fillStyle = createCanvasPaint(ctx, layer.fill, bounds);
        ctx.fill();
      }
      if (layer.strokeWidth) {
        ctx.strokeStyle = createCanvasPaint(ctx, layer.stroke, bounds, "#000000");
        ctx.lineWidth = layer.strokeWidth * scale;
        ctx.stroke();
      }
    }

    if (layer.type === "text" && layer.text) {
      const fontSize = (layer.fontSize ?? 24) * scale;
      ctx.fillStyle = createCanvasPaint(ctx, layer.color, bounds, "#000000");
      ctx.font = `${layer.fontStyle ?? "normal"} ${fontWeightToCanvas(layer.fontWeight)} ${fontSize}px ${quoteFontFamily(layer.fontFamily)}, sans-serif`;
      ctx.textAlign = (layer.textAlign as CanvasTextAlign) ?? "center";
      ctx.textBaseline = "middle";

      const lineHeight = fontSize * FLYER_TEXT_LINE_HEIGHT;
      const lines = wrapTextLines(ctx, layer.text, width);
      const textX =
        layer.textAlign === "left" ? x : layer.textAlign === "right" ? x + width : x + width / 2;
      const startY = y + height / 2 - ((lines.length - 1) * lineHeight) / 2;

      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, width, height);
      ctx.clip();
      lines.forEach((line, index) => {
        ctx.fillText(line, textX, startY + index * lineHeight);
      });
      ctx.restore();
    }

    if (layer.type === "image" && layer.imageUrl) {
      try {
        const img = await loadImage(layer.imageUrl);
        if (layer.borderRadius) {
          roundRect(ctx, x, y, width, height, layer.borderRadius * scale);
          ctx.clip();
        }
        drawImageCover(ctx, img, x, y, width, height);
      } catch {
        // Ignore failed layer images so one broken asset does not block exports.
      }
    }

    if (layer.type === "qr") {
      try {
        const qrDataUrl = await QRCode.toDataURL(layer.qrValue || guestQrHash, {
          width: Math.max(64, Math.round(Math.min(width, height))),
          margin: 1,
          color: { dark: "#000000", light: "#ffffff" },
        });
        const qrImage = await loadImage(qrDataUrl);
        roundRect(ctx, x, y, width, height, (layer.borderRadius ?? 0) * scale);
        ctx.fillStyle = createCanvasPaint(ctx, layer.fill, bounds, "#ffffff");
        ctx.fill();
        ctx.save();
        roundRect(ctx, x, y, width, height, (layer.borderRadius ?? 0) * scale);
        ctx.clip();
        ctx.drawImage(qrImage, x, y, width, height);
        ctx.restore();
      } catch {
        // Keep exporting the remaining layers if QR generation fails.
      }
    }

    if (layer.type === "polygon" && layer.points) {
      const points = layer.points
        .trim()
        .split(/\s+/)
        .map((point) => point.split(",").map(Number))
        .filter((point) => point.length === 2 && point.every(Number.isFinite));
      if (points.length >= 3) {
        ctx.beginPath();
        points.forEach(([pointX, pointY], index) => {
          const targetX = x + (pointX / 100) * width;
          const targetY = y + (pointY / 100) * height;
          if (index === 0) ctx.moveTo(targetX, targetY);
          else ctx.lineTo(targetX, targetY);
        });
        ctx.closePath();
        if (layer.fill) {
          ctx.fillStyle = createCanvasPaint(ctx, layer.fill, bounds);
          ctx.fill();
        }
        if (layer.strokeWidth) {
          ctx.strokeStyle = createCanvasPaint(ctx, layer.stroke, bounds, "#000000");
          ctx.lineWidth = layer.strokeWidth * scale;
          ctx.stroke();
        }
      }
    }

    if (layer.type === "path" && layer.pathData && typeof Path2D !== "undefined") {
      const path = new Path2D(layer.pathData);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(width / 100, height / 100);
      if (layer.closed && layer.fill && layer.fill !== "none") {
        ctx.fillStyle = createCanvasPaint(
          ctx,
          layer.fill,
          { x: 0, y: 0, width: 100, height: 100 },
        );
        ctx.fill(path);
      }
      if (layer.strokeWidth) {
        ctx.strokeStyle = createCanvasPaint(
          ctx,
          layer.stroke,
          { x: 0, y: 0, width: 100, height: 100 },
          "#000000",
        );
        ctx.lineWidth = layer.strokeWidth * scale;
        ctx.stroke(path);
      }
      ctx.restore();
    }

    ctx.restore();
  }
}

function drawBadge(
  ctx: CanvasRenderingContext2D,
  label: string,
  x: number,
  y: number,
  textColor: string,
  accentColor: string,
  scale: number,
  fontFamily = "Inter",
  fontWeight = "700",
  fontStyle = "normal",
  fontSize = 15,
) {
  ctx.font = `${fontStyle} ${fontWeight} ${fontSize * scale}px ${fontFamily}, sans-serif`;
  const badgeWidth = Math.max(
    ORIGINAL_FLYER_BADGE_MIN_WIDTH * scale,
    ctx.measureText(label).width +
      ORIGINAL_FLYER_BADGE_HORIZONTAL_PADDING * 2 * scale,
  );
  const badgeHeight = ORIGINAL_FLYER_BADGE_HEIGHT * scale;

  roundRect(ctx, x, y, badgeWidth, badgeHeight, badgeHeight / 2);
  ctx.fillStyle = createCanvasPaint(
    ctx,
    accentColor,
    { x, y, width: badgeWidth, height: badgeHeight },
    "#3A7E94",
  );
  ctx.fill();

  ctx.fillStyle = createCanvasPaint(
    ctx,
    textColor,
    { x, y, width: badgeWidth, height: badgeHeight },
    "#ffffff",
  );
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + badgeWidth / 2, y + badgeHeight / 2 + 1);
}

function drawFooterBrand(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  textColor: string,
  accentColor: string,
  scale: number,
) {
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.globalAlpha = 0.75;

  const prefix = "powered by ";
  const brandPrefix = "Gather";
  const suffix = "Via";
  ctx.font = `500 ${ORIGINAL_FLYER_FOOTER_FONT_SIZE * scale}px Arial, sans-serif`;
  const prefixWidth = ctx.measureText(prefix).width;
  ctx.font = `600 ${ORIGINAL_FLYER_FOOTER_FONT_SIZE * scale}px Arial, sans-serif`;
  const brandPrefixWidth = ctx.measureText(brandPrefix).width;
  const suffixWidth = ctx.measureText(suffix).width;
  const startX = x - (prefixWidth + brandPrefixWidth + suffixWidth) / 2;

  ctx.font = `500 ${ORIGINAL_FLYER_FOOTER_FONT_SIZE * scale}px Arial, sans-serif`;
  ctx.fillStyle = createCanvasPaint(
    ctx,
    textColor,
    { x: startX, y: y - 10 * scale, width: prefixWidth + brandPrefixWidth, height: 20 * scale },
    "#ffffff",
  );
  ctx.fillText(prefix, startX, y);
  ctx.font = `600 ${ORIGINAL_FLYER_FOOTER_FONT_SIZE * scale}px Arial, sans-serif`;
  ctx.fillText(brandPrefix, startX + prefixWidth, y);
  ctx.fillStyle = createCanvasPaint(
    ctx,
    accentColor,
    { x: startX + prefixWidth + brandPrefixWidth, y: y - 10 * scale, width: suffixWidth, height: 20 * scale },
    "#3A7E94",
  );
  ctx.fillText(suffix, startX + prefixWidth + brandPrefixWidth, y);
  ctx.globalAlpha = 1;
}

function formatInvitationDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return value;
  const monthName = new Date(year, month - 1, day).toLocaleDateString("en", {
    month: "short",
  });
  return `${String(day).padStart(2, "0")} ${monthName} ${year}`;
}

function truncateCanvasText(
  ctx: CanvasRenderingContext2D,
  value: string,
  maximumWidth: number,
) {
  if (ctx.measureText(value).width <= maximumWidth) return value;
  let result = value;
  while (result && ctx.measureText(`${result}...`).width > maximumWidth) {
    result = result.slice(0, -1);
  }
  return result ? `${result}...` : "";
}

function drawDetailIcon(
  ctx: CanvasRenderingContext2D,
  kind: "date" | "time" | "location",
  x: number,
  y: number,
  size: number,
  color: string,
  scale: number,
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2 * scale;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (kind === "date") {
    roundRect(ctx, x, y + scale, size, size - scale, 2 * scale);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y + 4 * scale);
    ctx.lineTo(x + size, y + 4 * scale);
    ctx.moveTo(x + 3 * scale, y);
    ctx.lineTo(x + 3 * scale, y + 3 * scale);
    ctx.moveTo(x + size - 3 * scale, y);
    ctx.lineTo(x + size - 3 * scale, y + 3 * scale);
    ctx.stroke();
  } else if (kind === "time") {
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2 - scale, 0, Math.PI * 2);
    ctx.moveTo(x + size / 2, y + 2.5 * scale);
    ctx.lineTo(x + size / 2, y + size / 2);
    ctx.lineTo(x + size - 2.5 * scale, y + size / 2);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(x + size / 2, y + size);
    ctx.bezierCurveTo(
      x + 2 * scale,
      y + 7 * scale,
      x + scale,
      y + 4 * scale,
      x + size / 2,
      y + scale,
    );
    ctx.bezierCurveTo(
      x + size - scale,
      y + 4 * scale,
      x + size - 2 * scale,
      y + 7 * scale,
      x + size / 2,
      y + size,
    );
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + size / 2, y + 5 * scale, 1.5 * scale, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawEventDetails(
  ctx: CanvasRenderingContext2D,
  configuration: FlyerConfiguration,
  eventDetails: GuestInvitationEventDetails,
  stubY: number,
  stubHeight: number,
  canvasWidth: number,
  scale: number,
) {
  const rows: Array<{ kind: "date" | "time" | "location"; label: string }> = [];
  if (configuration.stub_show_event_date !== false && eventDetails.date) {
    rows.push({ kind: "date", label: formatInvitationDate(eventDetails.date) });
  }
  if (configuration.stub_show_event_time !== false && eventDetails.time) {
    rows.push({ kind: "time", label: eventDetails.time.slice(0, 5) });
  }
  if (
    configuration.stub_show_event_location !== false &&
    eventDetails.location?.trim()
  ) {
    rows.push({ kind: "location", label: eventDetails.location.trim() });
  }
  if (rows.length === 0) return;

  const left = canvasWidth * (configuration.stub_event_details_left ?? 8.75) / 100;
  const top = stubY + stubHeight * (configuration.stub_event_details_top ?? 58) / 100;
  const iconSize = ORIGINAL_FLYER_DETAILS_ICON_SIZE * scale;
  const rowStep =
    (ORIGINAL_FLYER_DETAILS_ICON_SIZE + ORIGINAL_FLYER_DETAILS_GAP) * scale;
  const totalWidth = canvasWidth * ORIGINAL_FLYER_DETAILS_WIDTH_PERCENT / 100;
  const textX = left + iconSize + ORIGINAL_FLYER_DETAILS_GAP * scale;
  const textWidth = Math.max(1, totalWidth - iconSize - ORIGINAL_FLYER_DETAILS_GAP * scale);
  const fontFamily = quoteFontFamily(configuration.stub_guest_font_family ?? "Inter");

  ctx.save();
  ctx.font = `normal 400 ${ORIGINAL_FLYER_DETAILS_FONT_SIZE * scale}px ${fontFamily}, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  rows.slice(0, 3).forEach(({ kind, label }, index) => {
    const rowY = top + index * rowStep;
    drawDetailIcon(
      ctx,
      kind,
      left,
      rowY,
      iconSize,
      configuration.stub_event_details_icon_color ?? "#3A7E94",
      scale,
    );
    ctx.fillStyle = createCanvasPaint(
      ctx,
      configuration.stub_text_color,
      { x: textX, y: rowY, width: textWidth, height: iconSize },
      "#ffffff",
    );
    ctx.fillText(
      truncateCanvasText(ctx, label, textWidth),
      textX,
      rowY + iconSize / 2,
    );
  });
  ctx.restore();
}

export async function generateGuestInvitationImage(
  configuration: FlyerConfiguration,
  layers: CanvasLayer[],
  guest: GuestInvitationData,
  format: GuestInvitationImageFormat = "png",
  eventDetails: GuestInvitationEventDetails = {},
): Promise<Blob> {
  const canvasWidth = 1080;
  const canvasHeight = 1920;
  const scale = canvasWidth / ORIGINAL_FLYER_BASE_WIDTH;
  const flyerHeight = Math.round(canvasHeight * ORIGINAL_FLYER_TOP_RATIO);
  const stubY = flyerHeight;
  const stubHeight = canvasHeight - stubY;
  const curveDepth = ORIGINAL_FLYER_CURVE_DEPTH * scale;
  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable");

  const stubBackgroundColor = configuration.stub_background_color ?? "#1e293b";
  const stubTextColor = configuration.stub_text_color ?? "#ffffff";
  const stubAccentColor = configuration.stub_accent_color ?? "#3A7E94";
  const qrFrameColor = configuration.qr_foreground_color ?? "#000000";
  const guestNameMode = configuration.stub_guest_name_mode ?? "first";
  const compactGuestName = guestNameMode === "full"
    ? guest.guestName.trim() || guest.guestName
    : getCompactGuestName(guest.guestName);
  const displayGuestCategory = guest.guestCategory.trim();
  const guestInfoTopPercent = configuration.stub_guest_info_top ?? 26;
  const guestFontFamily = quoteFontFamily(configuration.stub_guest_font_family ?? "Inter");
  const guestFontWeight = fontWeightToCanvas(configuration.stub_guest_font_weight ?? "bold");
  const guestFontStyle = configuration.stub_guest_font_style ?? "normal";
  const guestNameFontSize = configuration.stub_guest_name_font_size ?? 22;
  const renderedGuestNameSize = getStubGuestNameFontSize(
    compactGuestName,
    guestNameFontSize,
  );
  const guestCategoryFontSize = Math.max(11, Math.round(guestNameFontSize * 0.68));
  const curveShadowColor = configuration.stub_curve_shadow_color ?? "#000000";
  const curveShadowOpacity = (configuration.stub_curve_shadow_opacity ?? 50) / 100;
  const curveShadowBlur = configuration.stub_curve_shadow_blur ?? 16;
  const curveShadowOffset = configuration.stub_curve_shadow_offset ?? 8;

  await Promise.all([
    loadFlyerFont(
      configuration.stub_guest_font_family ?? "Inter",
      configuration.stub_guest_font_weight ?? "bold",
      configuration.stub_guest_font_style ?? "normal",
    ),
    loadCanvasLayerFonts(layers),
  ]);
  await document.fonts.load(
    `${guestFontStyle} ${guestFontWeight} ${guestNameFontSize * scale}px ${guestFontFamily}`,
  );

  ctx.fillStyle = createCanvasPaint(
    ctx,
    stubBackgroundColor,
    { x: 0, y: 0, width: canvasWidth, height: canvasHeight },
    "#1e293b",
  );
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  ctx.save();
  ctx.shadowColor = hexToRgba(curveShadowColor, curveShadowOpacity);
  ctx.shadowBlur = curveShadowBlur * scale;
  ctx.shadowOffsetY = curveShadowOffset * scale;
  createTopSectionPath(ctx, canvasWidth, flyerHeight, curveDepth);
  ctx.fillStyle = createCanvasPaint(
    ctx,
    configuration.canvas_background_color,
    { x: 0, y: 0, width: canvasWidth, height: flyerHeight + curveDepth },
    "#ffffff",
  );
  ctx.fill();
  ctx.restore();

  ctx.save();
  createTopSectionPath(ctx, canvasWidth, flyerHeight, curveDepth);
  ctx.clip();
  ctx.fillStyle = createCanvasPaint(
    ctx,
    configuration.canvas_background_color,
    { x: 0, y: 0, width: canvasWidth, height: flyerHeight + curveDepth },
    "#ffffff",
  );
  ctx.fillRect(0, 0, canvasWidth, flyerHeight + curveDepth);
  await drawLayers(ctx, layers, canvasWidth, flyerHeight, scale, guest.qrHash);

  if (configuration.artboard_stroke_width) {
    ctx.strokeStyle = createCanvasPaint(
      ctx,
      configuration.artboard_stroke_color,
      { x: 0, y: 0, width: canvasWidth, height: flyerHeight },
      "#000000",
    );
    ctx.lineWidth = configuration.artboard_stroke_width * scale;
    createTopSectionPath(ctx, canvasWidth, flyerHeight, curveDepth);
    ctx.stroke();
  }
  ctx.restore();

  const guestInfoTop = stubY + stubHeight * (guestInfoTopPercent / 100);
  const guestInfoLeft =
    canvasWidth * (configuration.stub_guest_info_left ?? 8.75) / 100;
  const guestInfoWidth = Math.max(
    40 * scale,
    canvasWidth * 0.6 - guestInfoLeft,
  );

  ctx.fillStyle = createCanvasPaint(
    ctx,
    stubTextColor,
    {
      x: guestInfoLeft,
      y: guestInfoTop,
      width: guestInfoWidth,
      height: renderedGuestNameSize * scale * 1.3,
    },
    "#ffffff",
  );
  ctx.font = `${guestFontStyle} ${guestFontWeight} ${renderedGuestNameSize * scale}px ${guestFontFamily}, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(
    truncateCanvasText(ctx, compactGuestName, guestInfoWidth),
    guestInfoLeft,
    guestInfoTop + renderedGuestNameSize * scale,
  );

  if (configuration.stub_show_guest_category !== false && displayGuestCategory) {
    drawBadge(
      ctx,
      displayGuestCategory,
      guestInfoLeft,
      guestInfoTop + (guestNameFontSize + 18) * scale,
      stubTextColor,
      stubAccentColor,
      scale,
      guestFontFamily,
      guestFontWeight,
      guestFontStyle,
      guestCategoryFontSize
    );
  }

  const qrCardSize = ((configuration.stub_qr_size ?? 30) / 100) * canvasWidth;
  const qrPadding = ORIGINAL_FLYER_QR_PADDING * scale;
  const qrImageSize = Math.max(1, qrCardSize - qrPadding * 2);
  const qrRight = ((configuration.stub_qr_right ?? 7) / 100) * canvasWidth;
  const qrBottom = (Math.max(configuration.stub_qr_bottom ?? 10, ORIGINAL_FLYER_MIN_QR_BOTTOM_PERCENT) / 100) * stubHeight;
  const qrX = canvasWidth - qrRight - qrCardSize;
  const qrY = stubY + stubHeight - qrBottom - qrCardSize;

  const qrDataUrl = await QRCode.toDataURL(guest.qrHash, {
    width: Math.round(qrImageSize),
    margin: 1,
    color: {
      dark: SECURE_QR_FOREGROUND_COLOR,
      light: SECURE_QR_BACKGROUND_COLOR,
    },
  });
  const qrImg = await loadImage(qrDataUrl);

  ctx.save();
  roundRect(
    ctx,
    qrX,
    qrY,
    qrCardSize,
    qrCardSize,
    ORIGINAL_FLYER_QR_RADIUS * scale,
  );
  ctx.fillStyle = createCanvasPaint(
    ctx,
    qrFrameColor,
    { x: qrX, y: qrY, width: qrCardSize, height: qrCardSize },
    "#000000",
  );
  ctx.fill();
  ctx.drawImage(qrImg, qrX + qrPadding, qrY + qrPadding, qrImageSize, qrImageSize);
  ctx.restore();

  drawEventDetails(
    ctx,
    configuration,
    eventDetails,
    stubY,
    stubHeight,
    canvasWidth,
    scale,
  );

  drawFooterBrand(
    ctx,
    canvasWidth / 2,
    canvasHeight -
      stubHeight * ORIGINAL_FLYER_FOOTER_BOTTOM_PERCENT / 100,
    stubTextColor,
    qrFrameColor,
    scale
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Failed to generate invitation image"));
    }, format === "jpg" ? "image/jpeg" : "image/png", 0.95);
  });
}

export function generateGuestInvitationPng(
  configuration: FlyerConfiguration,
  layers: CanvasLayer[],
  guest: GuestInvitationData,
): Promise<Blob> {
  return generateGuestInvitationImage(configuration, layers, guest, "png");
}
