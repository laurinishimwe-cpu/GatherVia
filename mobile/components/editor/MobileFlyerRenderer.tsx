import { useCallback, useMemo, useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
  type LayoutChangeEvent,
  type ViewStyle,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";
import QRCode from "react-native-qrcode-svg";
import Svg, { Path, Polygon } from "react-native-svg";
import { resolveAssetUrl } from "@/lib/api/api";
import type { CanvasLayer } from "@/lib/types/canvas";
import type { FlyerConfiguration } from "@/lib/types/flyer";
import {
  DESIGN_ASPECT_RATIO,
  EDITOR_REFERENCE_WIDTH,
} from "@/lib/flyer/normalizeLayers";
import { resolveMobileFontFace } from "@/lib/flyer/fontRegistry";

export interface LayerGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ActiveLayerTransform extends LayerGeometry {
  layerId: string;
  kind: "drag" | "resize";
}

export interface TemporaryLayerOverride {
  layerId: string;
  patch: Partial<CanvasLayer>;
}

type ResizeHandle = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export interface MobileFlyerRendererProps {
  layers: CanvasLayer[];
  configuration: FlyerConfiguration;
  mode: "canvas" | "preview" | "thumbnail";
  selectedLayerId?: string | null;
  onSelectLayer?: (id: string | null) => void;
  interactive?: boolean;
  interactionBlocked?: boolean;
  viewportScale?: SharedValue<number>;
  temporaryLayerTransform?: SharedValue<ActiveLayerTransform | null>;
  temporaryLayerOverride?: TemporaryLayerOverride | null;
  onLayerGeometryCommit?: (id: string, geometry: LayerGeometry) => void;
  onLayerGestureActiveChange?: (active: boolean) => void;
  onLockedLayerAttempt?: (id: string) => void;
}

const percent = (value: number): DimensionValue => `${value}%`;

function safePaint(value: string | undefined, fallback: string) {
  if (!value || /gradient\s*\(/i.test(value)) return fallback;
  return value;
}

function shadowStyle(layer: CanvasLayer, scale: number): ViewStyle {
  if (!layer.shadow) return {};
  const shadowColor = splitShadowColor(layer.shadow.color);
  const offsetX = layer.shadow.offsetX * scale;
  const offsetY = layer.shadow.offsetY * scale;
  const blur = Math.max(layer.shadow.blur * scale, 0);
  return {
    shadowColor: shadowColor.color,
    shadowOffset: {
      width: offsetX,
      height: offsetY,
    },
    shadowOpacity: shadowColor.opacity,
    shadowRadius: blur,
    elevation: Math.max(Math.round(blur * 0.4), 0),
    boxShadow: `${offsetX}px ${offsetY}px ${blur}px ${safePaint(layer.shadow.color, "#000000")}`,
  };
}

function splitShadowColor(value: string | undefined): {
  color: string;
  opacity: number;
} {
  const source = safePaint(value, "#000000").trim();
  if (source.toLowerCase() === "transparent") {
    return { color: "#000000", opacity: 0 };
  }

  const hex = source.match(/^#([\da-f]{4}|[\da-f]{8})$/i)?.[1];
  if (hex) {
    const expanded = hex.length === 4
      ? hex.split("").map((character) => `${character}${character}`).join("")
      : hex;
    return {
      color: `#${expanded.slice(0, 6)}`,
      opacity: Number.parseInt(expanded.slice(6, 8), 16) / 255,
    };
  }

  const rgba = source.match(
    /^rgba\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/i,
  );
  if (rgba) {
    return {
      color: `rgb(${rgba[1]}, ${rgba[2]}, ${rgba[3]})`,
      opacity: Math.min(Math.max(Number(rgba[4]), 0), 1),
    };
  }

  return { color: source, opacity: 1 };
}

function workletClamp(value: number, minimum: number, maximum: number) {
  "worklet";
  return Math.min(Math.max(value, minimum), maximum);
}

function roundGeometry(geometry: LayerGeometry): LayerGeometry {
  "worklet";
  const round = (value: number) => Math.round(value * 10000) / 10000;
  return {
    x: round(geometry.x),
    y: round(geometry.y),
    width: round(geometry.width),
    height: round(geometry.height),
  };
}

function resizedGeometry(
  layer: LayerGeometry,
  handle: ResizeHandle,
  translationX: number,
  translationY: number,
  artboardWidth: number,
  artboardHeight: number,
  viewportScale: number,
  minimumWidth: number,
  minimumHeight: number,
  aspectMode: "free" | "preserve" | "square",
): LayerGeometry {
  "worklet";
  const safeScale = Math.max(viewportScale, 0.0001);
  const dx = translationX / (artboardWidth * safeScale) * 100;
  const dy = translationY / (artboardHeight * safeScale) * 100;
  const movesLeft = handle === "top-left" || handle === "bottom-left";
  const movesTop = handle === "top-left" || handle === "top-right";
  const fixedX = movesLeft ? layer.x + layer.width : layer.x;
  const fixedY = movesTop ? layer.y + layer.height : layer.y;
  let width = workletClamp(layer.width + (movesLeft ? -dx : dx), minimumWidth, 200);
  let height = workletClamp(layer.height + (movesTop ? -dy : dy), minimumHeight, 200);

  if (aspectMode !== "free") {
    const originalWidthPx = layer.width * artboardWidth / 100;
    const originalHeightPx = layer.height * artboardHeight / 100;
    const targetRatio = aspectMode === "square"
      ? 1
      : originalWidthPx / Math.max(originalHeightPx, 0.0001);
    const proposedWidthPx = width * artboardWidth / 100;
    const proposedHeightPx = height * artboardHeight / 100;
    const widthChange = Math.abs(proposedWidthPx - originalWidthPx) / Math.max(originalWidthPx, 1);
    const heightChange = Math.abs(proposedHeightPx - originalHeightPx) / Math.max(originalHeightPx, 1);
    let widthPx: number;
    let heightPx: number;

    if (widthChange >= heightChange) {
      widthPx = proposedWidthPx;
      heightPx = widthPx / targetRatio;
    } else {
      heightPx = proposedHeightPx;
      widthPx = heightPx * targetRatio;
    }

    const minimumWidthPx = minimumWidth * artboardWidth / 100;
    const minimumHeightPx = minimumHeight * artboardHeight / 100;
    const minimumScale = Math.max(
      minimumWidthPx / Math.max(widthPx, 0.0001),
      minimumHeightPx / Math.max(heightPx, 0.0001),
      1,
    );
    widthPx *= minimumScale;
    heightPx *= minimumScale;
    width = workletClamp(widthPx / artboardWidth * 100, minimumWidth, 200);
    height = workletClamp(heightPx / artboardHeight * 100, minimumHeight, 200);
  }

  const x = movesLeft ? fixedX - width : fixedX;
  const y = movesTop ? fixedY - height : fixedY;
  return roundGeometry({
    x: workletClamp(x, -50, 99),
    y: workletClamp(y, -50, 99),
    width,
    height,
  });
}

function minimumSize(layer: CanvasLayer) {
  if (layer.type === "text") return { width: 8, height: 3 };
  if (layer.type === "image") return { width: 5, height: 5 };
  if (layer.type === "qr") return { width: 8, height: 8 };
  return { width: 2, height: 2 };
}

export function MobileFlyerRenderer({
  layers,
  configuration,
  mode,
  selectedLayerId = null,
  onSelectLayer,
  interactive = false,
  interactionBlocked = false,
  viewportScale,
  temporaryLayerTransform,
  temporaryLayerOverride,
  onLayerGeometryCommit,
  onLayerGestureActiveChange,
  onLockedLayerAttempt,
}: MobileFlyerRendererProps) {
  const [renderedSize, setRenderedSize] = useState({ width: 320, height: 379 });
  const scale = renderedSize.width / EDITOR_REFERENCE_WIDTH;
  const orderedLayers = useMemo(() => [...layers]
    .filter((layer) => layer.visible !== false && (
      layer.parentId === undefined || layer.parentId === null || layer.parentId === "" || layer.parentId === "main-frame"
    ))
    .sort((first, second) => first.zIndex - second.zIndex), [layers]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0 && (width !== renderedSize.width || height !== renderedSize.height)) {
      setRenderedSize({ width, height });
    }
  };

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.canvas,
        { backgroundColor: safePaint(configuration.canvas_background_color, "#ffffff") },
        mode === "canvas" && configuration.artboard_stroke_width > 0
          ? {
              borderColor: safePaint(configuration.artboard_stroke_color, "#000000"),
              borderWidth: Math.max(configuration.artboard_stroke_width * scale, 0.5),
            }
          : null,
      ]}
    >
      {interactive ? (
        <Pressable
          accessibilityLabel="Deselect layer"
          disabled={interactionBlocked}
          onPress={() => onSelectLayer?.(null)}
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      {orderedLayers.map((layer) => {
        const renderedLayer = temporaryLayerOverride?.layerId === layer.id
          ? { ...layer, ...temporaryLayerOverride.patch, id: layer.id }
          : layer;
        return (
        <RendererLayer
          key={renderedLayer.id}
          layer={renderedLayer}
          configuration={configuration}
          mode={mode}
          selected={mode === "canvas" && renderedLayer.id === selectedLayerId}
          interactive={interactive}
          interactionBlocked={interactionBlocked}
          artboardWidth={renderedSize.width}
          artboardHeight={renderedSize.height}
          renderScale={scale}
          viewportScale={viewportScale}
          temporaryLayerTransform={temporaryLayerTransform}
          onSelectLayer={onSelectLayer}
          onLayerGeometryCommit={onLayerGeometryCommit}
          onLayerGestureActiveChange={onLayerGestureActiveChange}
          onLockedLayerAttempt={onLockedLayerAttempt}
        />
        );
      })}
    </View>
  );
}

function RendererLayer({
  layer,
  configuration,
  mode,
  selected,
  interactive,
  interactionBlocked,
  artboardWidth,
  artboardHeight,
  renderScale,
  viewportScale,
  temporaryLayerTransform,
  onSelectLayer,
  onLayerGeometryCommit,
  onLayerGestureActiveChange,
  onLockedLayerAttempt,
}: {
  layer: CanvasLayer;
  configuration: FlyerConfiguration;
  mode: MobileFlyerRendererProps["mode"];
  selected: boolean;
  interactive: boolean;
  interactionBlocked: boolean;
  artboardWidth: number;
  artboardHeight: number;
  renderScale: number;
  viewportScale?: SharedValue<number>;
  temporaryLayerTransform?: SharedValue<ActiveLayerTransform | null>;
  onSelectLayer?: (id: string | null) => void;
  onLayerGeometryCommit?: (id: string, geometry: LayerGeometry) => void;
  onLayerGestureActiveChange?: (active: boolean) => void;
  onLockedLayerAttempt?: (id: string) => void;
}) {
  const minimum = minimumSize(layer);
  const aspectMode = layer.type === "qr" ? "square" : layer.type === "image" ? "preserve" : "free";
  const canResize = !layer.locked && layer.type !== "frame";
  const frame: ViewStyle = {
    position: "absolute",
    left: percent(layer.x),
    top: percent(layer.y),
    width: percent(Math.max(layer.width, 0)),
    height: percent(Math.max(layer.height, 0)),
    opacity: layer.opacity ?? 1,
    transform: [{ rotate: `${layer.rotation ?? 0}deg` }],
    zIndex: layer.zIndex,
    ...shadowStyle(layer, renderScale),
  };

  const temporaryStyle = useAnimatedStyle(() => {
    const temporary = temporaryLayerTransform?.value;
    if (!temporary || temporary.layerId !== layer.id) return {};
    return {
      left: temporary.x * artboardWidth / 100,
      top: temporary.y * artboardHeight / 100,
      width: temporary.width * artboardWidth / 100,
      height: temporary.height * artboardHeight / 100,
    };
  }, [artboardHeight, artboardWidth, layer.id, temporaryLayerTransform]);

  const commitAndClear = useCallback((geometry: LayerGeometry) => {
    onLayerGeometryCommit?.(layer.id, geometry);
    requestAnimationFrame(() => {
      if (temporaryLayerTransform?.value?.layerId === layer.id) temporaryLayerTransform.value = null;
    });
    onLayerGestureActiveChange?.(false);
  }, [layer.id, onLayerGeometryCommit, onLayerGestureActiveChange, temporaryLayerTransform]);

  const createResizeGesture = useCallback((handle: ResizeHandle) => Gesture.Pan()
    .enabled(interactive && !interactionBlocked)
    .minPointers(1)
    .maxPointers(1)
    .minDistance(0)
    .onStart(() => {
      if (!canResize) {
        if (layer.locked && onLockedLayerAttempt) runOnJS(onLockedLayerAttempt)(layer.id);
        return;
      }
      if (onLayerGestureActiveChange) runOnJS(onLayerGestureActiveChange)(true);
      if (temporaryLayerTransform) {
        temporaryLayerTransform.value = {
          layerId: layer.id,
          kind: "resize",
          x: layer.x,
          y: layer.y,
          width: layer.width,
          height: layer.height,
        };
      }
    })
    .onUpdate((event) => {
      if (!canResize || !temporaryLayerTransform) return;
      const geometry = resizedGeometry(
        layer,
        handle,
        event.translationX,
        event.translationY,
        artboardWidth,
        artboardHeight,
        viewportScale?.value ?? 1,
        minimum.width,
        minimum.height,
        aspectMode,
      );
      temporaryLayerTransform.value = { layerId: layer.id, kind: "resize", ...geometry };
    })
    .onEnd(() => {
      const temporary = temporaryLayerTransform?.value;
      if (canResize && temporary?.layerId === layer.id && temporary.kind === "resize") {
        runOnJS(commitAndClear)(roundGeometry(temporary));
      }
    })
    .onFinalize((_event, success) => {
      if (!success && temporaryLayerTransform?.value?.layerId === layer.id) {
        temporaryLayerTransform.value = null;
        if (onLayerGestureActiveChange) runOnJS(onLayerGestureActiveChange)(false);
      }
    }), [
      artboardHeight, artboardWidth, aspectMode, canResize, commitAndClear, interactionBlocked,
      interactive, layer, minimum.height, minimum.width, onLayerGestureActiveChange,
      onLockedLayerAttempt, temporaryLayerTransform, viewportScale,
    ]);

  const resizeGestures = useMemo(() => ({
    "top-left": createResizeGesture("top-left"),
    "top-right": createResizeGesture("top-right"),
    "bottom-left": createResizeGesture("bottom-left"),
    "bottom-right": createResizeGesture("bottom-right"),
  }), [createResizeGesture]);

  const dragGesture = useMemo(() => Gesture.Pan()
    .enabled(interactive && !interactionBlocked)
    .minPointers(1)
    .maxPointers(1)
    .minDistance(4)
    .requireExternalGestureToFail(...Object.values(resizeGestures))
    .onBegin(() => {
      if (onSelectLayer) runOnJS(onSelectLayer)(layer.id);
    })
    .onStart(() => {
      if (layer.locked) {
        if (onLockedLayerAttempt) runOnJS(onLockedLayerAttempt)(layer.id);
        return;
      }
      if (onLayerGestureActiveChange) runOnJS(onLayerGestureActiveChange)(true);
      if (temporaryLayerTransform) {
        temporaryLayerTransform.value = {
          layerId: layer.id,
          kind: "drag",
          x: layer.x,
          y: layer.y,
          width: layer.width,
          height: layer.height,
        };
      }
    })
    .onUpdate((event) => {
      if (layer.locked || !temporaryLayerTransform) return;
      const scale = Math.max(viewportScale?.value ?? 1, 0.0001);
      const nextX = layer.x + event.translationX / (artboardWidth * scale) * 100;
      const nextY = layer.y + event.translationY / (artboardHeight * scale) * 100;
      const minimumX = Math.max(-50, 1 - layer.width);
      const minimumY = Math.max(-50, 1 - layer.height);
      temporaryLayerTransform.value = {
        layerId: layer.id,
        kind: "drag",
        x: workletClamp(nextX, minimumX, 99),
        y: workletClamp(nextY, minimumY, 99),
        width: layer.width,
        height: layer.height,
      };
    })
    .onEnd(() => {
      const temporary = temporaryLayerTransform?.value;
      if (!layer.locked && temporary?.layerId === layer.id && temporary.kind === "drag") {
        runOnJS(commitAndClear)(roundGeometry(temporary));
      }
    })
    .onFinalize((_event, success) => {
      if (!success && temporaryLayerTransform?.value?.layerId === layer.id) {
        temporaryLayerTransform.value = null;
        if (onLayerGestureActiveChange) runOnJS(onLayerGestureActiveChange)(false);
      }
    }), [
      artboardHeight, artboardWidth, commitAndClear, interactionBlocked, interactive, layer,
      onLayerGestureActiveChange, onLockedLayerAttempt, onSelectLayer, resizeGestures,
      temporaryLayerTransform, viewportScale,
    ]);

  const content = (
    <Animated.View
      style={[frame, temporaryStyle]}
    >
      {interactive ? (
        <Pressable
          accessibilityLabel={`Select ${layer.name ?? layer.type} layer`}
          disabled={interactionBlocked}
          hitSlop={12}
          onPress={() => onSelectLayer?.(layer.id)}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View pointerEvents="none" style={styles.fill}>
        <LayerContent layer={layer} configuration={configuration} scale={renderScale} compact={mode === "thumbnail"} />
      </View>
      {selected ? <SelectionChrome resizeGestures={resizeGestures} /> : null}
    </Animated.View>
  );

  return interactive ? <GestureDetector gesture={dragGesture}>{content}</GestureDetector> : content;
}

function LayerContent({
  layer,
  configuration,
  scale,
  compact,
}: {
  layer: CanvasLayer;
  configuration: FlyerConfiguration;
  scale: number;
  compact: boolean;
}) {
  if (layer.type === "text") {
    return (
      <View style={styles.textFrame}>
        <Text
          numberOfLines={compact ? 4 : undefined}
          style={{
            color: safePaint(layer.color, "#000000"),
            fontFamily: resolveMobileFontFace(
              layer.fontFamily,
              layer.fontWeight,
              layer.fontStyle,
            ),
            fontSize: Math.max((layer.fontSize ?? 24) * scale, compact ? 4 : 5),
            fontWeight: "400",
            fontStyle: "normal",
            lineHeight: Math.max((layer.fontSize ?? 24) * scale * 1.2, compact ? 5 : 6),
            textAlign: layer.textAlign ?? "center",
          }}
        >
          {layer.text ?? ""}
        </Text>
      </View>
    );
  }

  if (layer.type === "image" && layer.imageUrl) {
    return <Image source={{ uri: resolveAssetUrl(layer.imageUrl) }} resizeMode="cover" style={[styles.fill, { borderRadius: Math.max((layer.borderRadius ?? 0) * scale, 0) }]} />;
  }

  if (layer.type === "rect" || layer.type === "frame" || layer.type === "ellipse") {
    return <View style={[styles.fill, {
      backgroundColor: safePaint(layer.fill, "transparent"),
      borderColor: safePaint(layer.stroke, "transparent"),
      borderWidth: Math.max((layer.strokeWidth ?? 0) * scale, 0),
      borderRadius: layer.type === "ellipse" ? 9999 : Math.max((layer.borderRadius ?? 0) * scale, 0),
    }]} />;
  }

  if (layer.type === "polygon") {
    const points = layer.points;
    if (!points) return null;
    return <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none"><Polygon points={points} fill={safePaint(layer.fill, "transparent")} stroke={safePaint(layer.stroke, "transparent")} strokeWidth={(layer.strokeWidth ?? 0) * scale} vectorEffect="non-scaling-stroke" /></Svg>;
  }

  if (layer.type === "path") {
    const rawPath = layer.pathData;
    if (!rawPath) return null;
    const path = layer.closed && !/[zZ]\s*$/.test(rawPath) ? `${rawPath} Z` : rawPath;
    return <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none"><Path d={path} fill={layer.closed ? safePaint(layer.fill, "transparent") : "none"} stroke={safePaint(layer.stroke, "#18A0FB")} strokeWidth={(layer.strokeWidth ?? 2) * scale} vectorEffect="non-scaling-stroke" /></Svg>;
  }

  if (layer.type === "qr") {
    const foreground = safePaint(layer.stroke, configuration.qr_foreground_color);
    const transparent = configuration.qr_background_transparent;
    const background = transparent ? "transparent" : safePaint(layer.fill, configuration.qr_background_color);
    return (
      <View style={[styles.qr, { backgroundColor: background, borderRadius: Math.max((layer.borderRadius ?? 0) * scale, 0) }]}>
        <QRCode value={layer.qrValue ?? "gathervia-invitation-preview"} color={foreground} backgroundColor={background} size={renderedQrSize(layer, scale)} quietZone={0} />
      </View>
    );
  }

  return null;
}

function renderedQrSize(layer: CanvasLayer, scale: number) {
  const referenceHeight = EDITOR_REFERENCE_WIDTH / DESIGN_ASPECT_RATIO;
  const width = layer.width * EDITOR_REFERENCE_WIDTH / 100;
  const height = layer.height * referenceHeight / 100;
  return Math.max(Math.min(width, height) * scale, 12);
}

function SelectionChrome({ resizeGestures }: { resizeGestures: Record<ResizeHandle, ReturnType<typeof Gesture.Pan>> }) {
  return (
    <View pointerEvents="box-none" style={styles.selection}>
      {(Object.keys(resizeGestures) as ResizeHandle[]).map((handle) => (
        <GestureDetector key={handle} gesture={resizeGestures[handle]}>
          <View style={[styles.handleHitArea, styles[handle]]}>
            <View style={styles.handle} />
          </View>
        </GestureDetector>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { width: "100%", height: "100%", overflow: "hidden" },
  fill: { width: "100%", height: "100%" },
  textFrame: { width: "100%", height: "100%", justifyContent: "center", overflow: "hidden" },
  qr: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  selection: { ...StyleSheet.absoluteFillObject, borderWidth: 2, borderColor: "#4fd6be", zIndex: 1000 },
  handleHitArea: { position: "absolute", width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  handle: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: "#4fd6be", backgroundColor: "#ffffff" },
  "top-left": { left: -18, top: -18 },
  "top-right": { right: -18, top: -18 },
  "bottom-left": { left: -18, bottom: -18 },
  "bottom-right": { right: -18, bottom: -18 },
});
