import { CopyPlus, ImagePlus, MoreHorizontal, Trash2 } from "lucide-react-native";
import { type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { LayerOverlayAnchor } from "@/components/editor/MobileEditorCanvas";
import type { CanvasLayer } from "@/lib/types/canvas";

interface SelectedLayerBubbleProps {
  layer: CanvasLayer;
  disabled?: boolean;
  replacingImage?: boolean;
  anchor: LayerOverlayAnchor;
  light?: boolean;
  onDuplicate: () => void;
  onDelete: () => void;
  onReplace: () => void;
  onMore: () => void;
}

export function SelectedLayerBubble({
  layer,
  disabled = false,
  replacingImage = false,
  anchor,
  light = false,
  onDuplicate,
  onDelete,
  onReplace,
  onMore,
}: SelectedLayerBubbleProps) {
  if (layer.locked) return null;
  const actionCount = layer.type === "image" ? 4 : 3;
  const position = resolveBubblePosition(anchor, actionCount);
  const palette = light ? LIGHT_PALETTE : DARK_PALETTE;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.position, { left: position.left, top: position.top }]}
    >
      <View style={[styles.bubble, { borderColor: palette.border, backgroundColor: palette.surface, shadowColor: palette.shadow }]}>
        {layer.type === "image" ? (
          <BubbleAction
            label={replacingImage ? "Replacing image" : "Replace image"}
            disabled={disabled || replacingImage}
            onPress={onReplace}
          >
            <ImagePlus color="#208d7b" size={20} />
          </BubbleAction>
        ) : null}
        <BubbleAction label="Duplicate layer" disabled={disabled} onPress={onDuplicate}>
          <CopyPlus color={palette.icon} size={20} />
        </BubbleAction>
        <BubbleAction label="Delete layer" disabled={disabled} onPress={onDelete} danger>
          <Trash2 color="#d95962" size={20} />
        </BubbleAction>
        <BubbleAction label="More layer actions" disabled={disabled} onPress={onMore}>
          <MoreHorizontal color={palette.icon} size={21} />
        </BubbleAction>
      </View>
    </View>
  );
}

function BubbleAction({
  label,
  disabled,
  danger = false,
  onPress,
  children,
}: {
  label: string;
  disabled: boolean;
  danger?: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        danger && styles.danger,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {children}
    </Pressable>
  );
}

function resolveBubblePosition(anchor: LayerOverlayAnchor, actionCount: number) {
  const bubbleWidth = actionCount * 44 + (actionCount - 1) * 8 + 16;
  const bubbleHeight = 50;
  const gap = 12;
  const edge = 8;
  const centeredY = clamp(anchor.y + anchor.height / 2 - bubbleHeight / 2, edge, anchor.stageHeight - bubbleHeight - edge);
  const right = anchor.x + anchor.width + gap;
  if (right + bubbleWidth <= anchor.stageWidth - edge) return { left: right, top: centeredY };

  const left = anchor.x - bubbleWidth - gap;
  if (left >= edge) return { left, top: centeredY };

  const centeredX = clamp(anchor.x + anchor.width / 2 - bubbleWidth / 2, edge, anchor.stageWidth - bubbleWidth - edge);
  const above = anchor.y - bubbleHeight - gap;
  if (above >= edge) return { left: centeredX, top: above };
  return {
    left: centeredX,
    top: clamp(anchor.y + anchor.height + gap, edge, anchor.stageHeight - bubbleHeight - edge),
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(value, Math.max(minimum, maximum)));
}

const DARK_PALETTE = {
  surface: "rgba(16,34,30,0.98)",
  border: "#326052",
  icon: "#e8f3f0",
  shadow: "#000000",
};

const LIGHT_PALETTE = {
  surface: "rgba(255,255,255,0.98)",
  border: "#b8d8d0",
  icon: "#18332d",
  shadow: "#527169",
};

const styles = StyleSheet.create({
  position: {
    position: "absolute",
    zIndex: 2601,
    elevation: 18,
  },
  bubble: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
    borderRadius: 24,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
  },
  action: {
    width: 44,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
  },
  danger: { borderLeftWidth: 1, borderLeftColor: "#d98d92", paddingLeft: 3 },
  pressed: { opacity: 0.64 },
  disabled: { opacity: 0.42 },
});
