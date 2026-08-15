"use client";

import { DEFAULT_FLYER_CONFIGURATION, type FlyerConfiguration } from "@/lib/types/flyer";
import type { CanvasLayer } from "@/lib/types/canvas";
import { isCssGradient } from "@/lib/flyer/paint";
import { FLYER_TEXT_LINE_HEIGHT, resolveLayerFontWeight } from "@/lib/flyer/textLayout";
import { loadCanvasLayerFonts, loadFlyerFont } from "@/lib/flyer/fontLoader";
import { CalendarDays, Clock3, MapPin } from "lucide-react";
import { useEffect, useId } from "react";
import {
  getCompactGuestName,
  getStubGuestNameFontSize,
  ORIGINAL_FLYER_BADGE_HEIGHT,
  ORIGINAL_FLYER_BADGE_HORIZONTAL_PADDING,
  ORIGINAL_FLYER_BADGE_MIN_WIDTH,
  ORIGINAL_FLYER_BASE_HEIGHT,
  ORIGINAL_FLYER_BASE_WIDTH,
  ORIGINAL_FLYER_CURVE_DEPTH,
  ORIGINAL_FLYER_CURVE_PATH,
  ORIGINAL_FLYER_DETAILS_FONT_SIZE,
  ORIGINAL_FLYER_DETAILS_GAP,
  ORIGINAL_FLYER_DETAILS_ICON_SIZE,
  ORIGINAL_FLYER_DETAILS_WIDTH_PERCENT,
  ORIGINAL_FLYER_FOOTER_BOTTOM_PERCENT,
  ORIGINAL_FLYER_FOOTER_FONT_SIZE,
  ORIGINAL_FLYER_MIN_QR_BOTTOM_PERCENT,
  ORIGINAL_FLYER_QR_PADDING,
  ORIGINAL_FLYER_QR_RADIUS,
  ORIGINAL_FLYER_STUB_HEIGHT,
  ORIGINAL_FLYER_TOP_HEIGHT,
  SECURE_QR_FOREGROUND_COLOR,
} from "@/lib/invitation/originalFlyerLayout";

interface OriginalFlyerProps {
  configuration: FlyerConfiguration;
  layers: CanvasLayer[];
  guestName: string;
  guestCategory: string;
  qrSvg: string;
  eventDate?: string | null;
  eventTime?: string | null;
  eventLocation?: string | null;
}

export function OriginalFlyer({
  configuration,
  layers,
  guestName,
  guestCategory,
  qrSvg,
  eventDate,
  eventTime,
  eventLocation,
}: OriginalFlyerProps) {
  const instanceId = useId().replace(/:/g, "");
  const clipId = `flyer-curve-${instanceId}`;
  const shadowId = `flyer-shadow-${instanceId}`;
  const defaultConfiguration = DEFAULT_FLYER_CONFIGURATION(
    configuration.image_width,
    configuration.image_height
  );
  const stubBackgroundColor =
    configuration.stub_background_color ?? defaultConfiguration.stub_background_color;
  const stubTextColor = configuration.stub_text_color ?? defaultConfiguration.stub_text_color;
  const stubAccentColor =
    configuration.stub_accent_color ?? defaultConfiguration.stub_accent_color;
  const qrFrameColor =
    configuration.qr_foreground_color ?? defaultConfiguration.qr_foreground_color;
  const stubQrRight = configuration.stub_qr_right ?? defaultConfiguration.stub_qr_right;
  const stubQrBottom = Math.max(
    configuration.stub_qr_bottom ?? defaultConfiguration.stub_qr_bottom,
    ORIGINAL_FLYER_MIN_QR_BOTTOM_PERCENT
  );
  const stubQrSize = configuration.stub_qr_size ?? defaultConfiguration.stub_qr_size;
  const guestInfoTop =
    configuration.stub_guest_info_top ?? defaultConfiguration.stub_guest_info_top;
  const guestInfoLeft =
    configuration.stub_guest_info_left ?? defaultConfiguration.stub_guest_info_left;
  const guestNameMode =
    configuration.stub_guest_name_mode ?? defaultConfiguration.stub_guest_name_mode;
  const guestFontFamily =
    configuration.stub_guest_font_family ?? defaultConfiguration.stub_guest_font_family;
  const guestFontWeight =
    configuration.stub_guest_font_weight ?? defaultConfiguration.stub_guest_font_weight;
  const guestFontStyle =
    configuration.stub_guest_font_style ?? defaultConfiguration.stub_guest_font_style;
  const guestNameFontSize =
    configuration.stub_guest_name_font_size ?? defaultConfiguration.stub_guest_name_font_size;
  const guestCategoryFontSize = Math.max(11, Math.round(guestNameFontSize * 0.68));
  const compactGuestName =
    guestNameMode === "full" ? guestName.trim() || guestName : getCompactGuestName(guestName);
  const renderedGuestNameSize = getStubGuestNameFontSize(
    compactGuestName,
    guestNameFontSize,
  );
  const displayGuestCategory = guestCategory.trim();
  const showGuestCategory = configuration.stub_show_guest_category !== false;
  const curveShadowColor =
    configuration.stub_curve_shadow_color ?? defaultConfiguration.stub_curve_shadow_color;
  const curveShadowOpacity =
    (configuration.stub_curve_shadow_opacity ??
      defaultConfiguration.stub_curve_shadow_opacity) / 100;
  const curveShadowBlur =
    configuration.stub_curve_shadow_blur ?? defaultConfiguration.stub_curve_shadow_blur;
  const curveShadowOffset =
    configuration.stub_curve_shadow_offset ?? defaultConfiguration.stub_curve_shadow_offset;
  const detailsIconColor =
    configuration.stub_event_details_icon_color ?? defaultConfiguration.stub_event_details_icon_color;
  const eventDetailsTop =
    configuration.stub_event_details_top ?? defaultConfiguration.stub_event_details_top;
  const eventDetailsLeft =
    configuration.stub_event_details_left ?? defaultConfiguration.stub_event_details_left;
  const eventDetails = [
    configuration.stub_show_event_date !== false && eventDate
      ? { key: "date", label: formatInvitationDate(eventDate), Icon: CalendarDays }
      : null,
    configuration.stub_show_event_time !== false && eventTime
      ? { key: "time", label: eventTime.slice(0, 5), Icon: Clock3 }
      : null,
    configuration.stub_show_event_location !== false && eventLocation?.trim()
      ? { key: "location", label: eventLocation.trim(), Icon: MapPin }
      : null,
  ].filter((detail): detail is NonNullable<typeof detail> => Boolean(detail));
  const guestX = ORIGINAL_FLYER_BASE_WIDTH * guestInfoLeft / 100;
  const guestY = ORIGINAL_FLYER_TOP_HEIGHT + ORIGINAL_FLYER_STUB_HEIGHT * guestInfoTop / 100;
  const guestWidth = ORIGINAL_FLYER_BASE_WIDTH * 0.6 - guestX;
  const badgeTop = guestNameFontSize + 18;
  const detailsX = ORIGINAL_FLYER_BASE_WIDTH * eventDetailsLeft / 100;
  const detailsY = ORIGINAL_FLYER_TOP_HEIGHT + ORIGINAL_FLYER_STUB_HEIGHT * eventDetailsTop / 100;
  const detailsWidth = ORIGINAL_FLYER_BASE_WIDTH * ORIGINAL_FLYER_DETAILS_WIDTH_PERCENT / 100;
  const qrSize = ORIGINAL_FLYER_BASE_WIDTH * stubQrSize / 100;
  const qrX = ORIGINAL_FLYER_BASE_WIDTH - ORIGINAL_FLYER_BASE_WIDTH * stubQrRight / 100 - qrSize;
  const qrY = ORIGINAL_FLYER_BASE_HEIGHT - ORIGINAL_FLYER_STUB_HEIGHT * stubQrBottom / 100 - qrSize;
  const footerCenterY =
    ORIGINAL_FLYER_BASE_HEIGHT -
    ORIGINAL_FLYER_STUB_HEIGHT * ORIGINAL_FLYER_FOOTER_BOTTOM_PERCENT / 100;

  useEffect(() => {
    void Promise.all([
      loadFlyerFont(guestFontFamily, guestFontWeight, guestFontStyle),
      loadCanvasLayerFonts(layers),
    ]);
  }, [guestFontFamily, guestFontStyle, guestFontWeight, layers]);

  return (
    <div
      className="relative w-full aspect-[9/16] overflow-hidden font-sans"
      style={{ background: stubBackgroundColor }}
    >
      <svg
        aria-label="Invitation preview"
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${ORIGINAL_FLYER_BASE_WIDTH} ${ORIGINAL_FLYER_BASE_HEIGHT}`}
        preserveAspectRatio="none"
      >
        <defs>
          <clipPath id={clipId}>
            <path d={ORIGINAL_FLYER_CURVE_PATH} />
          </clipPath>
          <filter
            id={shadowId}
            x={-ORIGINAL_FLYER_CURVE_DEPTH * 3}
            y={-ORIGINAL_FLYER_CURVE_DEPTH * 3}
            width={ORIGINAL_FLYER_BASE_WIDTH + ORIGINAL_FLYER_CURVE_DEPTH * 6}
            height={ORIGINAL_FLYER_BASE_HEIGHT + ORIGINAL_FLYER_CURVE_DEPTH * 6}
            filterUnits="userSpaceOnUse"
          >
            <feGaussianBlur stdDeviation={curveShadowBlur} />
            <feOffset dy={curveShadowOffset} />
          </filter>
        </defs>

        {curveShadowOpacity > 0 && (
          <path
            aria-hidden="true"
            d={ORIGINAL_FLYER_CURVE_PATH}
            fill={curveShadowColor}
            opacity={curveShadowOpacity}
            filter={`url(#${shadowId})`}
          />
        )}

        <foreignObject
          x={0}
          y={0}
          width={ORIGINAL_FLYER_BASE_WIDTH}
          height={ORIGINAL_FLYER_TOP_HEIGHT + ORIGINAL_FLYER_CURVE_DEPTH}
          clipPath={`url(#${clipId})`}
        >
          <div
            className="relative h-full w-full"
            style={{ background: configuration.canvas_background_color }}
          >
            <div
              className="relative w-full overflow-hidden"
              style={{ height: `${ORIGINAL_FLYER_TOP_HEIGHT}px` }}
            >
              {layers
                .filter(
                  (layer) =>
                    layer.parentId === "main-frame" ||
                    layer.parentId === undefined ||
                    layer.parentId === null
                )
                .map((layer) => (
                  <FlyerLayer key={layer.id} layer={layer} qrSvg={qrSvg} />
                ))}
            </div>
          </div>
        </foreignObject>

        {configuration.artboard_stroke_width > 0 && (
          <path
            aria-hidden="true"
            d={ORIGINAL_FLYER_CURVE_PATH}
            fill="none"
            stroke={configuration.artboard_stroke_color ?? "#000000"}
            strokeWidth={configuration.artboard_stroke_width}
          />
        )}

        <foreignObject x={guestX} y={guestY} width={guestWidth} height={120}>
          <div
            className="relative h-full w-full overflow-hidden"
            style={{
              color: stubTextColor,
              fontFamily: guestFontFamily,
              fontStyle: guestFontStyle,
            }}
          >
            <p
              className="m-0 w-full truncate"
              style={{
                fontSize: `${renderedGuestNameSize}px`,
                fontWeight: resolveCssFontWeight(guestFontWeight),
                lineHeight: 1.2,
              }}
            >
              {compactGuestName}
            </p>
            {showGuestCategory && displayGuestCategory && (
              <span
                className="absolute left-0 inline-flex items-center justify-center whitespace-nowrap"
                style={{
                  top: `${badgeTop}px`,
                  minWidth: `${ORIGINAL_FLYER_BADGE_MIN_WIDTH}px`,
                  height: `${ORIGINAL_FLYER_BADGE_HEIGHT}px`,
                  paddingInline: `${ORIGINAL_FLYER_BADGE_HORIZONTAL_PADDING}px`,
                  borderRadius: `${ORIGINAL_FLYER_BADGE_HEIGHT / 2}px`,
                  background: stubAccentColor,
                  color: stubTextColor,
                  fontSize: `${guestCategoryFontSize}px`,
                  fontWeight: resolveCssFontWeight(guestFontWeight),
                  lineHeight: 1,
                }}
              >
                {displayGuestCategory}
              </span>
            )}
          </div>
        </foreignObject>

        {eventDetails.length > 0 && (
          <foreignObject x={detailsX} y={detailsY} width={detailsWidth} height={72}>
            <div
              className="flex h-full min-w-0 flex-col"
              style={{
                gap: `${ORIGINAL_FLYER_DETAILS_GAP}px`,
                fontFamily: guestFontFamily,
              }}
            >
              {eventDetails.map(({ key, label, Icon }) => (
                <div key={key} className="flex min-w-0 items-center" style={{ gap: `${ORIGINAL_FLYER_DETAILS_GAP}px` }}>
                  <Icon
                    aria-hidden="true"
                    size={ORIGINAL_FLYER_DETAILS_ICON_SIZE}
                    strokeWidth={2}
                    color={detailsIconColor}
                    className="shrink-0"
                  />
                  <span
                    className="min-w-0 truncate font-normal"
                    style={{
                      color: stubTextColor,
                      fontSize: `${ORIGINAL_FLYER_DETAILS_FONT_SIZE}px`,
                      lineHeight: `${ORIGINAL_FLYER_DETAILS_ICON_SIZE}px`,
                    }}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </foreignObject>
        )}

        <foreignObject x={qrX} y={qrY} width={qrSize} height={qrSize}>
          <div
            className="flex h-full w-full items-center justify-center"
            style={{
              boxSizing: "border-box",
              padding: `${ORIGINAL_FLYER_QR_PADDING}px`,
              borderRadius: `${ORIGINAL_FLYER_QR_RADIUS}px`,
              background: qrFrameColor,
            }}
          >
            {qrSvg ? (
              <div
                className="h-full w-full overflow-hidden [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
            ) : (
              <div className="h-full w-full animate-pulse rounded-lg bg-foreground/10" />
            )}
          </div>
        </foreignObject>

        <foreignObject
          x={0}
          y={footerCenterY - 12}
          width={ORIGINAL_FLYER_BASE_WIDTH}
          height={24}
        >
          <p
            className="m-0 flex h-full items-center justify-center text-center"
            style={{
              color: stubTextColor,
              fontFamily: "Inter, sans-serif",
              fontSize: `${ORIGINAL_FLYER_FOOTER_FONT_SIZE}px`,
              fontWeight: 500,
              lineHeight: 1,
              opacity: 0.75,
            }}
          >
            powered by{" "}
            <span style={{ color: stubTextColor, fontWeight: 600 }}>
              Gather<span style={{ color: qrFrameColor }}>Via</span>
            </span>
          </p>
        </foreignObject>
      </svg>
    </div>
  );
}

function formatInvitationDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return value;
  const monthName = new Date(year, month - 1, day).toLocaleDateString("en", { month: "short" });
  return `${String(day).padStart(2, "0")} ${monthName} ${year}`;
}

function resolveCssFontWeight(weight: FlyerConfiguration["stub_guest_font_weight"]) {
  if (weight === "medium") return 500;
  if (weight === "semibold") return 600;
  if (weight === "bold") return 700;
  return 400;
}

function FlyerLayer({ layer, qrSvg }: { layer: CanvasLayer; qrSvg: string }) {
  const shadowStyle = layer.shadow
    ? {
        filter: `drop-shadow(${layer.shadow.offsetX}px ${layer.shadow.offsetY}px ${layer.shadow.blur}px ${layer.shadow.color})`,
      }
    : {};

  return (
    <div
      style={{
        position: "absolute",
        left: `${layer.x}%`,
        top: `${layer.y}%`,
        width: `${layer.width}%`,
        height: `${layer.height}%`,
        opacity: layer.opacity,
        zIndex: layer.zIndex,
        transform: `rotate(${layer.rotation ?? 0}deg)`,
        transformOrigin: "center center",
        display: layer.visible ? "block" : "none",
        ...shadowStyle,
      }}
    >
      {layer.type === "text" && (
        <div
          className="w-full h-full flex flex-col justify-center overflow-hidden"
          style={{
            fontFamily: layer.fontFamily,
            fontSize: `${layer.fontSize}px`,
            fontWeight: resolveLayerFontWeight(layer.fontWeight),
            fontStyle: layer.fontStyle ?? "normal",
            lineHeight: FLYER_TEXT_LINE_HEIGHT,
            textAlign: layer.textAlign ?? "center",
            color: isCssGradient(layer.color) ? "transparent" : layer.color,
            background: isCssGradient(layer.color) ? layer.color : undefined,
            backgroundClip: isCssGradient(layer.color) ? "text" : undefined,
            WebkitBackgroundClip: isCssGradient(layer.color) ? "text" : undefined,
            whiteSpace: "pre-wrap",
          }}
        >
          {layer.text}
        </div>
      )}

      {(layer.type === "rect" || layer.type === "frame") && (
        <div
          className="w-full h-full"
          style={{
            background: layer.fill ?? "transparent",
            border: layer.strokeWidth
              ? `${layer.strokeWidth}px solid ${layer.stroke ?? "#000"}`
              : "none",
            borderRadius: `${layer.borderRadius ?? 0}px`,
          }}
        />
      )}

      {layer.type === "ellipse" && (
        <div
          className="w-full h-full rounded-full"
          style={{
            background: layer.fill ?? "transparent",
            border: layer.strokeWidth
              ? `${layer.strokeWidth}px solid ${layer.stroke ?? "#000"}`
              : "none",
          }}
        />
      )}

      {layer.type === "image" && layer.imageUrl && (
        <img
          src={layer.imageUrl}
          alt=""
          draggable={false}
          className="w-full h-full object-cover"
          style={{ borderRadius: `${layer.borderRadius ?? 0}px` }}
        />
      )}

      {layer.type === "qr" && (
        <div
          className="flex h-full w-full items-center justify-center overflow-hidden"
          style={{
            background: layer.fill ?? SECURE_QR_FOREGROUND_COLOR,
            borderRadius: `${layer.borderRadius ?? 0}px`,
          }}
        >
          {qrSvg ? (
            <div
              className="h-full w-full [&>svg]:h-full [&>svg]:w-full"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
          ) : null}
        </div>
      )}

      {layer.type === "polygon" && layer.points && (
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <clipPath id={`polygon-clip-${layer.id}`}>
              <polygon points={layer.points} />
            </clipPath>
          </defs>
          <foreignObject x="0" y="0" width="100" height="100" clipPath={`url(#polygon-clip-${layer.id})`}>
            <div
              {...({ xmlns: "http://www.w3.org/1999/xhtml" } as Record<string, string>)}
              className="h-full w-full"
              style={{ background: layer.fill ?? "transparent" }}
            />
          </foreignObject>
          <polygon
            points={layer.points}
            fill="none"
            stroke={layer.stroke ?? "#000000"}
            strokeWidth={layer.strokeWidth ?? 0}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}

      {layer.type === "path" && layer.pathData && (
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="overflow-visible"
        >
          <defs>
            <clipPath id={`path-clip-${layer.id}`}>
              <path d={layer.pathData} />
            </clipPath>
          </defs>
          {layer.closed && (
            <foreignObject x="0" y="0" width="100" height="100" clipPath={`url(#path-clip-${layer.id})`}>
              <div
                {...({ xmlns: "http://www.w3.org/1999/xhtml" } as Record<string, string>)}
                className="h-full w-full"
                style={{ background: layer.fill ?? "transparent" }}
              />
            </foreignObject>
          )}
          <path
            d={layer.pathData}
            fill="none"
            stroke={layer.stroke ?? "#fff"}
            strokeWidth={layer.strokeWidth ?? 2}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}
    </div>
  );
}
