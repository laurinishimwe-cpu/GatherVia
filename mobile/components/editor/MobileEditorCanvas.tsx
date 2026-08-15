import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import {
  MobileFlyerRenderer,
  type ActiveLayerTransform,
  type LayerGeometry,
  type TemporaryLayerOverride,
} from "@/components/editor/MobileFlyerRenderer";
import type { EditorViewport } from "@/context/FlyerDraftContext";
import { useThemeMode } from "@/context/ThemeContext";
import type { CanvasLayer } from "@/lib/types/canvas";
import type { FlyerConfiguration } from "@/lib/types/flyer";

interface ArtboardLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CanvasOverlayInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface LayerOverlayAnchor {
  x: number;
  y: number;
  width: number;
  height: number;
  stageWidth: number;
  stageHeight: number;
}

interface UsableLayout extends ArtboardLayout {}

interface MobileEditorCanvasProps {
  layers: CanvasLayer[];
  configuration: FlyerConfiguration;
  selectedLayerId: string | null;
  onSelectLayer: (id: string | null) => void;
  viewport: EditorViewport;
  onViewportChange: (viewport: EditorViewport) => void;
  onLayerGeometryCommit: (id: string, geometry: LayerGeometry) => void;
  onLayerGestureActiveChange: (active: boolean) => void;
  onLockedLayerAttempt?: (id: string) => void;
  temporaryLayerOverride?: TemporaryLayerOverride | null;
  overlayInsets?: Partial<CanvasOverlayInsets>;
  showFitButton?: boolean;
  interactionBlocked?: boolean;
  renderSelectionOverlay?: (anchor: LayerOverlayAnchor | null) => ReactNode;
}

const MIN_VIEWPORT_SCALE = 1;
const MAX_VIEWPORT_SCALE = 4;
const MIN_VISIBLE_ARTBOARD = 48;
const EMPTY_OVERLAY_INSETS: CanvasOverlayInsets = { top: 0, right: 0, bottom: 0, left: 0 };

function clampWorklet(value: number, minimum: number, maximum: number) {
  "worklet";
  return Math.min(Math.max(value, minimum), maximum);
}

function clampViewportWorklet(
  x: number,
  y: number,
  scale: number,
  stageWidth: number,
  stageHeight: number,
  artboardWidth: number,
  artboardHeight: number,
) {
  "worklet";
  const safeScale = clampWorklet(scale, MIN_VIEWPORT_SCALE, MAX_VIEWPORT_SCALE);
  if (safeScale <= MIN_VIEWPORT_SCALE + 0.0001) return { x: 0, y: 0, scale: MIN_VIEWPORT_SCALE };
  const limitX = Math.max(0, stageWidth / 2 + artboardWidth * safeScale / 2 - MIN_VISIBLE_ARTBOARD);
  const limitY = Math.max(0, stageHeight / 2 + artboardHeight * safeScale / 2 - MIN_VISIBLE_ARTBOARD);
  return {
    x: clampWorklet(x, -limitX, limitX),
    y: clampWorklet(y, -limitY, limitY),
    scale: safeScale,
  };
}

function fittedLayouts(
  stage: { width: number; height: number },
  overlayInsets: Partial<CanvasOverlayInsets>,
) {
  const usableLayout: UsableLayout = {
    x: overlayInsets.left ?? 0,
    y: overlayInsets.top ?? 0,
    width: Math.max(stage.width - (overlayInsets.left ?? 0) - (overlayInsets.right ?? 0), 1),
    height: Math.max(stage.height - (overlayInsets.top ?? 0) - (overlayInsets.bottom ?? 0), 1),
  };
  const height = Math.min(usableLayout.height * 0.94, usableLayout.width * 0.92 / (27 / 32));
  const width = height * 27 / 32;
  const artboardLayout: ArtboardLayout = {
    x: usableLayout.x + (usableLayout.width - width) / 2,
    y: usableLayout.y + (usableLayout.height - height) / 2,
    width,
    height,
  };
  return { usableLayout, artboardLayout };
}

export function MobileEditorCanvas({
  layers,
  configuration,
  selectedLayerId,
  onSelectLayer,
  viewport,
  onViewportChange,
  onLayerGeometryCommit,
  onLayerGestureActiveChange,
  onLockedLayerAttempt,
  temporaryLayerOverride,
  overlayInsets = EMPTY_OVERLAY_INSETS,
  showFitButton = true,
  interactionBlocked = false,
  renderSelectionOverlay,
}: MobileEditorCanvasProps) {
  const [stage, setStage] = useState({ width: 320, height: 420 });
  const { resolvedMode } = useThemeMode();
  const canvasPalette = resolvedMode === "light" ? LIGHT_CANVAS_PALETTE : DARK_CANVAS_PALETTE;
  const hasMeasuredStage = useRef(false);
  const measuredLayouts = useRef<ReturnType<typeof fittedLayouts> | null>(null);
  const viewportX = useSharedValue(viewport.x);
  const viewportY = useSharedValue(viewport.y);
  const viewportScale = useSharedValue(viewport.scale);
  const temporaryLayerTransform = useSharedValue<ActiveLayerTransform | null>(null);
  const panStart = useSharedValue({ x: viewport.x, y: viewport.y });
  const pinchStart = useSharedValue({ scale: viewport.scale, contentX: 0, contentY: 0 });
  const pinchActive = useSharedValue(false);

  const { artboardLayout, usableLayout } = useMemo(
    () => fittedLayouts(stage, overlayInsets),
    [overlayInsets.bottom, overlayInsets.left, overlayInsets.right, overlayInsets.top, stage],
  );
  const selectedLayer = useMemo(
    () => layers.find((layer) => layer.id === selectedLayerId) ?? null,
    [layers, selectedLayerId],
  );
  const selectionOverlayAnchor = useMemo<LayerOverlayAnchor | null>(() => {
    if (!selectedLayer) return null;
    const scale = Math.max(viewport.scale, MIN_VIEWPORT_SCALE);
    const scaledWidth = artboardLayout.width * scale;
    const scaledHeight = artboardLayout.height * scale;
    const artboardX = artboardLayout.x + viewport.x - (scaledWidth - artboardLayout.width) / 2;
    const artboardY = artboardLayout.y + viewport.y - (scaledHeight - artboardLayout.height) / 2;
    return {
      x: artboardX + selectedLayer.x / 100 * scaledWidth,
      y: artboardY + selectedLayer.y / 100 * scaledHeight,
      width: Math.max(selectedLayer.width / 100 * scaledWidth, 1),
      height: Math.max(selectedLayer.height / 100 * scaledHeight, 1),
      stageWidth: stage.width,
      stageHeight: stage.height,
    };
  }, [artboardLayout.height, artboardLayout.width, artboardLayout.x, artboardLayout.y, selectedLayer, stage.height, stage.width, viewport.scale, viewport.x, viewport.y]);

  useEffect(() => {
    viewportX.value = viewport.x;
    viewportY.value = viewport.y;
    viewportScale.value = viewport.scale;
  }, [viewport.scale, viewport.x, viewport.y, viewportScale, viewportX, viewportY]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    const alreadyMeasured = hasMeasuredStage.current;
    if (width > 0 && height > 0) {
      const previousLayouts = measuredLayouts.current;
      const nextLayouts = fittedLayouts({ width, height }, overlayInsets);
      const fittedLayoutChanged = !previousLayouts
        || Math.abs(previousLayouts.artboardLayout.x - nextLayouts.artboardLayout.x) > 0.5
        || Math.abs(previousLayouts.artboardLayout.y - nextLayouts.artboardLayout.y) > 0.5
        || Math.abs(previousLayouts.artboardLayout.width - nextLayouts.artboardLayout.width) > 0.5
        || Math.abs(previousLayouts.artboardLayout.height - nextLayouts.artboardLayout.height) > 0.5
        || Math.abs(previousLayouts.usableLayout.x - nextLayouts.usableLayout.x) > 0.5
        || Math.abs(previousLayouts.usableLayout.y - nextLayouts.usableLayout.y) > 0.5
        || Math.abs(previousLayouts.usableLayout.width - nextLayouts.usableLayout.width) > 0.5
        || Math.abs(previousLayouts.usableLayout.height - nextLayouts.usableLayout.height) > 0.5;
      hasMeasuredStage.current = true;
      measuredLayouts.current = nextLayouts;
      if (alreadyMeasured && previousLayouts && fittedLayoutChanged) {
        const scale = clampWorklet(viewportScale.value, MIN_VIEWPORT_SCALE, MAX_VIEWPORT_SCALE);
        let nextViewport = { x: 0, y: 0, scale: MIN_VIEWPORT_SCALE };
        if (scale > MIN_VIEWPORT_SCALE + 0.0001) {
          const focalX = 0.5 - viewportX.value / Math.max(previousLayouts.artboardLayout.width * scale, 0.0001);
          const focalY = 0.5 - viewportY.value / Math.max(previousLayouts.artboardLayout.height * scale, 0.0001);
          nextViewport = clampViewportWorklet(
            -(focalX - 0.5) * nextLayouts.artboardLayout.width * scale,
            -(focalY - 0.5) * nextLayouts.artboardLayout.height * scale,
            scale,
            nextLayouts.usableLayout.width,
            nextLayouts.usableLayout.height,
            nextLayouts.artboardLayout.width,
            nextLayouts.artboardLayout.height,
          );
        }
        temporaryLayerTransform.value = null;
        pinchActive.value = false;
        viewportX.value = nextViewport.x;
        viewportY.value = nextViewport.y;
        viewportScale.value = nextViewport.scale;
        onLayerGestureActiveChange(false);
        onViewportChange(nextViewport);
      }
      if (width !== stage.width || height !== stage.height) setStage({ width, height });
    }
  };

  const commitViewport = useCallback((next: EditorViewport) => {
    if (![next.x, next.y, next.scale].every(Number.isFinite)) return;
    onViewportChange(next);
  }, [onViewportChange]);

  const panGesture = useMemo(() => Gesture.Pan()
    .enabled(!interactionBlocked)
    .minPointers(2)
    .maxPointers(2)
    .averageTouches(true)
    .onStart(() => {
      panStart.value = { x: viewportX.value, y: viewportY.value };
    })
    .onUpdate((event) => {
      if (pinchActive.value) return;
      const next = clampViewportWorklet(
        panStart.value.x + event.translationX,
        panStart.value.y + event.translationY,
        viewportScale.value,
        usableLayout.width,
        usableLayout.height,
        artboardLayout.width,
        artboardLayout.height,
      );
      viewportX.value = next.x;
      viewportY.value = next.y;
    })
    .onFinalize(() => {
      runOnJS(commitViewport)({ x: viewportX.value, y: viewportY.value, scale: viewportScale.value });
    }), [
      artboardLayout.height, artboardLayout.width, commitViewport, interactionBlocked, panStart,
      pinchActive, usableLayout.height, usableLayout.width, viewportScale, viewportX, viewportY,
    ]);

  const pinchGesture = useMemo(() => Gesture.Pinch()
    .enabled(!interactionBlocked)
    .onStart((event) => {
      pinchActive.value = true;
      pinchStart.value = {
        scale: viewportScale.value,
        contentX: (event.focalX - usableLayout.x - usableLayout.width / 2 - viewportX.value) / viewportScale.value,
        contentY: (event.focalY - usableLayout.y - usableLayout.height / 2 - viewportY.value) / viewportScale.value,
      };
    })
    .onUpdate((event) => {
      const nextScale = clampWorklet(pinchStart.value.scale * event.scale, MIN_VIEWPORT_SCALE, MAX_VIEWPORT_SCALE);
      const next = clampViewportWorklet(
        event.focalX - usableLayout.x - usableLayout.width / 2 - pinchStart.value.contentX * nextScale,
        event.focalY - usableLayout.y - usableLayout.height / 2 - pinchStart.value.contentY * nextScale,
        nextScale,
        usableLayout.width,
        usableLayout.height,
        artboardLayout.width,
        artboardLayout.height,
      );
      viewportX.value = next.x;
      viewportY.value = next.y;
      viewportScale.value = next.scale;
    })
    .onFinalize(() => {
      pinchActive.value = false;
      runOnJS(commitViewport)({ x: viewportX.value, y: viewportY.value, scale: viewportScale.value });
    }), [
      artboardLayout.height, artboardLayout.width, commitViewport, interactionBlocked, pinchActive,
      pinchStart, usableLayout, viewportScale, viewportX, viewportY,
    ]);

  const viewportGesture = useMemo(
    () => Gesture.Simultaneous(pinchGesture, panGesture),
    [panGesture, pinchGesture],
  );

  const translationStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: viewportX.value }, { translateY: viewportY.value }],
  }));
  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: viewportScale.value }],
  }));

  const resetViewport = () => {
    viewportX.value = 0;
    viewportY.value = 0;
    viewportScale.value = 1;
    onViewportChange({ x: 0, y: 0, scale: 1 });
  };

  return (
    <View style={styles.stage} onLayout={onLayout}>
      <GestureDetector gesture={viewportGesture}>
        <Animated.View style={styles.viewportSurface}>
          <Animated.View
            style={[
              styles.viewportPosition,
              {
                left: artboardLayout.x,
                top: artboardLayout.y,
                width: artboardLayout.width,
                height: artboardLayout.height,
              },
              translationStyle,
            ]}
          >
            <Animated.View style={[styles.artboard, scaleStyle]}>
              <MobileFlyerRenderer
                layers={layers}
                configuration={configuration}
                mode="canvas"
                interactive
                interactionBlocked={interactionBlocked}
                selectedLayerId={selectedLayerId}
                onSelectLayer={onSelectLayer}
                viewportScale={viewportScale}
                temporaryLayerTransform={temporaryLayerTransform}
                temporaryLayerOverride={temporaryLayerOverride}
                onLayerGeometryCommit={onLayerGeometryCommit}
                onLayerGestureActiveChange={onLayerGestureActiveChange}
                onLockedLayerAttempt={onLockedLayerAttempt}
              />
            </Animated.View>
          </Animated.View>
        </Animated.View>
      </GestureDetector>
      {renderSelectionOverlay?.(selectionOverlayAnchor)}
      {showFitButton ? <Pressable
        accessibilityRole="button"
        accessibilityLabel="Fit canvas"
        disabled={interactionBlocked}
        onPress={resetViewport}
        style={({ pressed }) => [styles.fitButton, { borderColor: canvasPalette.border, backgroundColor: canvasPalette.surface }, pressed && styles.fitPressed]}
      >
        <Text style={[styles.fitText, { color: canvasPalette.text }]}>Fit</Text>
      </Pressable> : null}
    </View>
  );
}

const DARK_CANVAS_PALETTE = { surface: "rgba(16,34,30,0.92)", border: "#326052", text: "#dce8e5" };
const LIGHT_CANVAS_PALETTE = { surface: "rgba(255,255,255,0.94)", border: "#b8d8d0", text: "#18332d" };

const styles = StyleSheet.create({
  stage: { flex: 1, minHeight: 0, overflow: "hidden" },
  viewportSurface: { flex: 1 },
  viewportPosition: { position: "absolute", alignItems: "stretch" },
  artboard: {
    width: "100%",
    height: "100%",
    backgroundColor: "#ffffff",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  fitButton: {
    position: "absolute",
    right: 12,
    top: 12,
    minWidth: 44,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2000,
  },
  fitText: { fontSize: 10, fontWeight: "800" },
  fitPressed: { opacity: 0.65 },
});
