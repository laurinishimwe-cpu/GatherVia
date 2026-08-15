import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { ShieldCheck, X } from "lucide-react-native";
import { useThemeMode } from "@/context/ThemeContext";

export function AddAdminModal({ visible, loading, onClose, onSubmit }: { visible: boolean; loading: boolean; onClose: () => void; onSubmit: (name: string) => void }) {
  const [name, setName] = useState("");
  const entrance = useRef(new Animated.Value(0)).current;
  const { resolvedMode } = useThemeMode();
  const light = resolvedMode === "light";
  const colors = light ? { card: "#ffffff", input: "#f7fbfa", border: "#d5e2de", text: "#10211d", muted: "#657772" } : { card: "#0b1815", input: "#081512", border: "#285046", text: "#f5f8f7", muted: "#89a099" };
  useEffect(() => {
    if (!visible) return;
    setName("");
    entrance.setValue(0);
    Animated.timing(entrance, { toValue: 1, duration: 130, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [entrance, visible]);
  return <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}><View style={styles.overlay}><Pressable style={StyleSheet.absoluteFill} onPress={loading ? undefined : onClose} /><Animated.View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}><View style={styles.header}><View style={styles.titleRow}><View style={styles.icon}><ShieldCheck color="#4fd6be" size={18} /></View><View><Text style={[styles.title, { color: colors.text }]}>Add admin</Text><Text style={[styles.subtitle, { color: colors.muted }]}>Create personal scanner access</Text></View></View><Pressable onPress={onClose} style={[styles.close, { borderColor: colors.border }]}><X color={colors.muted} size={16} /></Pressable></View><Text style={[styles.label, { color: colors.text }]}>Admin name</Text><TextInput autoFocus autoCapitalize="words" maxLength={60} value={name} onChangeText={setName} placeholder="Doorman or admin name" placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]} /><Pressable disabled={!name.trim() || loading} onPress={() => onSubmit(name.trim())} style={[styles.submit, (!name.trim() || loading) && styles.disabled]}>{loading ? <ActivityIndicator color="#07110f" size="small" /> : <ShieldCheck color="#07110f" size={17} />}<Text style={styles.submitText}>{loading ? "Creating..." : "Create admin"}</Text></Pressable></Animated.View></View></Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, padding: 16, justifyContent: "center", backgroundColor: "rgba(0,0,0,0.68)" }, card: { width: "100%", maxWidth: 430, alignSelf: "center", padding: 16, borderRadius: 8, borderWidth: 1 }, header: { marginBottom: 15, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, titleRow: { flexDirection: "row", alignItems: "center", gap: 9 }, icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#173a32", alignItems: "center", justifyContent: "center" }, title: { fontSize: 16, fontWeight: "800" }, subtitle: { marginTop: 2, fontSize: 9 }, close: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" }, label: { marginBottom: 6, fontSize: 10, fontWeight: "700" }, input: { height: 44, paddingHorizontal: 12, borderRadius: 7, borderWidth: 1, fontSize: 12 }, submit: { minHeight: 44, marginTop: 14, borderRadius: 22, backgroundColor: "#4fd6be", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 }, submitText: { color: "#07110f", fontSize: 11, fontWeight: "800" }, disabled: { opacity: 0.45 },
});
