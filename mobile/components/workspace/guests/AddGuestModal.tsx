import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { UserPlus, X } from "lucide-react-native";
import { useThemeMode } from "@/context/ThemeContext";

interface AddGuestModalProps {
  visible: boolean;
  loading: boolean;
  onClose: () => void;
  onSubmit: (guest: { fullName: string; email: string; phone: string }) => void;
}

export function AddGuestModal({ visible, loading, onClose, onSubmit }: AddGuestModalProps) {
  const entrance = useRef(new Animated.Value(0)).current;
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const { resolvedMode } = useThemeMode();
  const light = resolvedMode === "light";
  const colors = light
    ? { card: "#ffffff", input: "#f7fbfa", border: "#d5e2de", text: "#10211d", muted: "#657772" }
    : { card: "#0b1815", input: "#081512", border: "#285046", text: "#f5f8f7", muted: "#89a099" };

  useEffect(() => {
    if (!visible) return;
    setFullName("");
    setEmail("");
    setPhone("");
    entrance.setValue(0);
    Animated.timing(entrance, { toValue: 1, duration: 130, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [entrance, visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={loading ? undefined : onClose} />
        <Animated.View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>
          <View style={styles.header}>
            <View style={styles.titleRow}><View style={styles.icon}><UserPlus color="#4fd6be" size={18} /></View><View><Text style={[styles.title, { color: colors.text }]}>Add guest</Text><Text style={[styles.subtitle, { color: colors.muted }]}>Create an approved guest pass</Text></View></View>
            <Pressable accessibilityLabel="Close" onPress={onClose} style={[styles.close, { borderColor: colors.border }]}><X color={colors.muted} size={17} /></Pressable>
          </View>
          <Text style={[styles.label, { color: colors.text }]}>Full name</Text>
          <TextInput autoCapitalize="words" autoFocus value={fullName} onChangeText={setFullName} placeholder="Guest name" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.input }]} />
          <Text style={[styles.label, { color: colors.text }]}>Email <Text style={{ color: colors.muted }}>(optional)</Text></Text>
          <TextInput autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="guest@example.com" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.input }]} />
          <Text style={[styles.label, { color: colors.text }]}>Phone <Text style={{ color: colors.muted }}>(optional)</Text></Text>
          <TextInput keyboardType="phone-pad" value={phone} onChangeText={setPhone} placeholder="Phone number" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.input }]} />
          <Pressable disabled={!fullName.trim() || loading} onPress={() => onSubmit({ fullName: fullName.trim(), email: email.trim(), phone: phone.trim() })} style={[styles.submit, (!fullName.trim() || loading) && styles.disabled]}>
            {loading ? <ActivityIndicator color="#07110f" size="small" /> : <UserPlus color="#07110f" size={17} />}
            <Text style={styles.submitText}>{loading ? "Adding..." : "Add guest"}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, padding: 16, justifyContent: "center", backgroundColor: "rgba(0,0,0,0.68)" },
  card: { width: "100%", maxWidth: 430, alignSelf: "center", padding: 16, borderRadius: 8, borderWidth: 1 },
  header: { marginBottom: 15, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#173a32", alignItems: "center", justifyContent: "center" },
  title: { fontSize: 16, fontWeight: "800" },
  subtitle: { marginTop: 2, fontSize: 9 },
  close: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  label: { marginBottom: 6, fontSize: 10, fontWeight: "700" },
  input: { height: 44, marginBottom: 12, paddingHorizontal: 12, borderRadius: 7, borderWidth: 1, fontSize: 12 },
  submit: { minHeight: 44, marginTop: 4, borderRadius: 22, backgroundColor: "#4fd6be", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  submitText: { color: "#07110f", fontSize: 11, fontWeight: "800" },
  disabled: { opacity: 0.45 },
});
