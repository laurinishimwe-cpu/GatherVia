import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, Clock3, ShieldAlert } from "lucide-react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeMode } from "@/context/ThemeContext";
import { fetchEventGuests } from "@/lib/api/guests";
import type { GuestActivityLog, GuestOwnerView } from "@/lib/types/guest";

function isIn(log: GuestActivityLog) {
  const value = `${log.action ?? ""} ${log.status}`.toLowerCase();
  return value.includes("scan_in") || value.includes("checked in") || value.includes("returned") || value.includes("arrival");
}
function isOut(log: GuestActivityLog) {
  const value = `${log.action ?? ""} ${log.status}`.toLowerCase();
  return value.includes("scan_out") || value.includes("checked out") || value.includes("left");
}
function isDuplicate(log: GuestActivityLog) {
  return `${log.action ?? ""} ${log.status} ${log.outcome ?? ""}`.toLowerCase().includes("duplicate");
}
function isLegacyRsvpMovement(log: GuestActivityLog) {
  return log.door_id === "auto_rsvp" || log.lookup_method === "rsvp";
}
function formatDuration(milliseconds: number) {
  const minutes = Math.max(0, Math.floor(milliseconds / 60000));
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}
function getPresence(guest: GuestOwnerView) {
  if (guest.status === "pending") return "Pending";
  if (guest.status === "rejected") return "Rejected";
  const movement = [...guest.check_in_logs].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)).find((log) => !isLegacyRsvpMovement(log) && (isIn(log) || isOut(log)));
  if (!movement) return "Pending arrival";
  return isOut(movement) ? "Currently out" : "Currently inside";
}
function calculateStats(logs: GuestActivityLog[]) {
  const ordered = [...logs].filter((log) => !isLegacyRsvpMovement(log) && (isIn(log) || isOut(log))).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  let insideStarted: number | null = null;
  let inside = 0;
  let outside = 0;
  let outsideStarted: number | null = null;
  for (const log of ordered) {
    const time = Date.parse(log.timestamp);
    if (isIn(log)) {
      if (outsideStarted !== null) outside += Math.max(0, time - outsideStarted);
      outsideStarted = null;
      if (insideStarted === null) insideStarted = time;
    } else if (isOut(log)) {
      if (insideStarted !== null) inside += Math.max(0, time - insideStarted);
      insideStarted = null;
      outsideStarted = time;
    }
  }
  if (insideStarted !== null) inside += Date.now() - insideStarted;
  if (outsideStarted !== null) outside += Date.now() - outsideStarted;
  return { inside: formatDuration(inside), outside: formatDuration(outside) };
}

export default function GuestActivityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ guestId: string; eventId: string }>();
  const { resolvedMode } = useThemeMode();
  const light = resolvedMode === "light";
  const colors = light
    ? { background: "#f4f7f6", panel: "#ffffff", border: "#d5e2de", text: "#10211d", muted: "#657772", soft: "#edf4f2" }
    : { background: "#07110f", panel: "#10221e", border: "#24483f", text: "#f5f8f7", muted: "#89a099", soft: "#0b1916" };
  const [guest, setGuest] = useState<GuestOwnerView | null>(null);
  const [eventTitle, setEventTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (refresh = false) => {
    if (!params.eventId) return;
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const data = await fetchEventGuests(params.eventId);
      setEventTitle(data.event_title);
      setGuest(data.guests.find((item) => item.id === params.guestId) ?? null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load guest activity.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [params.eventId, params.guestId]);

  useEffect(() => { void load(); }, [load]);
  const logs = useMemo(() => [...(guest?.check_in_logs ?? [])].filter((log) => !isLegacyRsvpMovement(log)).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)), [guest?.check_in_logs]);
  const stats = useMemo(() => calculateStats(guest?.check_in_logs ?? []), [guest?.check_in_logs]);

  if (loading) return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color="#4fd6be" /></View>;
  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { backgroundColor: colors.panel, borderBottomColor: colors.border }]}><Pressable onPress={() => router.back()} style={styles.back}><ArrowLeft color={colors.text} size={20} /></Pressable><View style={styles.headerCopy}><Text style={[styles.headerTitle, { color: colors.text }]}>Guest activity</Text><Text style={[styles.headerHint, { color: colors.muted }]} numberOfLines={1}>{eventTitle}</Text></View></View>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#4fd6be" />} contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 18) + 20 }]}>
        {error || !guest ? <View style={[styles.empty, { backgroundColor: colors.panel, borderColor: colors.border }]}><Text style={styles.error}>{error || "Guest no longer exists."}</Text></View> : <>
          <View style={[styles.profile, { backgroundColor: colors.panel, borderColor: colors.border }]}>
            <View style={styles.profileTop}><View style={styles.avatar}><Text style={styles.avatarText}>{guest.full_name.charAt(0).toUpperCase()}</Text></View><View style={styles.profileCopy}><Text style={[styles.name, { color: colors.text }]}>{guest.full_name}</Text><Text style={[styles.meta, { color: colors.muted }]}>{guest.category} · {eventTitle}</Text></View><View style={[styles.presence, { backgroundColor: getPresence(guest).includes("inside") ? "#173a32" : colors.soft }]}><Text style={[styles.presenceText, { color: getPresence(guest).includes("inside") ? "#4fd6be" : colors.muted }]}>{getPresence(guest)}</Text></View></View>
            <View style={styles.stats}><Stat label="TIME INSIDE" value={stats.inside} colors={colors} /><Stat label="TIME OUTSIDE" value={stats.outside} colors={colors} /></View>
          </View>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Activity log</Text>
          {logs.length === 0 ? <View style={[styles.empty, { backgroundColor: colors.panel, borderColor: colors.border }]}><Clock3 color={colors.muted} size={22} /><Text style={[styles.emptyText, { color: colors.muted }]}>No scans recorded yet.</Text></View> : logs.map((log, index) => {
            const duplicate = isDuplicate(log);
            const outbound = isOut(log);
            const Icon = duplicate ? ShieldAlert : outbound ? ArrowUpRight : ArrowDownLeft;
            return <View key={`${log.timestamp}-${index}`} style={[styles.log, { backgroundColor: colors.panel, borderColor: duplicate ? "#6b3033" : colors.border }]}><View style={[styles.logIcon, { backgroundColor: duplicate ? "#3d2022" : "#173a32" }]}><Icon color={duplicate ? "#e66d72" : "#4fd6be"} size={16} /></View><View style={styles.logCopy}><Text style={[styles.logTitle, { color: colors.text }]}>{duplicate ? "Duplicate attempt" : outbound ? "Left event" : "Entered event"}</Text><Text style={[styles.logMeta, { color: colors.muted }]}>{log.door_id || "Scanner"} · {log.lookup_method || "QR"}</Text></View><Text style={[styles.time, { color: colors.muted }]}>{new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text></View>;
          })}
        </>}
      </ScrollView>
    </View>
  );
}

function Stat({ label, value, colors }: { label: string; value: string; colors: { soft: string; border: string; text: string; muted: string } }) {
  return <View style={[styles.stat, { backgroundColor: colors.soft, borderColor: colors.border }]}><Text style={[styles.statLabel, { color: colors.muted }]}>{label}</Text><Text style={[styles.statValue, { color: colors.text }]}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { minHeight: 62, paddingHorizontal: 12, borderBottomWidth: 1, flexDirection: "row", alignItems: "center" }, back: { width: 40, height: 40, alignItems: "center", justifyContent: "center" }, headerCopy: { marginLeft: 5 }, headerTitle: { fontSize: 15, fontWeight: "800" }, headerHint: { maxWidth: 260, marginTop: 2, fontSize: 9 },
  content: { padding: 16 }, profile: { padding: 14, borderRadius: 8, borderWidth: 1 }, profileTop: { flexDirection: "row", alignItems: "center" }, avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#173a32", alignItems: "center", justifyContent: "center" }, avatarText: { color: "#4fd6be", fontSize: 17, fontWeight: "800" }, profileCopy: { flex: 1, minWidth: 0, marginLeft: 10 }, name: { fontSize: 16, fontWeight: "800" }, meta: { marginTop: 3, fontSize: 9 }, presence: { maxWidth: 90, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 13 }, presenceText: { fontSize: 7, fontWeight: "800", textTransform: "uppercase" }, stats: { marginTop: 14, flexDirection: "row", gap: 8 }, stat: { flex: 1, minHeight: 68, padding: 10, borderRadius: 7, borderWidth: 1 }, statLabel: { fontSize: 7, fontWeight: "800" }, statValue: { marginTop: 8, fontSize: 15, fontWeight: "800" }, sectionTitle: { marginTop: 20, marginBottom: 10, fontSize: 15, fontWeight: "800" }, log: { minHeight: 66, marginBottom: 8, padding: 10, borderRadius: 8, borderWidth: 1, flexDirection: "row", alignItems: "center" }, logIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" }, logCopy: { flex: 1, minWidth: 0, marginLeft: 9 }, logTitle: { fontSize: 11, fontWeight: "800" }, logMeta: { marginTop: 3, fontSize: 8, textTransform: "capitalize" }, time: { marginLeft: 7, fontSize: 8, fontWeight: "700" }, empty: { padding: 24, borderRadius: 8, borderWidth: 1, alignItems: "center" }, emptyText: { marginTop: 7, fontSize: 10 }, error: { color: "#e66d72", fontSize: 11, textAlign: "center" },
});
