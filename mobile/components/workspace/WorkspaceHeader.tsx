import { Pressable, StyleSheet, Text, View } from "react-native";
import { ArrowLeft, CalendarDays } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEvent } from "@/context/EventContext";
import { useThemeMode } from "@/context/ThemeContext";

export function WorkspaceHeader({ onBack }: { onBack?: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activeEvent } = useEvent();
  const { resolvedMode } = useThemeMode();
  const light = resolvedMode === "light";
  const colors = light
    ? { background: "#ffffff", border: "#d5e2de", text: "#10211d", muted: "#657772" }
    : { background: "#081512", border: "#1e4037", text: "#f5f8f7", muted: "#89a099" };

  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: Math.max(insets.top, 10),
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <Pressable accessibilityLabel="Back to dashboard" style={styles.back} onPress={onBack ?? (() => router.replace("/(tabs)/dashboard"))}>
        <ArrowLeft color={colors.text} size={20} />
      </Pressable>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {activeEvent?.title ?? "Event workspace"}
        </Text>
        <View style={styles.meta}>
          <CalendarDays color={colors.muted} size={12} />
          <Text style={[styles.metaText, { color: colors.muted }]} numberOfLines={1}>
            {activeEvent?.event_date
              ? formatLocalEventDate(activeEvent.event_date)
              : "Date not set"}
          </Text>
        </View>
      </View>
      <View style={styles.liveBadge}>
        <View style={styles.liveDot} />
        <Text style={styles.liveText}>DRAFT</Text>
      </View>
    </View>
  );
}

function formatLocalEventDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString();
}

const styles = StyleSheet.create({
  header: {
    minHeight: 76,
    paddingHorizontal: 14,
    paddingBottom: 11,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  back: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, minWidth: 0, marginLeft: 3 },
  title: { fontSize: 16, fontWeight: "800" },
  meta: { marginTop: 3, flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { flexShrink: 1, fontSize: 10 },
  liveBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "#173a32",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#4fd6be" },
  liveText: { color: "#76e5d0", fontSize: 8, fontWeight: "800" },
});
