import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Share as NativeShare, StyleSheet, Text, TextInput, View } from "react-native";
import { Check, Copy, Link2, Plus, RefreshCw, Search, Share2, X } from "lucide-react-native";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useEvent } from "@/context/EventContext";
import { useThemeMode } from "@/context/ThemeContext";
import { useToast } from "@/context/ToastContext";
import { createEventGuest, deleteGuest, fetchEventGuests, updateGuestStatus } from "@/lib/api/guests";
import { fetchEventPublicLinks } from "@/lib/api/communications";
import { ActionConfirmModal } from "@/components/common/ActionConfirmModal";
import { AddGuestModal } from "@/components/workspace/guests/AddGuestModal";
import { GuestActionsModal } from "@/components/workspace/guests/GuestActionsModal";
import { GuestPassModal } from "@/components/workspace/guests/GuestPassModal";
import type { GuestListResponse, GuestOwnerView } from "@/lib/types/guest";

const DEFAULT_INVITATION_CATEGORIES = ["General", "VIP"];

type Presence = "pending" | "approved" | "inside" | "outside" | "rejected";
function getPresence(guest: GuestOwnerView): Presence {
  if (guest.status === "rejected") return "rejected";
  if (guest.status === "pending") return "pending";
  const movement = [...guest.check_in_logs]
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .find((log) => {
      if (log.door_id === "auto_rsvp" || log.lookup_method === "rsvp") return false;
      const value = `${log.action ?? ""} ${log.status}`.toLowerCase();
      return value.includes("scan_in") || value.includes("scan_out") || value.includes("checked in") || value.includes("checked out") || value.includes("returned") || value.includes("left");
    });
  if (!movement) return "approved";
  const value = `${movement.action ?? ""} ${movement.status}`.toLowerCase();
  return value.includes("scan_out") || value.includes("checked out") || value.includes("left") ? "outside" : "inside";
}

export default function GuestsScreen() {
  const router = useRouter();
  const { activeEvent } = useEvent();
  const { resolvedMode } = useThemeMode();
  const { showToast } = useToast();
  const light = resolvedMode === "light";
  const colors = light
    ? { background: "#f4f7f6", panel: "#ffffff", border: "#d5e2de", strongBorder: "#bad3cc", text: "#10211d", muted: "#657772", soft: "#edf4f2" }
    : { background: "#07110f", panel: "#10221e", border: "#24483f", strongBorder: "#32685b", text: "#f5f8f7", muted: "#89a099", soft: "#0b1916" };
  const [data, setData] = useState<GuestListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [actionsGuest, setActionsGuest] = useState<GuestOwnerView | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GuestOwnerView | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [passGuest, setPassGuest] = useState<GuestOwnerView | null>(null);
  const [error, setError] = useState("");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const longPressedRef = useRef(false);

  const load = useCallback(async (refresh = false) => {
    if (!activeEvent) return;
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const [nextData, publicLinks] = await Promise.all([
        fetchEventGuests(activeEvent.id, { force: refresh }),
        fetchEventPublicLinks(activeEvent.id).catch(() => null),
      ]);
      setData(nextData);
      setInviteLink(publicLinks?.invite_url ?? null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load guests.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeEvent]);

  useEffect(() => { void load(); }, [load]);
  const guests = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return data?.guests ?? [];
    return (data?.guests ?? []).filter((guest) => [guest.full_name, guest.email, guest.phone, guest.category, guest.status].some((value) => value?.toLowerCase().includes(normalized)));
  }, [data?.guests, query]);
  const presenceSummary = useMemo(() => {
    const allGuests = data?.guests ?? [];
    return {
      pending: allGuests.filter((guest) => guest.status === "pending").length,
      approved: allGuests.filter((guest) => guest.status === "checked_in").length,
      inside: allGuests.filter((guest) => getPresence(guest) === "inside").length,
    };
  }, [data?.guests]);

  const updateStatus = async (guestId: string, status: "checked_in" | "rejected") => {
    setUpdatingId(guestId);
    try {
      await updateGuestStatus(guestId, { status });
      await load(true);
      showToast(status === "checked_in" ? "Guest approved." : "Guest rejected.", { tone: "success" });
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : "Could not update guest.", { tone: "error" });
    } finally {
      setUpdatingId(null);
    }
  };

  const addGuest = async ({ fullName, email, phone }: { fullName: string; email: string; phone: string }) => {
    if (!activeEvent?.id) return;
    setAdding(true);
    try {
      await createEventGuest(activeEvent.id, { full_name: fullName, email: email || null, phone: phone || null });
      setAddOpen(false);
      await load(true);
      showToast("Guest added and approved.", { tone: "success" });
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : "Could not add guest.", { tone: "error", duration: 3200 });
    } finally {
      setAdding(false);
    }
  };

  const copyGuestQr = async () => {
    if (!actionsGuest?.qr_hash) return;
    await Clipboard.setStringAsync(actionsGuest.qr_hash);
    setActionsGuest(null);
    showToast("Guest QR scan code copied.", { tone: "success" });
  };

  const copyRsvpLink = async () => {
    if (!inviteLink) return;
    await Clipboard.setStringAsync(inviteLink);
    showToast("Website RSVP link copied.", { tone: "success" });
  };

  const shareRsvpLink = async () => {
    if (!inviteLink) return;
    await NativeShare.share({ title: `${activeEvent?.title ?? "Event"} RSVP`, message: inviteLink, url: inviteLink });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteGuest(deleteTarget.id);
      setDeleteTarget(null);
      await load(true);
      showToast("Guest deleted.", { tone: "success" });
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : "Could not delete guest.", { tone: "error" });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color="#4fd6be" /></View>;
  return (
    <>
      <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#4fd6be" />}>
        <View style={styles.headingRow}><View><Text style={[styles.heading, { color: colors.text }]}>Guests</Text><Text style={[styles.hint, { color: colors.muted }]}>Manage invitations and arrival activity.</Text></View><View style={styles.headerActions}><Pressable accessibilityLabel="Refresh guests" style={[styles.iconButton, { borderColor: colors.border }]} onPress={() => load(true)}><RefreshCw color="#4fd6be" size={17} /></Pressable><Pressable accessibilityLabel="Add guest" style={styles.addButton} onPress={() => setAddOpen(true)}><Plus color="#07110f" size={18} /><Text style={styles.addText}>Add</Text></Pressable></View></View>
        {inviteLink ? <View style={[styles.rsvpCard, { backgroundColor: colors.panel, borderColor: colors.border }]}><View style={styles.rsvpIcon}><Link2 color="#4fd6be" size={18} /></View><View style={styles.rsvpCopy}><Text style={[styles.rsvpTitle, { color: colors.text }]}>Website RSVP</Text><Text numberOfLines={1} style={[styles.rsvpLink, { color: colors.muted }]}>{inviteLink}</Text></View><Pressable accessibilityLabel="Copy RSVP link" style={[styles.smallIcon, { borderColor: colors.border }]} onPress={copyRsvpLink}><Copy color="#4fd6be" size={15} /></Pressable><Pressable accessibilityLabel="Share RSVP link" style={styles.rsvpShare} onPress={shareRsvpLink}><Share2 color="#07110f" size={15} /></Pressable></View> : null}
        <View style={styles.summaryRow}><Summary label="Total" value={data?.summary.total ?? 0} colors={colors} /><Summary label="Pending" value={presenceSummary.pending} colors={colors} /><Summary label="Approved" value={data?.summary.approved ?? presenceSummary.approved} colors={colors} /><Summary label="Inside" value={presenceSummary.inside} colors={colors} /></View>
        <View style={[styles.search, { backgroundColor: colors.panel, borderColor: colors.border }]}><Search color={colors.muted} size={17} /><TextInput value={query} onChangeText={setQuery} placeholder="Search guests" placeholderTextColor={colors.muted} style={[styles.searchInput, { color: colors.text }]} /></View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {guests.length === 0 ? <View style={[styles.empty, { backgroundColor: colors.panel, borderColor: colors.border }]}><Text style={[styles.emptyTitle, { color: colors.text }]}>No guests yet</Text><Text style={[styles.emptyHint, { color: colors.muted }]}>Add a guest or share the website RSVP form.</Text><Pressable onPress={() => setAddOpen(true)} style={styles.emptyButton}><Plus color="#07110f" size={16} /><Text style={styles.emptyButtonText}>Add first guest</Text></Pressable></View> : guests.map((guest) => (
          <View key={guest.id} style={[styles.guestContainer, { backgroundColor: colors.panel, borderColor: colors.strongBorder }]}>
          <Pressable delayLongPress={280} onLongPress={() => { longPressedRef.current = true; setActionsGuest(guest); }} onPress={() => { if (longPressedRef.current) { longPressedRef.current = false; return; } router.push(`/guest/${guest.id}?eventId=${activeEvent?.id ?? ""}` as never); }} style={({ pressed }) => [styles.guestCard, pressed && styles.pressed]}>
            <View style={styles.guestContent}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{guest.full_name.charAt(0).toUpperCase()}</Text></View>
            <View style={styles.guestCopy}><Text style={[styles.guestName, { color: colors.text }]} numberOfLines={1}>{guest.full_name}</Text><View style={styles.statusRow}><View style={[styles.statusLight, { backgroundColor: getPresence(guest) === "inside" ? "#4fd6be" : getPresence(guest) === "outside" ? "#63bce7" : getPresence(guest) === "rejected" ? "#e66d72" : getPresence(guest) === "approved" ? "#4fd6be" : "#e3c655" }]} /><Text style={[styles.guestMeta, { color: colors.muted }]} numberOfLines={1}>{guest.category} · {getPresence(guest) === "pending" ? "Pending approval" : getPresence(guest) === "approved" ? "Approved, not arrived" : getPresence(guest)}</Text></View></View>
            {updatingId === guest.id ? <ActivityIndicator color="#4fd6be" size="small" /> : guest.status === "pending" ? <View style={styles.actions}><Pressable accessibilityLabel="Reject guest" style={[styles.action, { backgroundColor: colors.soft }]} onPress={(event) => { event.stopPropagation(); void updateStatus(guest.id, "rejected"); }}><X color="#e46f6f" size={16} /></Pressable><Pressable accessibilityLabel="Approve guest" style={[styles.action, styles.approve]} onPress={(event) => { event.stopPropagation(); void updateStatus(guest.id, "checked_in"); }}><Check color="#07110f" size={16} /></Pressable></View> : guest.status === "checked_in" ? <Pressable accessibilityLabel={`Share ${guest.full_name} pass`} style={[styles.shareButton, { borderColor: colors.border }]} onPress={(event) => { event.stopPropagation(); setPassGuest(guest); }}><Share2 color="#4fd6be" size={17} /></Pressable> : <View style={styles.rejectedBadge}><Text style={styles.rejectedText}>REJECTED</Text></View>}
            </View>
          </Pressable>
          </View>
        ))}
        {guests.length ? <Text style={[styles.longPressHint, { color: colors.muted }]}>Long-press a guest to copy their QR code or delete them.</Text> : null}
      </ScrollView>
      <AddGuestModal visible={addOpen} loading={adding} onClose={() => setAddOpen(false)} onSubmit={addGuest} />
      <GuestActionsModal guest={actionsGuest} onClose={() => setActionsGuest(null)} onCopyQr={copyGuestQr} onDelete={() => { setDeleteTarget(actionsGuest); setActionsGuest(null); }} />
      <ActionConfirmModal visible={Boolean(deleteTarget)} title="Delete guest?" description={`${deleteTarget?.full_name ?? "This guest"} and their scan history will be permanently removed.`} confirmLabel="Delete guest" destructive loading={deleting} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} />
      <GuestPassModal
        guest={passGuest}
        eventId={activeEvent?.id ?? null}
        categories={activeEvent?.configuration.invitation_categories ?? DEFAULT_INVITATION_CATEGORIES}
        categoriesEnabled={activeEvent?.configuration.invitation_categories_enabled !== false}
        onClose={() => setPassGuest(null)}
      />
    </>
  );
}

function Summary({ label, value, colors }: { label: string; value: number; colors: { panel: string; border: string; text: string; muted: string } }) {
  return <View style={[styles.summary, { backgroundColor: colors.panel, borderColor: colors.border }]}><Text style={[styles.summaryValue, { color: colors.text }]}>{value}</Text><Text style={[styles.summaryLabel, { color: colors.muted }]}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" }, content: { padding: 16, paddingBottom: 36 }, headingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, heading: { fontSize: 20, fontWeight: "800" }, hint: { marginTop: 3, fontSize: 10 }, headerActions: { flexDirection: "row", alignItems: "center", gap: 7 }, iconButton: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center" }, addButton: { height: 38, paddingHorizontal: 13, borderRadius: 19, backgroundColor: "#4fd6be", flexDirection: "row", alignItems: "center", gap: 5 }, addText: { color: "#07110f", fontSize: 10, fontWeight: "800" }, rsvpCard: { minHeight: 66, marginTop: 14, padding: 10, borderRadius: 8, borderWidth: 1.5, flexDirection: "row", alignItems: "center" }, rsvpIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#173a32", alignItems: "center", justifyContent: "center" }, rsvpCopy: { flex: 1, minWidth: 0, marginLeft: 9 }, rsvpTitle: { fontSize: 11, fontWeight: "800" }, rsvpLink: { marginTop: 3, fontSize: 8 }, smallIcon: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: "center", justifyContent: "center" }, rsvpShare: { width: 34, height: 34, marginLeft: 6, borderRadius: 17, backgroundColor: "#4fd6be", alignItems: "center", justifyContent: "center" }, summaryRow: { marginTop: 12, flexDirection: "row", gap: 6 }, summary: { flex: 1, minWidth: 0, minHeight: 70, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" }, summaryValue: { fontSize: 18, fontWeight: "800" }, summaryLabel: { marginTop: 2, fontSize: 8, fontWeight: "700" }, search: { height: 44, marginVertical: 13, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 8 }, searchInput: { flex: 1, fontSize: 12 }, error: { marginBottom: 10, color: "#e46f6f", fontSize: 11 }, empty: { padding: 28, borderRadius: 8, borderWidth: 1, alignItems: "center" }, emptyTitle: { fontSize: 14, fontWeight: "700" }, emptyHint: { marginTop: 5, fontSize: 10, textAlign: "center" }, emptyButton: { minHeight: 38, marginTop: 14, paddingHorizontal: 15, borderRadius: 19, backgroundColor: "#4fd6be", flexDirection: "row", alignItems: "center", gap: 6 }, emptyButtonText: { color: "#07110f", fontSize: 10, fontWeight: "800" }, guestContainer: { marginBottom: 9, borderRadius: 9, borderWidth: 1.5, elevation: 3, shadowColor: "#000", shadowOpacity: 0.16, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } }, guestCard: { borderRadius: 8 }, guestContent: { minHeight: 72, marginHorizontal: 12, marginVertical: 10, flexDirection: "row", alignItems: "center" }, pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] }, avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#173a32", alignItems: "center", justifyContent: "center" }, avatarText: { color: "#4fd6be", fontSize: 15, fontWeight: "800" }, guestCopy: { flex: 1, minWidth: 0, marginLeft: 10 }, guestName: { fontSize: 13, fontWeight: "700" }, statusRow: { marginTop: 5, flexDirection: "row", alignItems: "center" }, statusLight: { width: 7, height: 7, marginRight: 6, borderRadius: 4 }, guestMeta: { fontSize: 9, textTransform: "capitalize" }, actions: { flexDirection: "row", gap: 6 }, action: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" }, approve: { backgroundColor: "#4fd6be" }, shareButton: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center" }, rejectedBadge: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10, backgroundColor: "#472423" }, rejectedText: { color: "#f09a95", fontSize: 8, fontWeight: "800" }, longPressHint: { marginTop: 7, textAlign: "center", fontSize: 8 },
});
