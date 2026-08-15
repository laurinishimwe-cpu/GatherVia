import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { Plus, Tags, X } from "lucide-react-native";
import { useThemeMode } from "@/context/ThemeContext";

interface CategoryEditorModalProps {
  visible: boolean;
  enabled: boolean;
  categories: string[];
  onClose: () => void;
  onApply: (enabled: boolean, categories: string[]) => void;
}

export function CategoryEditorModal({ visible, enabled, categories, onClose, onApply }: CategoryEditorModalProps) {
  const entrance = useRef(new Animated.Value(0)).current;
  const [localEnabled, setLocalEnabled] = useState(enabled);
  const [localCategories, setLocalCategories] = useState(categories);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const { resolvedMode } = useThemeMode();
  const light = resolvedMode === "light";
  const colors = light
    ? { card: "#ffffff", panel: "#f4f7f6", border: "#d5e2de", text: "#10211d", muted: "#657772", input: "#f7fbfa" }
    : { card: "#0b1815", panel: "#10221e", border: "#285046", text: "#f5f8f7", muted: "#89a099", input: "#081512" };

  useEffect(() => {
    if (!visible) return;
    setLocalEnabled(enabled);
    setLocalCategories(categories.length ? categories : ["General", "VIP"]);
    setInput("");
    setError("");
    entrance.setValue(0);
    Animated.timing(entrance, {
      toValue: 1,
      duration: 120,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [categories, enabled, entrance, visible]);

  const add = () => {
    const value = input.trim();
    if (!value) return;
    if (value.length > 10) {
      setError("Labels can contain at most 10 characters.");
      return;
    }
    if (localCategories.some((category) => category.toLowerCase() === value.toLowerCase())) {
      setError("That category already exists.");
      return;
    }
    setLocalCategories((current) => [...current, value]);
    setInput("");
    setError("");
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
            {
              opacity: entrance,
              transform: [
                { translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
                { scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) },
              ],
            },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.titleRow}><View style={styles.icon}><Tags color="#4fd6be" size={18} /></View><View><Text style={[styles.title, { color: colors.text }]}>Pass categories</Text><Text style={[styles.subtitle, { color: colors.muted }]}>Short labels used when sharing passes</Text></View></View>
            <Pressable accessibilityLabel="Close categories" style={[styles.close, { borderColor: colors.border }]} onPress={onClose}><X color={colors.muted} size={17} /></Pressable>
          </View>

          <View style={[styles.toggleRow, { backgroundColor: colors.panel, borderColor: colors.border }]}>
            <View style={styles.toggleCopy}><Text style={[styles.toggleTitle, { color: colors.text }]}>Enable categories</Text><Text style={[styles.toggleHint, { color: colors.muted }]}>Turn off to hide category choices from passes.</Text></View>
            <Switch value={localEnabled} onValueChange={setLocalEnabled} trackColor={{ false: "#4a5653", true: "#2a8c78" }} thumbColor={localEnabled ? "#4fd6be" : "#d6dcda"} />
          </View>

          {localEnabled ? (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                {localCategories.map((category) => (
                  <View key={category} style={[styles.chip, { backgroundColor: colors.panel, borderColor: colors.border }]}>
                    <Text style={[styles.chipText, { color: colors.text }]}>{category}</Text>
                    <Pressable accessibilityLabel={`Remove ${category}`} hitSlop={7} onPress={() => setLocalCategories((current) => current.filter((item) => item !== category))}><X color="#df6666" size={13} /></Pressable>
                  </View>
                ))}
              </ScrollView>
              <View style={styles.addRow}>
                <TextInput
                  value={input}
                  onChangeText={(value) => { setInput(value.slice(0, 10)); setError(""); }}
                  onSubmitEditing={add}
                  maxLength={10}
                  placeholder="Custom label"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                />
                <Pressable accessibilityLabel="Add category" style={[styles.addButton, !input.trim() && styles.disabled]} disabled={!input.trim()} onPress={add}><Plus color="#07110f" size={19} /></Pressable>
              </View>
              <View style={styles.helperRow}><Text style={[styles.helper, { color: error ? "#df6666" : colors.muted }]}>{error || "Maximum 10 characters per label."}</Text><Text style={[styles.counter, { color: colors.muted }]}>{input.length}/10</Text></View>
            </>
          ) : null}

          <Pressable style={styles.applyButton} onPress={() => onApply(localEnabled, localCategories)}><Text style={styles.applyText}>Apply categories</Text></Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, padding: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0, 0, 0, 0.66)" },
  card: { width: "100%", maxWidth: 430, padding: 16, borderRadius: 8, borderWidth: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  titleRow: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 9 },
  icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#173a32", alignItems: "center", justifyContent: "center" },
  title: { fontSize: 16, fontWeight: "800" },
  subtitle: { marginTop: 2, fontSize: 8 },
  close: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  toggleRow: { minHeight: 70, marginTop: 15, padding: 11, borderRadius: 8, borderWidth: 1, flexDirection: "row", alignItems: "center" },
  toggleCopy: { flex: 1, paddingRight: 10 },
  toggleTitle: { fontSize: 12, fontWeight: "700" },
  toggleHint: { marginTop: 3, fontSize: 9, lineHeight: 13 },
  chips: { gap: 7, paddingVertical: 14 },
  chip: { minHeight: 32, paddingHorizontal: 10, borderRadius: 16, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  chipText: { fontSize: 10, fontWeight: "700" },
  addRow: { flexDirection: "row", gap: 8 },
  input: { flex: 1, height: 43, paddingHorizontal: 12, borderRadius: 7, borderWidth: 1, fontSize: 12 },
  addButton: { width: 43, height: 43, borderRadius: 22, backgroundColor: "#4fd6be", alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.45 },
  helperRow: { minHeight: 25, paddingTop: 5, flexDirection: "row", justifyContent: "space-between" },
  helper: { flex: 1, fontSize: 8 },
  counter: { marginLeft: 8, fontSize: 8 },
  applyButton: { minHeight: 43, marginTop: 10, borderRadius: 22, backgroundColor: "#4fd6be", alignItems: "center", justifyContent: "center" },
  applyText: { color: "#07110f", fontSize: 11, fontWeight: "800" },
});
