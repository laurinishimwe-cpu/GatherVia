import { Pressable, StyleSheet, Text, View } from "react-native";
import { ArrowLeft, Mail, ShieldCheck, UserRound } from "lucide-react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useThemeMode } from "@/context/ThemeContext";

export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { resolvedMode } = useThemeMode();
  const light = resolvedMode === "light";
  const colors = light
    ? { background: "#f4f7f6", panel: "#ffffff", border: "#d5e2de", text: "#10211d", muted: "#657772" }
    : { background: "#07110f", panel: "#10221e", border: "#203e37", text: "#f5f8f7", muted: "#78918b" };

  return (
    <SafeAreaView style={[styles.page, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Go back" style={styles.back} onPress={() => router.back()}>
          <ArrowLeft color={colors.text} size={20} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
      </View>

      <View style={styles.hero}>
        <View style={styles.avatar}>
          <UserRound color="#07110f" size={30} strokeWidth={2.1} />
        </View>
        <Text style={[styles.name, { color: colors.text }]}>{user?.full_name ?? "GatherVia Host"}</Text>
        <Text style={styles.tier}>{(user?.tier ?? "free").toUpperCase()} ACCOUNT</Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.panel, borderColor: colors.border }]}>
        <View style={styles.row}>
          <Mail color="#4fd6be" size={18} />
          <View style={styles.rowCopy}>
            <Text style={[styles.label, { color: colors.muted }]}>Email</Text>
            <Text style={[styles.value, { color: colors.text }]} numberOfLines={1}>{user?.email}</Text>
          </View>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.row}>
          <ShieldCheck color="#4fd6be" size={18} />
          <View style={styles.rowCopy}>
            <Text style={[styles.label, { color: colors.muted }]}>Sign-in method</Text>
            <Text style={[styles.value, { color: colors.text }]}>{user?.auth_provider ?? "manual"}</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingHorizontal: 20, backgroundColor: "#07110f" },
  header: { height: 58, flexDirection: "row", alignItems: "center" },
  back: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#24483f",
  },
  headerTitle: { marginLeft: 13, color: "#f5f8f7", fontSize: 18, fontWeight: "800" },
  hero: { alignItems: "center", paddingVertical: 28 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4fd6be",
  },
  name: { marginTop: 13, color: "#f5f8f7", fontSize: 20, fontWeight: "800" },
  tier: { marginTop: 5, color: "#4fd6be", fontSize: 10, fontWeight: "800", letterSpacing: 0 },
  card: {
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#203e37",
    backgroundColor: "#10221e",
  },
  row: { minHeight: 70, flexDirection: "row", alignItems: "center" },
  rowCopy: { flex: 1, marginLeft: 13 },
  label: { color: "#78918b", fontSize: 11 },
  value: { marginTop: 4, color: "#e8eeec", fontSize: 14, fontWeight: "600", textTransform: "capitalize" },
  divider: { height: 1, backgroundColor: "#1e3933" },
});
