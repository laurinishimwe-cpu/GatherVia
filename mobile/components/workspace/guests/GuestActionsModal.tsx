import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Copy, Trash2, X } from "lucide-react-native";
import { useThemeMode } from "@/context/ThemeContext";
import type { GuestOwnerView } from "@/lib/types/guest";

export function GuestActionsModal({ guest, onClose, onCopyQr, onDelete }: {
  guest: GuestOwnerView | null;
  onClose: () => void;
  onCopyQr: () => void;
  onDelete: () => void;
}) {
  const { resolvedMode } = useThemeMode();
  const light = resolvedMode === "light";
  const colors = light
    ? { card: "#ffffff", soft: "#f4f7f6", border: "#d5e2de", text: "#10211d", muted: "#657772" }
    : { card: "#0b1815", soft: "#10221e", border: "#285046", text: "#f5f8f7", muted: "#89a099" };
  return (
    <Modal visible={Boolean(guest)} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.header}><View><Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{guest?.full_name}</Text><Text style={[styles.hint, { color: colors.muted }]}>Guest actions</Text></View><Pressable onPress={onClose} style={[styles.close, { borderColor: colors.border }]}><X color={colors.muted} size={16} /></Pressable></View>
          <Pressable onPress={onCopyQr} style={[styles.action, { backgroundColor: colors.soft, borderColor: colors.border }]}><Copy color="#4fd6be" size={18} /><View><Text style={[styles.actionTitle, { color: colors.text }]}>Copy QR scan code</Text><Text style={[styles.actionHint, { color: colors.muted }]}>Copy this guest&apos;s hashed scanner value</Text></View></Pressable>
          <Pressable onPress={onDelete} style={[styles.action, { backgroundColor: colors.soft, borderColor: "#6b3033" }]}><Trash2 color="#e66d72" size={18} /><View><Text style={[styles.actionTitle, { color: "#e66d72" }]}>Delete guest</Text><Text style={[styles.actionHint, { color: colors.muted }]}>Remove the guest and activity history</Text></View></Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, padding: 16, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.58)" },
  sheet: { width: "100%", maxWidth: 430, alignSelf: "center", padding: 14, borderRadius: 8, borderWidth: 1, gap: 8 },
  header: { minHeight: 44, marginBottom: 2, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { maxWidth: 280, fontSize: 14, fontWeight: "800" },
  hint: { marginTop: 2, fontSize: 9 },
  close: { width: 31, height: 31, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  action: { minHeight: 62, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 11 },
  actionTitle: { fontSize: 11, fontWeight: "800" },
  actionHint: { marginTop: 3, fontSize: 8 },
});
