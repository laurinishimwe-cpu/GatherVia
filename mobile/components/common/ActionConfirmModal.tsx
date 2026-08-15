import { useEffect, useRef } from "react";
import { ActivityIndicator, Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { AlertTriangle, X } from "lucide-react-native";
import { useThemeMode } from "@/context/ThemeContext";

interface ActionConfirmModalProps {
  visible: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  loading?: boolean;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}

export function ActionConfirmModal({
  visible,
  title,
  description,
  confirmLabel = "Confirm",
  loading = false,
  destructive = false,
  onCancel,
  onConfirm,
}: ActionConfirmModalProps) {
  const entrance = useRef(new Animated.Value(0)).current;
  const { resolvedMode } = useThemeMode();
  const light = resolvedMode === "light";
  const colors = light
    ? { card: "#ffffff", panel: "#f4f7f6", border: "#d5e2de", text: "#10211d", muted: "#657772" }
    : { card: "#0b1815", panel: "#10221e", border: "#285046", text: "#f5f8f7", muted: "#89a099" };
  const actionColor = destructive ? "#df6666" : "#4fd6be";

  useEffect(() => {
    if (!visible) return;
    entrance.setValue(0);
    Animated.timing(entrance, {
      toValue: 1,
      duration: 115,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [entrance, visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={loading ? undefined : onCancel} />
        <Animated.View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
            {
              opacity: entrance,
              transform: [
                { translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
                { scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) },
              ],
            },
          ]}
        >
          <View style={styles.header}>
            <View style={[styles.icon, { backgroundColor: destructive ? "#3a2020" : "#173a32" }]}>
              <AlertTriangle color={actionColor} size={20} />
            </View>
            <Pressable accessibilityLabel="Close confirmation" style={[styles.close, { borderColor: colors.border }]} onPress={onCancel} disabled={loading}>
              <X color={colors.muted} size={17} />
            </Pressable>
          </View>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.description, { color: colors.muted }]}>{description}</Text>
          <View style={styles.actions}>
            <Pressable style={[styles.cancel, { backgroundColor: colors.panel, borderColor: colors.border }]} onPress={onCancel} disabled={loading}>
              <Text style={[styles.cancelText, { color: colors.text }]}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.confirm, { backgroundColor: actionColor }]} onPress={onConfirm} disabled={loading}>
              {loading ? <ActivityIndicator color={destructive ? "#ffffff" : "#07110f"} size="small" /> : <Text style={[styles.confirmText, { color: destructive ? "#ffffff" : "#07110f" }]}>{confirmLabel}</Text>}
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, padding: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0, 0, 0, 0.64)" },
  card: { width: "100%", maxWidth: 390, padding: 17, borderRadius: 8, borderWidth: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  close: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  title: { marginTop: 16, fontSize: 17, fontWeight: "800" },
  description: { marginTop: 7, fontSize: 11, lineHeight: 17 },
  actions: { marginTop: 20, flexDirection: "row", gap: 9 },
  cancel: { flex: 1, minHeight: 43, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  cancelText: { fontSize: 11, fontWeight: "700" },
  confirm: { flex: 1, minHeight: 43, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  confirmText: { fontSize: 11, fontWeight: "800" },
});
