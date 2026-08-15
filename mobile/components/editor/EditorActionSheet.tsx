import { useEffect, useMemo, type ReactNode } from "react";
import {
  BackHandler,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Maximize2, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeMode } from "@/context/ThemeContext";

interface EditorActionSheetProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  keyboardAware?: boolean;
  landscape?: boolean;
  onFit?: () => void;
}

export function EditorActionSheet({
  visible,
  title,
  onClose,
  children,
  keyboardAware = false,
  landscape = false,
  onFit,
}: EditorActionSheetProps) {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const { resolvedMode } = useThemeMode();
  const palette = resolvedMode === "light" ? LIGHT_PALETTE : DARK_PALETTE;
  const sideWidth = Math.min(Math.max(window.width * 0.38, 280), 440);
  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dy > 72 || gesture.vy > 1.1) onClose();
    },
  }), [onClose]);

  useEffect(() => {
    if (!visible) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [onClose, visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        enabled={keyboardAware}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[styles.overlay, landscape && styles.sideOverlay]}
      >
        <Pressable accessibilityLabel="Close sheet" style={styles.backdrop} onPress={onClose} />
        <View style={[
          styles.sheet,
          { backgroundColor: palette.surface, borderColor: palette.border },
          landscape && styles.sideSheet,
          landscape
            ? { width: sideWidth, paddingTop: Math.max(insets.top, 8), paddingBottom: Math.max(insets.bottom, 14) }
            : { paddingBottom: Math.max(insets.bottom, 14) },
        ]}>
          {!landscape ? <View style={styles.dragArea} {...panResponder.panHandlers}>
            <View style={[styles.dragHandle, { backgroundColor: palette.handle }]} />
          </View> : null}
          <View style={[styles.heading, { borderBottomColor: palette.border }]}>
            <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
            {landscape && onFit ? (
              <Pressable accessibilityLabel="Fit canvas" onPress={onFit} style={styles.fit}>
                <Maximize2 color="#208d7b" size={16} />
                <Text style={[styles.fitText, { color: "#208d7b" }]}>Fit</Text>
              </Pressable>
            ) : null}
            <Pressable accessibilityLabel="Close" onPress={onClose} style={styles.close}>
              <X color={palette.icon} size={20} />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.content,
              landscape && { paddingRight: Math.max(insets.right, 0) + 18 },
            ]}
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const DARK_PALETTE = {
  surface: "#10221e",
  border: "#285046",
  handle: "#55746c",
  text: "#f5f8f7",
  icon: "#dce8e5",
};

const LIGHT_PALETTE = {
  surface: "#ffffff",
  border: "#cfe0dc",
  handle: "#93aaa4",
  text: "#10211d",
  icon: "#18332d",
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  sideOverlay: { alignItems: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.42)" },
  sheet: { maxHeight: "58%", minHeight: 220, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1 },
  sideSheet: { height: "100%", maxHeight: "100%", borderTopRightRadius: 0, borderBottomLeftRadius: 22 },
  dragArea: { height: 28, alignItems: "center", justifyContent: "center" },
  dragHandle: { width: 42, height: 4, borderRadius: 2 },
  heading: { minHeight: 46, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", borderBottomWidth: 1 },
  title: { flex: 1, fontSize: 16, fontWeight: "800" },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  fit: { minWidth: 54, height: 44, paddingHorizontal: 8, flexDirection: "row", gap: 5, alignItems: "center", justifyContent: "center" },
  fitText: { fontSize: 10, fontWeight: "800" },
  content: { padding: 18, paddingBottom: 28 },
});
