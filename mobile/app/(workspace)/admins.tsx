import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Share as NativeShare, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { Copy, Link2, Plus, RefreshCw, Search, Share2, ShieldCheck } from "lucide-react-native";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useEvent } from "@/context/EventContext";
import { useThemeMode } from "@/context/ThemeContext";
import { useToast } from "@/context/ToastContext";
import { createAdminShareLink, deleteAdminShareLink, fetchAdminShareLinks, fetchEventPublicLinks, toggleAdminShareLink } from "@/lib/api/communications";
import { ActionConfirmModal } from "@/components/common/ActionConfirmModal";
import { AddAdminModal } from "@/components/workspace/admins/AddAdminModal";
import { AdminActionsModal } from "@/components/workspace/admins/AdminActionsModal";
import type { AdminShareLinkResponse } from "@/lib/types/communications";

export default function AdminsScreen() {
  const router = useRouter();
  const { activeEvent } = useEvent();
  const { resolvedMode } = useThemeMode();
  const { showToast } = useToast();
  const light = resolvedMode === "light";
  const colors = light
    ? { background: "#f4f7f6", panel: "#ffffff", border: "#d5e2de", strongBorder: "#bad3cc", text: "#10211d", muted: "#657772", input: "#f7fbfa" }
    : { background: "#07110f", panel: "#10221e", border: "#24483f", strongBorder: "#32685b", text: "#f5f8f7", muted: "#89a099", input: "#0b1916" };
  const [links, setLinks] = useState<AdminShareLinkResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [actionsAdmin, setActionsAdmin] = useState<AdminShareLinkResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminShareLinkResponse | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [adminRsvpLink, setAdminRsvpLink] = useState<string | null>(null);
  const longPressedRef = useRef(false);

  const load = useCallback(async (refresh = false) => {
    if (!activeEvent) return;
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const [nextLinks, publicLinks] = await Promise.all([
        fetchAdminShareLinks(activeEvent.id),
        fetchEventPublicLinks(activeEvent.id),
      ]);
      setLinks(nextLinks);
      setAdminRsvpLink(publicLinks.admin_rsvp_url);
    }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load admins."); }
    finally { setLoading(false); setRefreshing(false); }
  }, [activeEvent]);
  useEffect(() => { void load(); }, [load]);
  const visibleLinks = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return links;
    return links.filter((link) => {
      const status = link.enabled ? "enabled active" : "disabled inactive";
      return `${link.link_label} ${status}`.toLowerCase().includes(normalized);
    });
  }, [links, query]);

  const create = async (name: string) => {
    if (!activeEvent) return;
    setCreating(true);
    try {
      const created = await createAdminShareLink(activeEvent.id, name);
      setLinks((current) => [created, ...current]);
      setAddOpen(false);
      showToast("Admin scanner access created.", { tone: "success" });
    } catch (caught) { showToast(caught instanceof Error ? caught.message : "Could not create admin.", { tone: "error" }); }
    finally { setCreating(false); }
  };

  const toggle = async (link: AdminShareLinkResponse) => {
    setWorkingId(link.id);
    try {
      const updated = await toggleAdminShareLink(link.id);
      setLinks((current) => current.map((item) => item.id === link.id ? updated : item));
      showToast(updated.enabled ? "Scanner access enabled." : "Scanner access disabled.", { tone: "success" });
    } catch (caught) { showToast(caught instanceof Error ? caught.message : "Could not update admin.", { tone: "error" }); }
    finally { setWorkingId(null); }
  };

  const copy = async (value: string, message: string) => {
    await Clipboard.setStringAsync(value);
    setActionsAdmin(null);
    showToast(message, { tone: "success" });
  };
  const shareLink = async (link: AdminShareLinkResponse) => {
    setActionsAdmin(null);
    const shareUrl = link.share_url;
    await NativeShare.share({ title: `${activeEvent?.title ?? "Event"} scanner`, message: shareUrl, url: shareUrl });
  };
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteAdminShareLink(deleteTarget.id);
      setLinks((current) => current.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
      showToast("Admin access deleted.", { tone: "success" });
    } catch (caught) { showToast(caught instanceof Error ? caught.message : "Could not delete admin.", { tone: "error" }); }
    finally { setDeleting(false); }
  };

  return <>
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#4fd6be" />}>
      <View style={styles.headingRow}><View><Text style={[styles.heading, { color: colors.text }]}>Admins / Doormen</Text><Text style={[styles.hint, { color: colors.muted }]}>Create scanner access and monitor door activity.</Text></View><View style={styles.headerActions}><Pressable accessibilityLabel="Refresh admins" style={[styles.iconButton, { borderColor: colors.border }]} onPress={() => load(true)}><RefreshCw color="#4fd6be" size={17} /></Pressable><Pressable style={styles.addButton} onPress={() => setAddOpen(true)}><Plus color="#07110f" size={18} /><Text style={styles.addText}>Add</Text></Pressable></View></View>
      {adminRsvpLink ? <View style={[styles.rsvpCard, { backgroundColor: colors.panel, borderColor: colors.strongBorder }]}><View style={styles.rsvpIcon}><Link2 color="#4fd6be" size={18} /></View><View style={styles.rsvpCopy}><Text style={[styles.rsvpTitle, { color: colors.text }]}>Admin RSVP</Text><Text numberOfLines={1} style={[styles.rsvpLink, { color: colors.muted }]}>{adminRsvpLink}</Text></View><Pressable style={[styles.smallIcon, { borderColor: colors.border }]} onPress={() => copy(adminRsvpLink, "Admin RSVP link copied.")}><Copy color="#4fd6be" size={15} /></Pressable><Pressable style={styles.rsvpShare} onPress={() => NativeShare.share({ title: `${activeEvent?.title ?? "Event"} admin access`, message: adminRsvpLink, url: adminRsvpLink })}><Share2 color="#07110f" size={15} /></Pressable></View> : null}
      <View style={[styles.search, { backgroundColor: colors.panel, borderColor: colors.strongBorder }]}><Search color={colors.muted} size={17} /><TextInput value={query} onChangeText={setQuery} placeholder="Search admins" placeholderTextColor={colors.muted} autoCapitalize="none" style={[styles.searchInput, { color: colors.text }]} /></View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator color="#4fd6be" style={styles.loader} /> : links.length === 0 ? <View style={[styles.empty, { backgroundColor: colors.panel, borderColor: colors.border }]}><Text style={[styles.emptyTitle, { color: colors.text }]}>No admins yet</Text><Text style={[styles.emptyHint, { color: colors.muted }]}>Create an admin or share the website approval form.</Text><Pressable onPress={() => setAddOpen(true)} style={styles.emptyButton}><Plus color="#07110f" size={16} /><Text style={styles.emptyButtonText}>Add first admin</Text></Pressable></View> : visibleLinks.length === 0 ? <View style={[styles.empty, { backgroundColor: colors.panel, borderColor: colors.border }]}><Search color={colors.muted} size={22} /><Text style={[styles.emptyTitle, { color: colors.text }]}>No matching admins</Text><Text style={[styles.emptyHint, { color: colors.muted }]}>Try another name or status.</Text></View> : visibleLinks.map((link) => (
        <View key={link.id} style={[styles.adminContainer, { backgroundColor: colors.panel, borderColor: colors.strongBorder }]}>
        <Pressable delayLongPress={280} onLongPress={() => { longPressedRef.current = true; setActionsAdmin(link); }} onPress={() => { if (longPressedRef.current) { longPressedRef.current = false; return; } router.push(`/admin/${link.id}?eventId=${activeEvent?.id ?? ""}` as never); }} style={({ pressed }) => [styles.adminCard, pressed && styles.pressed]}>
          <View style={styles.adminContent}>
          <View style={styles.adminTop}><View style={styles.adminAvatar}><ShieldCheck color="#4fd6be" size={18} /></View><View style={styles.adminCopy}><Text style={[styles.adminName, { color: colors.text }]} numberOfLines={1}>{link.link_label}</Text><View style={styles.statusRow}><View style={[styles.statusLight, { backgroundColor: link.enabled ? "#4fd6be" : "#e66d72" }]} /><Text style={[styles.adminMeta, { color: colors.muted }]}>{link.enabled ? "Scanner enabled" : "Scanner disabled"}</Text></View></View>{workingId === link.id ? <ActivityIndicator color="#4fd6be" size="small" /> : <View onTouchStart={() => { longPressedRef.current = true; setTimeout(() => { longPressedRef.current = false; }, 400); }}><Switch value={link.enabled} onValueChange={() => toggle(link)} trackColor={{ false: "#4a5653", true: "#2a8c78" }} thumbColor={link.enabled ? "#4fd6be" : "#d6dcda"} /></View>}</View>
          <View style={styles.statsRow}><AdminStat label="In" value={link.activity?.scanned_in ?? 0} colors={colors} /><AdminStat label="Out" value={link.activity?.scanned_out ?? 0} colors={colors} /><AdminStat label="Denied" value={link.activity?.denied ?? 0} colors={colors} /></View>
          <Pressable style={[styles.shareButton, { borderColor: colors.border }]} onPress={(event) => { event.stopPropagation(); void shareLink(link); }}><Share2 color="#4fd6be" size={16} /><Text style={[styles.shareText, { color: colors.text }]}>Share scanner link</Text></Pressable>
          </View>
        </Pressable>
        </View>
      ))}
      {links.length ? <Text style={[styles.longPressHint, { color: colors.muted }]}>Long-press an admin for copy, share, and delete actions.</Text> : null}
    </ScrollView>
    <AddAdminModal visible={addOpen} loading={creating} onClose={() => setAddOpen(false)} onSubmit={create} />
    <AdminActionsModal admin={actionsAdmin} onClose={() => setActionsAdmin(null)} onCopy={() => actionsAdmin && copy(actionsAdmin.share_url, "Scanner link copied.")} onShare={() => actionsAdmin && shareLink(actionsAdmin)} onDelete={() => { setDeleteTarget(actionsAdmin); setActionsAdmin(null); }} />
    <ActionConfirmModal visible={Boolean(deleteTarget)} title="Delete admin?" description={`${deleteTarget?.link_label ?? "This admin"} will permanently lose scanner access.`} confirmLabel="Delete admin" destructive loading={deleting} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} />
  </>;
}

function AdminStat({ label, value, colors }: { label: string; value: number; colors: { text: string; muted: string; input: string } }) { return <View style={[styles.stat, { backgroundColor: colors.input }]}><Text style={[styles.statValue, { color: colors.text }]}>{value}</Text><Text style={[styles.statLabel, { color: colors.muted }]}>{label}</Text></View>; }

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 36 }, headingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, heading: { fontSize: 20, fontWeight: "800" }, hint: { marginTop: 4, fontSize: 10 }, headerActions: { flexDirection: "row", alignItems: "center", gap: 7 }, iconButton: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center" }, addButton: { height: 38, paddingHorizontal: 13, borderRadius: 19, backgroundColor: "#4fd6be", flexDirection: "row", alignItems: "center", gap: 5 }, addText: { color: "#07110f", fontSize: 10, fontWeight: "800" }, rsvpCard: { minHeight: 66, marginTop: 14, marginBottom: 12, padding: 10, borderRadius: 8, borderWidth: 1.5, flexDirection: "row", alignItems: "center" }, rsvpIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#173a32", alignItems: "center", justifyContent: "center" }, rsvpCopy: { flex: 1, minWidth: 0, marginLeft: 9 }, rsvpTitle: { fontSize: 11, fontWeight: "800" }, rsvpLink: { marginTop: 3, fontSize: 8 }, smallIcon: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: "center", justifyContent: "center" }, rsvpShare: { width: 34, height: 34, marginLeft: 6, borderRadius: 17, backgroundColor: "#4fd6be", alignItems: "center", justifyContent: "center" }, search: { height: 44, marginBottom: 12, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1.5, flexDirection: "row", alignItems: "center", gap: 8 }, searchInput: { flex: 1, fontSize: 12 }, error: { marginBottom: 10, color: "#e46f6f", fontSize: 10 }, loader: { marginTop: 30 }, empty: { padding: 28, borderWidth: 1, borderRadius: 8, alignItems: "center" }, emptyTitle: { marginTop: 5, fontSize: 14, fontWeight: "700" }, emptyHint: { marginTop: 5, fontSize: 10, textAlign: "center" }, emptyButton: { minHeight: 38, marginTop: 14, paddingHorizontal: 15, borderRadius: 19, backgroundColor: "#4fd6be", flexDirection: "row", alignItems: "center", gap: 6 }, emptyButtonText: { color: "#07110f", fontSize: 10, fontWeight: "800" }, adminContainer: { marginBottom: 10, borderWidth: 1.5, borderRadius: 9, elevation: 3, shadowColor: "#000", shadowOpacity: 0.16, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } }, adminCard: { borderRadius: 8 }, adminContent: { marginHorizontal: 12, marginVertical: 11 }, pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] }, adminTop: { flexDirection: "row", alignItems: "center" }, adminAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#173a32", alignItems: "center", justifyContent: "center" }, adminCopy: { flex: 1, minWidth: 0, marginLeft: 9 }, adminName: { fontSize: 13, fontWeight: "700" }, statusRow: { marginTop: 4, flexDirection: "row", alignItems: "center" }, statusLight: { width: 7, height: 7, marginRight: 6, borderRadius: 4 }, adminMeta: { fontSize: 9 }, statsRow: { marginTop: 12, flexDirection: "row", gap: 7 }, stat: { flex: 1, minHeight: 48, borderRadius: 7, alignItems: "center", justifyContent: "center" }, statValue: { fontSize: 15, fontWeight: "800" }, statLabel: { marginTop: 2, fontSize: 8, fontWeight: "700" }, shareButton: { minHeight: 38, marginTop: 10, borderWidth: 1, borderRadius: 19, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 }, shareText: { fontSize: 10, fontWeight: "700" }, longPressHint: { marginTop: 7, textAlign: "center", fontSize: 8 },
});
