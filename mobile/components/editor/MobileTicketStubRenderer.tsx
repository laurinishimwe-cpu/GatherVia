import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View, type DimensionValue, type LayoutChangeEvent } from "react-native";
import { CalendarDays, Clock3, MapPin } from "lucide-react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import QRCode from "react-native-qrcode-svg";
import Svg, { Path } from "react-native-svg";
import { MobileFlyerRenderer } from "@/components/editor/MobileFlyerRenderer";
import type { StubRegion } from "@/context/FlyerDraftContext";
import type { CanvasLayer } from "@/lib/types/canvas";
import type { EventRecord } from "@/lib/types/event";
import type { FlyerConfiguration } from "@/lib/types/flyer";
import {
  SECURE_QR_BACKGROUND,
  SECURE_QR_FOREGROUND,
  STUB_BASE_HEIGHT,
  STUB_BASE_WIDTH,
  STUB_CURVE_CONTROL_FACTOR,
  STUB_CURVE_DEPTH,
  STUB_DETAILS_WIDTH,
  STUB_FOOTER_BOTTOM,
  STUB_MIN_QR_BOTTOM,
  STUB_QR_PADDING,
  STUB_QR_RADIUS,
  STUB_REFERENCE_HEIGHT,
  STUB_TOP_RATIO,
  clampStubValue,
  formatStubDate,
  getStubGuestName,
  getStubGuestNameFontSize,
  getStubGuestTopMaximum,
  getStubDetailsTopMaximum,
  getStubQrBottomRange,
} from "@/lib/flyer/stubGeometry";
import { resolveMobileFontFace } from "@/lib/flyer/fontRegistry";

interface MobileTicketStubRendererProps {
  layers: CanvasLayer[];
  configuration: FlyerConfiguration;
  temporaryConfigurationPatch?: Partial<FlyerConfiguration> | null;
  event: EventRecord | null;
  guestName?: string;
  guestCategory?: string;
  qrValue?: string;
  mode: "edit" | "preview";
  selectedRegion?: StubRegion;
  onSelectRegion?: (region: StubRegion) => void;
  onRegionPositionCommit?: (region: "guest" | "event-details" | "qr", patch: Partial<FlyerConfiguration>) => void;
  onGestureActiveChange?: (active: boolean) => void;
  interactionBlocked?: boolean;
}

const pct = (value: number): DimensionValue => `${value}%`;
const TOP_HEIGHT = STUB_BASE_HEIGHT * STUB_TOP_RATIO;
const CURVE_EDGE_Y = TOP_HEIGHT - STUB_CURVE_DEPTH;
const CURVE_CONTROL_Y = TOP_HEIGHT + STUB_CURVE_DEPTH * STUB_CURVE_CONTROL_FACTOR;
const CURVE_PATH = `M 0 ${CURVE_EDGE_Y} Q ${STUB_BASE_WIDTH / 2} ${CURVE_CONTROL_Y} ${STUB_BASE_WIDTH} ${CURVE_EDGE_Y}`;
const COVER_PATH = `${CURVE_PATH} L ${STUB_BASE_WIDTH} ${STUB_BASE_HEIGHT} L 0 ${STUB_BASE_HEIGHT} Z`;

export function MobileTicketStubRenderer({
  layers,
  configuration,
  temporaryConfigurationPatch,
  event,
  guestName = "Preview Guest",
  guestCategory = "Guest",
  qrValue = "gathervia-editor-preview",
  mode,
  selectedRegion = "background",
  onSelectRegion,
  onRegionPositionCommit,
  onGestureActiveChange,
  interactionBlocked = false,
}: MobileTicketStubRendererProps) {
  const [layout, setLayout] = useState({ width: STUB_BASE_WIDTH, height: STUB_BASE_HEIGHT });
  const config = useMemo(() => ({ ...configuration, ...temporaryConfigurationPatch }), [configuration, temporaryConfigurationPatch]);
  const scale = layout.width / STUB_BASE_WIDTH;
  const stubHeight = layout.height * (1 - STUB_TOP_RATIO);
  const renderedGuestName = getStubGuestName(guestName, config.stub_guest_name_mode);
  const stubFontFamily = resolveMobileFontFace(
    config.stub_guest_font_family,
    config.stub_guest_font_weight,
    config.stub_guest_font_style,
  );
  const guestFontSize = getStubGuestNameFontSize(config.stub_guest_name_font_size, renderedGuestName) * scale;
  const qrSize = layout.width * config.stub_qr_size / 100;
  const details = [
    config.stub_show_event_date && event?.event_date
      ? { key: "date", Icon: CalendarDays, label: formatStubDate(event.event_date) }
      : null,
    config.stub_show_event_time && event?.event_time
      ? { key: "time", Icon: Clock3, label: event.event_time.slice(0, 5) }
      : null,
    config.stub_show_event_location && event?.event_location?.trim()
      ? { key: "location", Icon: MapPin, label: event.event_location.trim() }
      : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0 && (width !== layout.width || height !== layout.height)) setLayout({ width, height });
  };

  return (
    <View
      onLayout={onLayout}
      style={[styles.root, { backgroundColor: config.stub_background_color }]}
    >
      <View pointerEvents="none" style={styles.mainDesign}>
        <MobileFlyerRenderer layers={layers} configuration={config} mode="preview" />
      </View>

      <Svg pointerEvents="none" style={StyleSheet.absoluteFill} viewBox={`0 0 ${STUB_BASE_WIDTH} ${STUB_BASE_HEIGHT}`} preserveAspectRatio="none">
        <Path d={COVER_PATH} fill={config.stub_background_color} />
        {config.stub_curve_shadow_opacity > 0 ? (
          <Path
            d={CURVE_PATH}
            fill="none"
            stroke={config.stub_curve_shadow_color}
            strokeOpacity={clampStubValue(config.stub_curve_shadow_opacity / 100, 0, 1)}
            strokeWidth={Math.max(config.stub_curve_shadow_blur, 1)}
            transform={`translate(0 ${config.stub_curve_shadow_offset})`}
          />
        ) : null}
        {config.artboard_stroke_width > 0 ? (
          <Path d={CURVE_PATH} fill="none" stroke={config.artboard_stroke_color} strokeWidth={config.artboard_stroke_width} />
        ) : null}
      </Svg>

      {mode === "edit" ? <Pressable disabled={interactionBlocked} onPress={() => onSelectRegion?.("background")} style={styles.backgroundHitTarget} /> : null}

      <View pointerEvents="box-none" style={[styles.stub, { height: stubHeight }]}>
        <MovableRegion
          region="guest"
          selected={mode === "edit" && selectedRegion === "guest"}
          interactive={mode === "edit" && !interactionBlocked}
          left={config.stub_guest_info_left}
          top={config.stub_guest_info_top}
          layoutWidth={layout.width}
          stubHeight={stubHeight}
          maximumTop={getStubGuestTopMaximum(config, renderedGuestName.length)}
          onSelect={onSelectRegion}
          onCommit={onRegionPositionCommit}
          onGestureActiveChange={onGestureActiveChange}
          style={{ width: "60%" }}
        >
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{
              color: config.stub_text_color,
              fontFamily: stubFontFamily,
              fontWeight: "400",
              fontStyle: "normal",
              fontSize: guestFontSize,
            }}
          >
            {renderedGuestName}
          </Text>
          {config.stub_show_guest_category ? (
            <View style={[styles.categoryBadge, { backgroundColor: config.stub_accent_color, minWidth: 96 * scale, height: 32 * scale, paddingHorizontal: 18 * scale, borderRadius: 16 * scale, marginTop: 5 * scale }]}>
              <Text style={{ color: config.stub_text_color, fontSize: 10 * scale, fontWeight: "700" }}>{guestCategory}</Text>
            </View>
          ) : null}
        </MovableRegion>

        <MovableRegion
          region="event-details"
          selected={mode === "edit" && selectedRegion === "event-details"}
          interactive={mode === "edit" && !interactionBlocked}
          left={config.stub_event_details_left}
          top={config.stub_event_details_top}
          layoutWidth={layout.width}
          stubHeight={stubHeight}
          maximumTop={getStubDetailsTopMaximum(config)}
          onSelect={onSelectRegion}
          onCommit={onRegionPositionCommit}
          onGestureActiveChange={onGestureActiveChange}
          style={{ width: pct(STUB_DETAILS_WIDTH), gap: 6 * scale }}
        >
          {details.length ? details.map(({ key, Icon, label }) => (
            <View key={key} style={[styles.detailRow, { gap: 6 * scale }]}>
              <Icon color={config.stub_event_details_icon_color} size={12 * scale} />
              <Text numberOfLines={1} style={{ flex: 1, color: config.stub_text_color, fontFamily: stubFontFamily, fontSize: 10 * scale }}>{label}</Text>
            </View>
          )) : mode === "edit" ? (
            <Text style={{ color: config.stub_text_color, opacity: 0.65, fontSize: 10 * scale }}>Event details hidden</Text>
          ) : null}
        </MovableRegion>

        {config.qr_visibility !== "hidden" ? (
          <MovableRegion
            region="qr"
            selected={mode === "edit" && selectedRegion === "qr"}
            interactive={mode === "edit" && !interactionBlocked}
            right={config.stub_qr_right}
            bottom={Math.max(config.stub_qr_bottom, STUB_MIN_QR_BOTTOM)}
            layoutWidth={layout.width}
            stubHeight={stubHeight}
            qrSize={config.stub_qr_size}
            onSelect={onSelectRegion}
            onCommit={onRegionPositionCommit}
            onGestureActiveChange={onGestureActiveChange}
            style={{ width: qrSize, height: qrSize }}
          >
            <View style={{ flex: 1, padding: STUB_QR_PADDING * scale, borderRadius: STUB_QR_RADIUS * scale, backgroundColor: config.qr_foreground_color }}>
              <QRCode
                value={qrValue}
                size={Math.max(qrSize - STUB_QR_PADDING * scale * 2, 8)}
                color={SECURE_QR_FOREGROUND}
                backgroundColor={SECURE_QR_BACKGROUND}
                quietZone={0}
              />
            </View>
          </MovableRegion>
        ) : null}

        <Text pointerEvents="none" style={[styles.poweredBy, { bottom: pct(STUB_FOOTER_BOTTOM), color: config.stub_text_color, fontSize: 13 * scale }]}>powered by Gather<Text style={{ color: config.qr_foreground_color }}>Via</Text></Text>
      </View>

      {mode === "edit" && selectedRegion === "background" ? <View pointerEvents="none" style={styles.backgroundSelection}><Text style={styles.selectionLabel}>Stub background</Text></View> : null}
    </View>
  );
}

function MovableRegion({
  region,
  selected,
  interactive,
  left,
  top,
  right,
  bottom,
  layoutWidth,
  stubHeight,
  maximumTop,
  qrSize,
  onSelect,
  onCommit,
  onGestureActiveChange,
  style,
  children,
}: {
  region: "guest" | "event-details" | "qr";
  selected: boolean;
  interactive: boolean;
  left?: number;
  top?: number;
  right?: number;
  bottom?: number;
  layoutWidth: number;
  stubHeight: number;
  maximumTop?: number;
  qrSize?: number;
  onSelect?: (region: StubRegion) => void;
  onCommit?: (region: "guest" | "event-details" | "qr", patch: Partial<FlyerConfiguration>) => void;
  onGestureActiveChange?: (active: boolean) => void;
  style?: object;
  children: React.ReactNode;
}) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }, { translateY: translateY.value }] }));

  const commit = (dx: number, dy: number) => {
    onGestureActiveChange?.(false);
    if (region === "qr") {
      const size = qrSize ?? 30;
      const bottomRange = getStubQrBottomRange(size);
      onCommit?.(region, {
        stub_qr_right: clampStubValue((right ?? 0) - dx / layoutWidth * 100, 0, 100 - size),
        stub_qr_bottom: clampStubValue((bottom ?? STUB_MIN_QR_BOTTOM) - dy / stubHeight * 100, bottomRange.minimum, bottomRange.maximum),
      });
    } else if (region === "guest") {
      onCommit?.(region, {
        stub_guest_info_left: clampStubValue((left ?? 0) + dx / layoutWidth * 100, 0, 36),
        stub_guest_info_top: clampStubValue((top ?? 0) + dy / stubHeight * 100, 0, maximumTop ?? 100),
      });
    } else {
      onCommit?.(region, {
        stub_event_details_left: clampStubValue((left ?? 0) + dx / layoutWidth * 100, 0, 56),
        stub_event_details_top: clampStubValue((top ?? 0) + dy / stubHeight * 100, 0, maximumTop ?? 100),
      });
    }
  };

  const gesture = useMemo(() => Gesture.Pan()
    .enabled(interactive)
    .minPointers(1)
    .maxPointers(1)
    .onBegin(() => {
      runOnJS(onSelect ?? (() => undefined))(region);
      if (onGestureActiveChange) runOnJS(onGestureActiveChange)(true);
    })
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    })
    .onEnd((event) => runOnJS(commit)(event.translationX, event.translationY))
    .onFinalize((_event, success) => {
      translateX.value = 0;
      translateY.value = 0;
      if (!success && onGestureActiveChange) runOnJS(onGestureActiveChange)(false);
    }), [interactive, layoutWidth, maximumTop, onGestureActiveChange, onSelect, region, stubHeight, top, left, right, bottom, qrSize]);

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          styles.region,
          left !== undefined ? { left: pct(left) } : null,
          top !== undefined ? { top: pct(top) } : null,
          right !== undefined ? { right: pct(right) } : null,
          bottom !== undefined ? { bottom: pct(bottom) } : null,
          style,
          selected && styles.selectedRegion,
          animatedStyle,
        ]}
      >
        {selected ? <Text pointerEvents="none" style={styles.selectionLabel}>{region === "event-details" ? "Details" : region === "qr" ? "Secure QR" : "Guest"}</Text> : null}
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: { width: "100%", height: "100%", overflow: "hidden" },
  backgroundHitTarget: { position: "absolute", left: 0, right: 0, top: "60%", bottom: 0, zIndex: 2 },
  mainDesign: { position: "absolute", left: 0, top: 0, right: 0, height: "66.667%" },
  stub: { position: "absolute", left: 0, right: 0, bottom: 0 },
  region: { position: "absolute", zIndex: 5 },
  selectedRegion: { borderWidth: 1.5, borderColor: "#4fd6be", borderStyle: "dashed" },
  backgroundSelection: { ...StyleSheet.absoluteFillObject, top: "60%", borderWidth: 1.5, borderColor: "#4fd6be", borderStyle: "dashed", zIndex: 3 },
  selectionLabel: { position: "absolute", left: -1, top: -18, paddingHorizontal: 5, height: 17, lineHeight: 17, borderRadius: 4, overflow: "hidden", color: "#07110f", backgroundColor: "#4fd6be", fontSize: 8, fontWeight: "800", zIndex: 20 },
  categoryBadge: { alignSelf: "flex-start", alignItems: "center", justifyContent: "center" },
  detailRow: { flexDirection: "row", alignItems: "center" },
  poweredBy: { position: "absolute", left: 0, right: 0, textAlign: "center", opacity: 0.8, fontWeight: "500" },
});
