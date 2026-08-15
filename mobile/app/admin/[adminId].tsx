import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, Clock3, ShieldAlert, ShieldCheck } from "lucide-react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEvent } from "@/context/EventContext";
import { useThemeMode } from "@/context/ThemeContext";
import { fetchAdminShareLinks } from "@/lib/api/communications";
import type { AdminActivityEntry, AdminShareLinkResponse } from "@/lib/types/communications";

function getLogKind(log: AdminActivityEntry): "in" | "out" | "denied" | "duplicate" {
  const value = `${log.action} ${log.status} ${log.outcome} ${log.reason ?? ""}`.toLowerCase();
  if (value.includes("duplicate")) return "duplicate";
  if (log.outcome.toLowerCase() === "denied") return "denied";
  if (value.includes("scan_out") || value.includes("left") || value.includes("checked out")) return "out";
  return "in";
}

function formatCreatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function AdminActivityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ adminId: string; eventId: string }>();
  const { activeEvent } = useEvent();
  const { resolvedMode } = useThemeMode();
  const light = resolvedMode === "light";
  const colors = light
    ? { background: "#f4f7f6", panel: "#ffffff", border: "#bad3cc", text: "#10211d", muted: "#657772", soft: "#edf4f2" }
    : { background: "#07110f", panel: "#10221e", border: "#32685b", text: "#f5f8f7", muted: "#89a099", soft: "#0b1916" };
  const [admin, setAdmin] = useState<AdminShareLinkResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (refresh = false) => {
    if (!params.eventId) return;
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const links = await fetchAdminShareLinks(params.eventId);
      setAdmin(links.find((link) => link.id === params.adminId) ?? null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load admin activity.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [params.adminId, params.eventId]);

  useEffect(() => { void load(); }, [load]);
  const logs = useMemo(
    () => [...(admin?.activity.logs ?? [])].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)),
    [admin?.activity.logs],
  );
  const eventTitle = activeEvent?.id === params.eventId ? activeEvent.title : "Event";

  if (loading) return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color="#4fd6be" /></View>;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { backgroundColor: colors.panel, borderBottomColor: colors.border }]}>
        <Pressable accessibilityLabel="Back to admins" onPress={() => router.back()} style={styles.back}><ArrowLeft color={colors.text} size={20} /></Pressable>
        <View style={styles.headerCopy}><Text style={[styles.headerTitle, { color: colors.text }]}>Admin activity</Text><Text style={[styles.headerHint, { color: colors.muted }]} numberOfLines={1}>{eventTitle}</Text></View>
      </View>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#4fd6be" />} contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 18) + 20 }]}>
        {error || !admin ? <View style={[styles.empty, { backgroundColor: colors.panel, borderColor: colors.border }]}><ShieldAlert color="#e66d72" size={22} /><Text style={styles.error}>{error || "Admin access no longer exists."}</Text></View> : <>
          <View style={[styles.profile, { backgroundColor: colors.panel, borderColor: colors.border }]}>
            <View style={styles.profileTop}>
              <View style={styles.avatar}><ShieldCheck color="#4fd6be" size={21} /></View>
              <View style={styles.profileCopy}><Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{admin.link_label}</Text><Text style={[styles.meta, { color: colors.muted }]}>{eventTitle} · Added {formatCreatedAt(admin.created_at)}</Text></View>
              <View style={[styles.statusBadge, { backgroundColor: admin.enabled ? "#173a32" : "#472423" }]}><Text style={[styles.statusText, { color: admin.enabled ? "#4fd6be" : "#f09a95" }]}>{admin.enabled ? "ENABLED" : "DISABLED"}</Text></View>
            </View>
            <View style={styles.statsGrid}>
              <Stat label="SCANNED IN" value={admin.activity.scanned_in} color="#4fd6be" colors={colors} />
              <Stat label="SCANNED OUT" value={admin.activity.scanned_out} color="#63bce7" colors={colors} />
              <Stat label="DENIED" value={admin.activity.denied} color="#e66d72" colors={colors} />
              <Stat label="DUPLICATES" value={admin.activity.duplicate_denied} color="#e3c655" colors={colors} />
            </View>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>Activity log</Text>
          {logs.length === 0 ? <View style={[styles.empty, { backgroundColor: colors.panel, borderColor: colors.border }]}><Clock3 color={colors.muted} size={22} /><Text style={[styles.emptyText, { color: colors.muted }]}>No scanner activity yet.</Text></View> : logs.map((log, index) => <ActivityRow key={`${log.timestamp}-${log.guest_id}-${index}`} log={log} colors={colors} />)}
        </>}
      </ScrollView>
    </View>
  );
}

function Stat({ label, value, color, colors }: { label: string; value: number; color: string; colors: { soft: string; border: string; muted: string } }) {
  return <View style={[styles.stat, { backgroundColor: colors.soft, borderColor: colors.border }]}><Text style={[styles.statLabel, { color: colors.muted }]}>{label}</Text><Text style={[styles.statValue, { color }]}>{value}</Text></View>;
}

function ActivityRow({ log, colors }: { log: AdminActivityEntry; colors: { panel: string; border: string; text: string; muted: string } }) {
  const kind = getLogKind(log);
  const denied = kind === "denied" || kind === "duplicate";
  const outbound = kind === "out";
  const Icon = denied ? ShieldAlert : outbound ? ArrowUpRight : ArrowDownLeft;
  const accent = kind === "duplicate" ? "#e3c655" : denied ? "#e66d72" : outbound ? "#63bce7" : "#4fd6be";
  const title = kind === "duplicate" ? "Duplicate denied" : kind === "denied" ? "Access denied" : outbound ? "Guest scanned out" : "Guest scanned in";
  const timestamp = new Date(log.timestamp);
  return <View style={[styles.log, { backgroundColor: colors.panel, borderColor: denied ? accent : colors.border }]}>
    <View style={[styles.logIcon, { backgroundColor: `${accent}20` }]}><Icon color={accent} size={16} /></View>
    <View style={styles.logCopy}><View style={styles.logTitleRow}><Text style={[styles.logTitle, { color: colors.text }]} numberOfLines={1}>{title}</Text><Text style={[styles.category, { color: colors.muted }]} numberOfLines={1}>{log.guest_category}</Text></View><Text style={[styles.guestName, { color: colors.text }]} numberOfLines={1}>{log.guest_name}</Text><Text style={[styles.logMeta, { color: colors.muted }]} numberOfLines={1}>{log.lookup_method || "QR"} · {log.door_id || "Scanner"}</Text>{log.reason ? <Text style={[styles.reason, { color: accent }]}>{log.reason}</Text> : null}</View>
    <View style={styles.timeCopy}><Text style={[styles.time, { color: colors.text }]}>{Number.isNaN(timestamp.getTime()) ? "--:--" : timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text><Text style={[styles.day, { color: colors.muted }]}>{Number.isNaN(timestamp.getTime()) ? "" : timestamp.toLocaleDateString([], { day: "numeric", month: "short" })}</Text></View>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { minHeight: 62, paddingHorizontal: 12, borderBottomWidth: 1, flexDirection: "row", alignItems: "center" }, back: { width: 40, height: 40, alignItems: "center", justifyContent: "center" }, headerCopy: { marginLeft: 5 }, headerTitle: { fontSize: 15, fontWeight: "800" }, headerHint: { maxWidth: 260, marginTop: 2, fontSize: 9 },
  content: { padding: 16 }, profile: { borderRadius: 9, borderWidth: 1.5, padding: 14 }, profileTop: { flexDirection: "row", alignItems: "center" }, avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#173a32", alignItems: "center", justifyContent: "center" }, profileCopy: { flex: 1, minWidth: 0, marginLeft: 10 }, name: { fontSize: 16, fontWeight: "800" }, meta: { marginTop: 4, fontSize: 8 }, statusBadge: { marginLeft: 8, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 12 }, statusText: { fontSize: 7, fontWeight: "800" },
  statsGrid: { marginTop: 14, flexDirection: "row", flexWrap: "wrap", gap: 8 }, stat: { width: "48.5%", minHeight: 66, padding: 10, borderRadius: 7, borderWidth: 1 }, statLabel: { fontSize: 7, fontWeight: "800" }, statValue: { marginTop: 8, fontSize: 19, fontWeight: "800" }, sectionTitle: { marginTop: 20, marginBottom: 10, fontSize: 15, fontWeight: "800" },
  log: { minHeight: 82, marginBottom: 8, padding: 10, borderRadius: 8, borderWidth: 1, flexDirection: "row", alignItems: "flex-start" }, logIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" }, logCopy: { flex: 1, minWidth: 0, marginLeft: 9 }, logTitleRow: { flexDirection: "row", alignItems: "center" }, logTitle: { flex: 1, fontSize: 10, fontWeight: "800" }, category: { maxWidth: 72, marginLeft: 6, fontSize: 7, textTransform: "uppercase" }, guestName: { marginTop: 5, fontSize: 10, fontWeight: "700" }, logMeta: { marginTop: 3, fontSize: 7, textTransform: "capitalize" }, reason: { marginTop: 4, fontSize: 7 }, timeCopy: { marginLeft: 7, alignItems: "flex-end" }, time: { fontSize: 8, fontWeight: "800" }, day: { marginTop: 3, fontSize: 7 },
  empty: { padding: 24, borderRadius: 8, borderWidth: 1, alignItems: "center" }, emptyText: { marginTop: 7, fontSize: 10 }, error: { marginTop: 7, color: "#e66d72", fontSize: 10, textAlign: "center" },
});
