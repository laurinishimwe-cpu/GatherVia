import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import {
  ChevronRight,
  FileText,
  Globe2,
  LogOut,
  MonitorCog,
  Moon,
  Sun,
  UserRound,
} from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useThemeMode, type ThemeMode } from "@/context/ThemeContext";

const themeOptions: Array<{
  value: ThemeMode;
  label: string;
  Icon: typeof MonitorCog;
}> = [
  { value: "system", label: "System", Icon: MonitorCog },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "light", label: "Light", Icon: Sun },
];

const PRIVACY_URL =
  process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL ?? "https://gathervia.app/privacy";

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { mode, resolvedMode, setMode } = useThemeMode();
  const light = resolvedMode === "light";
  const colors = light
    ? {
        background: "#f4f7f6",
        panel: "#ffffff",
        border: "#dbe5e2",
        text: "#10211d",
        muted: "#657772",
      }
    : {
        background: "#07110f",
        panel: "#10221e",
        border: "#203e37",
        text: "#f5f8f7",
        muted: "#78918b",
      };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>Personalise GatherVia on this device.</Text>

        <Text style={[styles.sectionLabel, { color: colors.muted }]}>APPEARANCE</Text>
        <View style={[styles.card, { backgroundColor: colors.panel, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Theme</Text>
          <View style={[styles.segmented, { backgroundColor: colors.background }]}>
            {themeOptions.map(({ value, label, Icon }) => {
              const selected = mode === value;
              return (
                <Pressable
                  key={value}
                  style={[styles.segment, selected && styles.segmentSelected]}
                  onPress={() => setMode(value)}
                >
                  <Icon color={selected ? "#07110f" : colors.muted} size={16} />
                  <Text style={[styles.segmentText, { color: selected ? "#07110f" : colors.muted }]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.muted }]}>ACCOUNT</Text>
        <View style={[styles.card, { backgroundColor: colors.panel, borderColor: colors.border }]}>
          <View style={styles.accountHeader}>
            <View style={styles.avatar}>
              <UserRound color="#07110f" size={20} strokeWidth={2.3} />
            </View>
            <View style={styles.accountCopy}>
              <Text style={[styles.accountName, { color: colors.text }]} numberOfLines={1}>{user?.full_name}</Text>
              <Text style={[styles.accountEmail, { color: colors.muted }]} numberOfLines={1}>{user?.email}</Text>
            </View>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Pressable style={styles.row} onPress={() => router.push("/(tabs)/language")}>
            <Globe2 color="#4fd6be" size={19} />
            <View style={styles.rowCopy}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>Language</Text>
              <Text style={[styles.rowHint, { color: colors.muted }]}>Current: {(user?.preferred_language ?? "en").toUpperCase()}</Text>
            </View>
            <ChevronRight color={colors.muted} size={19} />
          </Pressable>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.muted }]}>ABOUT</Text>
        <View style={[styles.card, { backgroundColor: colors.panel, borderColor: colors.border }]}>
          <Pressable style={styles.row} onPress={() => Linking.openURL(PRIVACY_URL)}>
            <FileText color="#4fd6be" size={19} />
            <Text style={[styles.rowTitle, styles.rowCopy, { color: colors.text }]}>Privacy policy</Text>
            <ChevronRight color={colors.muted} size={19} />
          </Pressable>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.row}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>Version</Text>
            <Text style={[styles.version, { color: colors.muted }]}>{Constants.expoConfig?.version ?? "1.0.0"}</Text>
          </View>
        </View>

        <Pressable
          style={[styles.logout, { borderColor: colors.border }]}
          onPress={async () => {
            await signOut();
            router.replace("/(auth)/login");
          }}
        >
          <LogOut color="#e46f6f" size={18} />
          <Text style={styles.logoutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: 20, paddingBottom: 38 },
  title: { fontSize: 24, fontWeight: "800" },
  subtitle: { marginTop: 5, fontSize: 13 },
  sectionLabel: { marginTop: 28, marginBottom: 9, fontSize: 10, fontWeight: "800", letterSpacing: 0 },
  card: { paddingHorizontal: 14, borderRadius: 8, borderWidth: 1 },
  cardTitle: { marginTop: 15, marginBottom: 10, fontSize: 13, fontWeight: "700" },
  segmented: { padding: 4, marginBottom: 14, borderRadius: 7, flexDirection: "row" },
  segment: { flex: 1, minHeight: 38, borderRadius: 6, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  segmentSelected: { backgroundColor: "#4fd6be" },
  segmentText: { fontSize: 11, fontWeight: "700" },
  accountHeader: { minHeight: 76, flexDirection: "row", alignItems: "center" },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#4fd6be", alignItems: "center", justifyContent: "center" },
  accountCopy: { flex: 1, marginLeft: 12 },
  accountName: { fontSize: 14, fontWeight: "700" },
  accountEmail: { marginTop: 3, fontSize: 11 },
  divider: { height: 1 },
  row: { minHeight: 58, flexDirection: "row", alignItems: "center" },
  rowCopy: { flex: 1, marginLeft: 11 },
  rowTitle: { fontSize: 13, fontWeight: "600" },
  rowHint: { marginTop: 3, fontSize: 10 },
  version: { marginLeft: "auto", fontSize: 12 },
  logout: { minHeight: 48, marginTop: 22, borderRadius: 24, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  logoutText: { color: "#e46f6f", fontSize: 13, fontWeight: "700" },
});
