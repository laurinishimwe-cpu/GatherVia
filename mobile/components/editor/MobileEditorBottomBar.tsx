import { ScrollView, Pressable, StyleSheet, Text, View } from "react-native";
import {
  AlignCenter,
  ArrowDown,
  ArrowUp,
  Edit3,
  Eye,
  ImagePlus,
  Inspect,
  LockOpen,
  MoreHorizontal,
  Palette,
  Redo2,
  Scaling,
  Shapes,
  SlidersHorizontal,
  Type,
  Undo2,
  Ticket,
  UserRound,
  CalendarRange,
  QrCode,
} from "lucide-react-native";
import type { CanvasLayer } from "@/lib/types/canvas";
import type { EditorMode, StubRegion } from "@/context/FlyerDraftContext";
import { useThemeMode } from "@/context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type MobileEditorAction =
  | "text" | "shape" | "undo" | "redo" | "preview"
  | "edit" | "colour" | "size" | "align" | "replace"
  | "forward" | "backward" | "stroke" | "stroke-width" | "opacity"
  | "shape-properties" | "corners" | "unlock" | "inspect" | "more"
  | "stub-background" | "stub-text" | "stub-accent" | "stub-shadow"
  | "stub-name" | "stub-font" | "stub-name-size" | "stub-position" | "stub-category"
  | "stub-visibility" | "stub-icon" | "stub-frame" | "stub-qr-size" | "stub-more";

interface MobileEditorBottomBarProps {
  selectedLayer: CanvasLayer | null;
  onAction: (action: MobileEditorAction) => void;
  canUndo?: boolean;
  canRedo?: boolean;
  replacingImage?: boolean;
  mutationDisabled?: boolean;
  landscape?: boolean;
  editorMode: EditorMode;
  selectedStubRegion: StubRegion;
  onModeChange: (mode: EditorMode) => void;
}

const ACTION_META = {
  text: { label: "Text", Icon: Type },
  shape: { label: "Shape", Icon: Shapes },
  undo: { label: "Undo", Icon: Undo2 },
  redo: { label: "Redo", Icon: Redo2 },
  preview: { label: "Preview", Icon: Eye },
  edit: { label: "Edit", Icon: Edit3 },
  colour: { label: "Colour", Icon: Palette },
  size: { label: "Size", Icon: Scaling },
  align: { label: "Align", Icon: AlignCenter },
  replace: { label: "Replace", Icon: ImagePlus },
  forward: { label: "Forward", Icon: ArrowUp },
  backward: { label: "Backward", Icon: ArrowDown },
  stroke: { label: "Stroke", Icon: Palette },
  "stroke-width": { label: "Width", Icon: SlidersHorizontal },
  "shape-properties": { label: "Shape", Icon: Shapes },
  corners: { label: "Corners", Icon: Scaling },
  opacity: { label: "Opacity", Icon: SlidersHorizontal },
  unlock: { label: "Unlock", Icon: LockOpen },
  inspect: { label: "Inspect", Icon: Inspect },
  more: { label: "More", Icon: MoreHorizontal },
  "stub-background": { label: "Background", Icon: Palette },
  "stub-text": { label: "Text", Icon: Type },
  "stub-accent": { label: "Accent", Icon: Palette },
  "stub-shadow": { label: "Shadow", Icon: SlidersHorizontal },
  "stub-name": { label: "Name", Icon: UserRound },
  "stub-font": { label: "Font", Icon: Type },
  "stub-name-size": { label: "Size", Icon: Scaling },
  "stub-position": { label: "Position", Icon: Scaling },
  "stub-category": { label: "Category", Icon: Inspect },
  "stub-visibility": { label: "Details", Icon: CalendarRange },
  "stub-icon": { label: "Icons", Icon: Palette },
  "stub-frame": { label: "Frame", Icon: Palette },
  "stub-qr-size": { label: "Size", Icon: QrCode },
  "stub-more": { label: "More", Icon: MoreHorizontal },
} satisfies Record<MobileEditorAction, { label: string; Icon: typeof Type }>;

function actionsForStub(region: StubRegion): MobileEditorAction[] {
  if (region === "background") return ["stub-background", "stub-text", "stub-accent", "stub-shadow", "preview"];
  if (region === "guest") return ["stub-name", "stub-font", "stub-name-size", "stub-position", "stub-category"];
  if (region === "event-details") return ["stub-visibility", "stub-icon", "stub-position", "preview", "stub-more"];
  return ["stub-frame", "stub-qr-size", "stub-position", "preview", "stub-more"];
}

function actionsForLayer(layer: CanvasLayer | null): MobileEditorAction[] {
  if (!layer) return ["text", "shape", "undo", "redo", "preview"];
  if (layer.locked) return ["unlock", "inspect", "more"];
  if (layer.type === "text") return ["edit", "colour", "size", "align", "more"];
  if (layer.type === "image") return ["replace", "corners", "opacity", "forward", "more"];
  if (layer.type === "rect" || layer.type === "ellipse") return ["colour", "stroke", "shape-properties", "corners", "more"];
  if (layer.type === "polygon" || (layer.type === "path" && layer.closed)) return ["colour", "stroke", "opacity", "forward", "more"];
  if (layer.type === "path") return ["stroke", "stroke-width", "opacity", "forward", "more"];
  if (layer.type === "qr") return ["size", "forward", "backward", "more"];
  return ["opacity", "forward", "backward", "inspect", "more"];
}

export function MobileEditorBottomBar({
  selectedLayer,
  onAction,
  canUndo = false,
  canRedo = false,
  replacingImage = false,
  mutationDisabled = false,
  landscape = false,
  editorMode,
  selectedStubRegion,
  onModeChange,
}: MobileEditorBottomBarProps) {
  const insets = useSafeAreaInsets();
  const { resolvedMode } = useThemeMode();
  const palette = resolvedMode === "light" ? LIGHT_PALETTE : DARK_PALETTE;
  const actions = editorMode === "stub" ? actionsForStub(selectedStubRegion) : actionsForLayer(selectedLayer);
  return (
    <View
      onStartShouldSetResponder={() => true}
      style={[
        styles.bar,
        { borderTopColor: palette.border, backgroundColor: palette.bar },
        landscape && styles.landscapeBar,
        landscape && { borderColor: palette.border, backgroundColor: palette.floatingBar },
        landscape && {
          left: Math.max(insets.left, 8),
          right: Math.max(insets.right, 8),
          bottom: Math.max(insets.bottom, 7),
        },
      ]}
    >
      <View style={[styles.modeRow, { borderBottomColor: palette.border }]}>
        <Pressable accessibilityRole="tab" accessibilityState={{ selected: editorMode === "design" }} disabled={mutationDisabled} onPress={() => onModeChange("design")} style={[styles.modeButton, editorMode === "design" && styles.modeButtonSelected, mutationDisabled && styles.disabled]}>
          <Shapes color={editorMode === "design" ? "#07110f" : palette.icon} size={15} />
          <Text style={[styles.modeText, { color: palette.text }, editorMode === "design" && styles.modeTextSelected]}>Design</Text>
        </Pressable>
        <Pressable accessibilityRole="tab" accessibilityState={{ selected: editorMode === "stub" }} disabled={mutationDisabled} onPress={() => onModeChange("stub")} style={[styles.modeButton, editorMode === "stub" && styles.modeButtonSelected, mutationDisabled && styles.disabled]}>
          <Ticket color={editorMode === "stub" ? "#07110f" : palette.icon} size={15} />
          <Text style={[styles.modeText, { color: palette.text }, editorMode === "stub" && styles.modeTextSelected]}>Ticket Stub</Text>
        </Pressable>
        <View style={styles.historyButtons}>
          <Pressable accessibilityLabel="Undo" disabled={mutationDisabled || !canUndo} onPress={() => onAction("undo")} style={[styles.historyButton, (mutationDisabled || !canUndo) && styles.disabled]}><Undo2 color={palette.icon} size={17} /></Pressable>
          <Pressable accessibilityLabel="Redo" disabled={mutationDisabled || !canRedo} onPress={() => onAction("redo")} style={[styles.historyButton, (mutationDisabled || !canRedo) && styles.disabled]}><Redo2 color={palette.icon} size={17} /></Pressable>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.content, landscape && styles.landscapeContent]}>
        {actions.map((action) => {
          const { label, Icon } = ACTION_META[action];
          const disabled = mutationDisabled || (action === "undo" && !canUndo) || (action === "redo" && !canRedo) || (action === "replace" && replacingImage);
          return (
            <Pressable
              key={action}
              accessibilityRole="button"
              accessibilityLabel={label}
              disabled={disabled}
              onPress={() => onAction(action)}
              style={({ pressed }) => [styles.action, landscape && styles.landscapeAction, pressed && styles.pressed, disabled && styles.disabled]}
            >
              <Icon color={action === "replace" ? "#208d7b" : palette.icon} size={19} />
              <Text style={[styles.label, { color: palette.text }, action === "replace" && styles.highlight]}>
                {replacingImage && action === "replace" ? "Uploading…" : label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const DARK_PALETTE = {
  bar: "#10221e",
  floatingBar: "rgba(8,21,18,0.96)",
  border: "#24483f",
  text: "#dce8e5",
  icon: "#dce8e5",
};

const LIGHT_PALETTE = {
  bar: "#ffffff",
  floatingBar: "rgba(255,255,255,0.97)",
  border: "#cfe0dc",
  text: "#18332d",
  icon: "#18332d",
};

const styles = StyleSheet.create({
  bar: { height: 108, borderTopWidth: 1 },
  landscapeBar: { position: "absolute", height: 102, borderWidth: 1, borderRadius: 18, zIndex: 3000, elevation: 12, overflow: "hidden" },
  modeRow: { height: 43, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, borderBottomWidth: 1 },
  modeButton: { minHeight: 34, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 10, borderRadius: 10 },
  modeButtonSelected: { backgroundColor: "#4fd6be" },
  modeText: { fontSize: 10, fontWeight: "800" },
  modeTextSelected: { color: "#07110f" },
  historyButtons: { marginLeft: "auto", flexDirection: "row", gap: 2 },
  historyButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 9 },
  content: { minWidth: "100%", height: 64, paddingHorizontal: 8, alignItems: "center", justifyContent: "space-around" },
  landscapeContent: { justifyContent: "center", gap: 2 },
  action: { minWidth: 58, minHeight: 44, paddingHorizontal: 7, alignItems: "center", justifyContent: "center" },
  landscapeAction: { minWidth: 54, paddingHorizontal: 5 },
  label: { marginTop: 3, fontSize: 9, fontWeight: "700" },
  highlight: { color: "#208d7b" },
  pressed: { opacity: 0.65 },
  disabled: { opacity: 0.35 },
});
