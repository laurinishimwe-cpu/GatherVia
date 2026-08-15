import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import type { CanvasOverlayInsets } from "@/components/editor/MobileEditorCanvas";
import { MobileTicketStubRenderer } from "@/components/editor/MobileTicketStubRenderer";
import type { EditorViewport, StubRegion } from "@/context/FlyerDraftContext";
import type { CanvasLayer } from "@/lib/types/canvas";
import type { EventRecord } from "@/lib/types/event";
import type { FlyerConfiguration } from "@/lib/types/flyer";

interface MobileStubEditorProps {
  layers: CanvasLayer[];
  configuration: FlyerConfiguration;
  temporaryConfigurationPatch?: Partial<FlyerConfiguration> | null;
  event: EventRecord | null;
  selectedRegion: StubRegion;
  onSelectRegion: (region: StubRegion) => void;
  viewport: EditorViewport;
  onViewportChange: (viewport: EditorViewport) => void;
  onRegionPositionCommit: (region: "guest" | "event-details" | "qr", patch: Partial<FlyerConfiguration>) => void;
  onGestureActiveChange: (active: boolean) => void;
  overlayInsets?: Partial<CanvasOverlayInsets>;
  showFitButton?: boolean;
  interactionBlocked?: boolean;
}

const EMPTY_INSETS: CanvasOverlayInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const MIN_SCALE = 1;
const MAX_SCALE = 4;

function clamp(value: number, minimum: number, maximum: number) {
  "worklet";
  return Math.min(Math.max(value, minimum), maximum);
}

function fittedInvitation(stage: { width: number; height: number }, insets: Partial<CanvasOverlayInsets>) {
  const usable = {
    x: insets.left ?? 0,
    y: insets.top ?? 0,
    width: Math.max(stage.width - (insets.left ?? 0) - (insets.right ?? 0), 1),
    height: Math.max(stage.height - (insets.top ?? 0) - (insets.bottom ?? 0), 1),
  };
  const width = Math.min(usable.width * 0.9, usable.height * 0.72);
  const height = width * 16 / 9;
  return {
    usable,
    invitation: {
      x: usable.x + (usable.width - width) / 2,
      y: usable.y + usable.height - height,
      width,
      height,
    },
  };
}

export function MobileStubEditor({
  layers,
  configuration,
  temporaryConfigurationPatch,
  event,
  selectedRegion,
  onSelectRegion,
  viewport,
  onViewportChange,
  onRegionPositionCommit,
  onGestureActiveChange,
  overlayInsets = EMPTY_INSETS,
  showFitButton = true,
  interactionBlocked = false,
}: MobileStubEditorProps) {
  const [stage, setStage] = useState({ width: 360, height: 560 });
  const fittedRef = useRef<ReturnType<typeof fittedInvitation> | null>(null);
  const x = useSharedValue(viewport.x);
  const y = useSharedValue(viewport.y);
  const scale = useSharedValue(viewport.scale);
  const panStart = useSharedValue({ x: viewport.x, y: viewport.y });
  const pinchStart = useSharedValue({ scale: viewport.scale, x: 0, y: 0 });
  const { usable, invitation } = useMemo(() => fittedInvitation(stage, overlayInsets), [overlayInsets.bottom, overlayInsets.left, overlayInsets.right, overlayInsets.top, stage]);

  useEffect(() => {
    x.value = viewport.x;
    y.value = viewport.y;
    scale.value = viewport.scale;
  }, [scale, viewport.scale, viewport.x, viewport.y, x, y]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width <= 0 || height <= 0 || (width === stage.width && height === stage.height)) return;
    const previous = fittedRef.current;
    const next = fittedInvitation({ width, height }, overlayInsets);
    fittedRef.current = next;
    if (previous) {
      const safeScale = clamp(scale.value, MIN_SCALE, MAX_SCALE);
      const focalX = 0.5 - x.value / Math.max(previous.invitation.width * safeScale, 0.0001);
      const focalY = 0.5 - y.value / Math.max(previous.invitation.height * safeScale, 0.0001);
      x.value = -(focalX - 0.5) * next.invitation.width * safeScale;
      y.value = -(focalY - 0.5) * next.invitation.height * safeScale;
      scale.value = safeScale;
      onViewportChange({ x: x.value, y: y.value, scale: safeScale });
      onGestureActiveChange(false);
    }
    setStage({ width, height });
  };

  const commitViewport = useCallback(() => {
    onViewportChange({ x: x.value, y: y.value, scale: scale.value });
  }, [onViewportChange, scale, x, y]);

  const pan = useMemo(() => Gesture.Pan()
    .enabled(!interactionBlocked)
    .minPointers(2)
    .maxPointers(2)
    .averageTouches(true)
    .onStart(() => { panStart.value = { x: x.value, y: y.value }; })
    .onUpdate((event) => {
      const limitX = invitation.width * scale.value;
      const limitY = invitation.height * scale.value;
      x.value = clamp(panStart.value.x + event.translationX, -limitX, limitX);
      y.value = clamp(panStart.value.y + event.translationY, -limitY, limitY);
    })
    .onFinalize(() => runOnJS(commitViewport)()), [commitViewport, interactionBlocked, invitation.height, invitation.width, panStart, scale, x, y]);

  const pinch = useMemo(() => Gesture.Pinch()
    .enabled(!interactionBlocked)
    .onStart((event) => {
      pinchStart.value = {
        scale: scale.value,
        x: (event.focalX - usable.x - usable.width / 2 - x.value) / scale.value,
        y: (event.focalY - usable.y - usable.height / 2 - y.value) / scale.value,
      };
    })
    .onUpdate((event) => {
      const nextScale = clamp(pinchStart.value.scale * event.scale, MIN_SCALE, MAX_SCALE);
      x.value = event.focalX - usable.x - usable.width / 2 - pinchStart.value.x * nextScale;
      y.value = event.focalY - usable.y - usable.height / 2 - pinchStart.value.y * nextScale;
      scale.value = nextScale;
    })
    .onFinalize(() => runOnJS(commitViewport)()), [commitViewport, interactionBlocked, pinchStart, scale, usable, x, y]);

  const gesture = useMemo(() => Gesture.Simultaneous(pan, pinch), [pan, pinch]);
  const translateStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value }] }));
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const resetViewport = () => {
    x.value = 0;
    y.value = 0;
    scale.value = 1;
    onViewportChange({ x: 0, y: 0, scale: 1 });
  };

  return (
    <View style={styles.stage} onLayout={onLayout}>
      <GestureDetector gesture={gesture}>
        <Animated.View style={styles.surface}>
          <Animated.View style={[styles.position, { left: invitation.x, top: invitation.y, width: invitation.width, height: invitation.height }, translateStyle]}>
            <Animated.View style={[styles.invitation, scaleStyle]}>
              <MobileTicketStubRenderer
                layers={layers}
                configuration={configuration}
                temporaryConfigurationPatch={temporaryConfigurationPatch}
                event={event}
                mode="edit"
                selectedRegion={selectedRegion}
                onSelectRegion={onSelectRegion}
                onRegionPositionCommit={onRegionPositionCommit}
                onGestureActiveChange={onGestureActiveChange}
                interactionBlocked={interactionBlocked}
              />
            </Animated.View>
          </Animated.View>
        </Animated.View>
      </GestureDetector>
      {showFitButton ? <Pressable accessibilityLabel="Fit ticket stub" disabled={interactionBlocked} onPress={resetViewport} style={({ pressed }) => [styles.fitButton, pressed && styles.pressed]}><Text style={styles.fitText}>Fit Stub</Text></Pressable> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, minHeight: 0, overflow: "hidden" },
  surface: { flex: 1 },
  position: { position: "absolute" },
  invitation: { width: "100%", height: "100%", backgroundColor: "#ffffff", shadowColor: "#000", shadowOpacity: 0.32, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 10 },
  fitButton: { position: "absolute", right: 12, top: 12, minWidth: 68, height: 32, paddingHorizontal: 10, borderRadius: 16, borderWidth: 1, borderColor: "#326052", backgroundColor: "rgba(16,34,30,0.92)", alignItems: "center", justifyContent: "center", zIndex: 2000 },
  fitText: { color: "#dce8e5", fontSize: 10, fontWeight: "800" },
  pressed: { opacity: 0.65 },
});
