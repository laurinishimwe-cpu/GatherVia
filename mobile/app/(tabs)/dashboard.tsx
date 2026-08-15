import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Plus, UserRound } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fetchCurrentUser } from "@/lib/api/auth";
import { useAuth } from "@/context/AuthContext";
import { useEvent } from "@/context/EventContext";
import {
  CreateEventModal,
  type PendingFlyerSelection,
} from "@/components/dashboard/CreateEventModal";
import { ProfileMenu } from "@/components/dashboard/ProfileMenu";
import { useThemeMode } from "@/context/ThemeContext";
import { TemplatePreview } from "@/components/dashboard/TemplatePreview";
import { RecentEventCard } from "@/components/dashboard/RecentEventCard";
import { ActionConfirmModal } from "@/components/common/ActionConfirmModal";
import { fetchFlyerTemplates, uploadFlyer } from "@/lib/api/flyers";
import { deleteEvent } from "@/lib/api/events";
import { useFlyerDraft } from "@/context/FlyerDraftContext";
import {
  DEFAULT_FLYER_CONFIGURATION,
  type FlyerTemplate,
} from "@/lib/types/flyer";
import type { CanvasLayer } from "@/lib/types/canvas";
import { buildFlyerTemplateDraft } from "@/lib/flyer/templateDraft";
import type { HistoricEventRecord } from "@/lib/types/auth";

const BRAND = "#4fd6be";

const categories = ["All", "Wedding", "Corporate", "Conference", "Gala", "Other"];

const categoryEventTypes: Record<string, FlyerTemplate["event_type"]> = {
  Wedding: "marriage",
  Corporate: "corporate",
  Conference: "conference",
  Gala: "gala",
  Other: "other",
};

export default function DashboardScreen() {
  const router = useRouter();
  const pageRef = useRef<ScrollView>(null);
  const { user } = useAuth();
  const { activeEvent, clearPendingDraft, createDraftEvent, setActiveEvent } = useEvent();
  const {
    selectLayer,
    setEditorMode,
    setLayers,
    setConfiguration,
    setSelectedStubRegion,
    resetDraft,
  } = useFlyerDraft();
  const { resolvedMode } = useThemeMode();
  const lightMode = resolvedMode === "light";
  
  const theme = lightMode
    ? {
        background: "#f4f7f6",
        panel: "#ffffff",
        soft: "#edf3f1",
        border: "#d5e2de",
        text: "#10211d",
        muted: "#657772",
      }
    : {
        background: "#07110f",
        panel: "#132722", // Lightened panel color so cards stand out from background
        soft: "#0c1c18",
        border: "#214239",
        text: "#f5f8f7",
        muted: "#78918b",
      };
      
  const [events, setEvents] = useState<HistoricEventRecord[]>(
    user?.historic_events ?? [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [templates, setTemplates] = useState<FlyerTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [templatesTop, setTemplatesTop] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<HistoricEventRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [eventsError, setEventsError] = useState("");

  const loadRecentEvents = useCallback(async () => {
    setEventsError("");
    setIsLoading(true);
    try {
      const currentUser = await fetchCurrentUser();
      setEvents(currentUser.historic_events ?? []);
    } catch (caught) {
      setEventsError(
        caught instanceof Error
          ? caught.message
          : "Could not load your recent events.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadRecentEvents();
    }, [loadRecentEvents]),
  );

  useEffect(() => {
    if (user?.historic_events) setEvents(user.historic_events);
  }, [user?.historic_events]);

  useEffect(() => {
    fetchFlyerTemplates()
      .then(setTemplates)
      .catch(() => setTemplates([]))
      .finally(() => setTemplatesLoading(false));
  }, []);

  const recentEvents = useMemo(
    () =>
      [...events]
        .sort(
          (first, second) =>
            new Date(second.created_at).getTime() -
            new Date(first.created_at).getTime(),
        )
        .slice(0, 8),
    [events],
  );

  const visibleTemplates =
    selectedCategory === "All"
      ? templates
      : templates.filter(
          (template) => template.event_type === categoryEventTypes[selectedCategory],
        );

  const templateRows = Array.from(
    { length: Math.ceil(visibleTemplates.length / 3) },
    (_, rowIndex) => visibleTemplates.slice(rowIndex * 3, rowIndex * 3 + 3),
  );

  const openWorkspace = async (
    title: string,
    eventType: HistoricEventRecord["event_type"],
  ) => {
    const eventId = await createDraftEvent(title, eventType);
    setCreateModalOpen(false);
    router.push(`/(workspace)/editor?eventId=${eventId}`);
  };

  const openTemplate = async (template: FlyerTemplate) => {
    resetDraft();
    const draft = buildFlyerTemplateDraft(template);
    setLayers(draft.layers);
    setConfiguration(draft.configuration);
    setEditorMode("design");
    await openWorkspace(`${template.title} Draft`, template.event_type);
  };

  const openUploadedFlyerWorkspace = async (
    title: string,
    eventType: HistoricEventRecord["event_type"],
    flyer: PendingFlyerSelection,
  ) => {
    let eventId: string | null = null;
    try {
      eventId = await createDraftEvent(title, eventType);
      const configuration = DEFAULT_FLYER_CONFIGURATION(flyer.width, flyer.height);
      const storedFlyer = await uploadFlyer(
        { uri: flyer.uri, name: flyer.name, type: flyer.type },
        configuration,
        /^[a-f\d]{24}$/i.test(eventId) ? eventId : undefined,
      );
      const flyerLayer: CanvasLayer = {
        id: `uploaded-flyer-${Date.now()}`,
        parentId: "main-frame",
        type: "image",
        name: "Uploaded flyer",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: 0,
        opacity: 1,
        zIndex: 0,
        visible: true,
        locked: false,
        imageUrl: storedFlyer.image_url,
      };

      setConfiguration(storedFlyer.configuration ?? configuration);
      setLayers([flyerLayer]);
      selectLayer(null);
      setSelectedStubRegion("background");
      setEditorMode("stub");
      setCreateModalOpen(false);
      router.push(`/(workspace)/editor?eventId=${eventId}`);
    } catch (error) {
      if (eventId && /^[a-f\d]{24}$/i.test(eventId)) {
        await deleteEvent(eventId).catch(() => undefined);
      }
      await clearPendingDraft().catch(() => undefined);
      setActiveEvent(null);
      resetDraft();
      throw error;
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteEvent(deleteTarget.id);
      setEvents((current) => current.filter((event) => event.id !== deleteTarget.id));
      if (activeEvent?.id === deleteTarget.id) setActiveEvent(null);
      setDeleteTarget(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Could not delete this event.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={["top"]}>
      <ScrollView
        ref={pageRef}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[3]}
        contentContainerStyle={styles.pageContent}
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <View style={styles.brandRow}>
              <Image
                source={require("../../assets/gathervia-mark.png")}
                style={styles.brandMark}
                resizeMode="contain"
              />
              <Text style={[styles.eyebrow, { color: lightMode ? theme.text : "#ffffff" }]}>Gather<Text style={styles.eyebrowAccent}>Via</Text></Text>
            </View>
            <Text style={[styles.greeting, { color: theme.text }]} numberOfLines={1}>
              Hi, {user?.full_name?.split(" ")[0] ?? "there"}
            </Text>
            <Text style={[styles.subtitle, { color: theme.muted }]}>Plan, invite, and welcome guests with ease.</Text>
          </View>
          <Pressable
            accessibilityLabel="Open profile menu"
            accessibilityHint="Opens your profile and account options"
            onPress={() => setProfileMenuOpen(true)}
            style={({ pressed }) => [
              styles.avatar,
              { backgroundColor: theme.soft, borderColor: theme.border },
              pressed && styles.avatarPressed,
            ]}
          >
            <UserRound color={lightMode ? "#176f61" : BRAND} size={21} strokeWidth={2.3} />
            <View style={[styles.avatarStatus, { borderColor: theme.background }]} />
          </Pressable>
        </View>

        <View style={styles.recentSection}>
          <View style={styles.sectionHeading}>
            <View>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Your events</Text>
              <Text style={[styles.sectionHint, { color: theme.muted }]}>Pick up where you left off</Text>
            </View>
            {recentEvents.length > 0 ? (
              <View style={[styles.countPill, { backgroundColor: theme.soft, borderColor: theme.border }]}>
                <Text style={styles.countLabel}>{recentEvents.length} recent</Text>
              </View>
            ) : null}
          </View>

          {eventsError ? (
            <View
              accessibilityRole="alert"
              style={[
                styles.eventsError,
                { backgroundColor: theme.soft, borderColor: "#a84f58" },
              ]}
            >
              <View style={styles.eventsErrorCopy}>
                <Text style={[styles.eventsErrorTitle, { color: theme.text }]}>Recent events did not load</Text>
                <Text style={[styles.eventsErrorMessage, { color: theme.muted }]} numberOfLines={3}>
                  {eventsError}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retry loading recent events"
                onPress={() => void loadRecentEvents()}
                style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </Pressable>
            </View>
          ) : null}

          {isLoading && recentEvents.length === 0 ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={BRAND} />
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalContent}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Create a new event"
                onPress={() => setCreateModalOpen(true)}
                style={({ pressed }) => [styles.createCard, pressed && styles.cardPressed]}
              >
                <View
                  collapsable={false}
                  pointerEvents="none"
                  style={[
                    StyleSheet.absoluteFillObject,
                    styles.createBackdrop,
                    {
                      backgroundColor: lightMode ? "#e5f7f2" : "#10221e",
                      borderColor: lightMode ? "#8ccfbe" : "#32685b",
                    },
                  ]}
                />
                <View style={styles.createContent}>
                  <View style={styles.createIcon}>
                    <Plus color="#07110f" size={23} strokeWidth={2.6} />
                  </View>
                  <Text style={[styles.createText, { color: theme.text }]}>Create event</Text>
                </View>
              </Pressable>

              {recentEvents.map((event) => (
                <RecentEventCard
                  key={event.id}
                  event={event}
                  lightMode={lightMode}
                  onPress={() => router.push(`/(workspace)/editor?eventId=${event.id}`)}
                  onDelete={() => {
                    setDeleteError("");
                    setDeleteTarget(event);
                  }}
                />
              ))}

              {recentEvents.length === 0 ? (
                <View style={[styles.emptyRecentCard, { backgroundColor: theme.panel, borderColor: theme.border }]}>
                  <Text style={[styles.emptyRecentTitle, { color: theme.text }]}>Your first event starts here</Text>
                  <Text style={[styles.emptyRecentMessage, { color: theme.muted }]}>Create one now, then return to it anytime from this row.</Text>
                </View>
              ) : null}
            </ScrollView>
          )}
        </View>

        <View
          style={styles.sectionHeading}
          onLayout={(event) => setTemplatesTop(event.nativeEvent.layout.y)}
        >
          <View>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Find your look</Text>
            <Text style={[styles.sectionHint, { color: theme.muted }]}>Choose a template and make it yours</Text>
          </View>
        </View>

        <View
          style={[
            styles.stickyCategories,
            { backgroundColor: theme.background, borderBottomColor: theme.border },
          ]}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryContent}
          >
            {categories.map((category) => {
              const selected = selectedCategory === category;
              return (
                <Pressable
                  key={category}
                  onPress={() => setSelectedCategory(category)}
                  style={[
                    styles.category,
                    { backgroundColor: theme.soft, borderColor: theme.border },
                    selected && styles.categorySelected,
                  ]}
                >
                  <Text
                    style={[
                    styles.categoryText,
                    { color: theme.muted },
                    selected && styles.categoryTextSelected,
                    ]}
                  >
                    {category}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.templateGrid}>
          {templatesLoading ? (
            <View style={styles.templateLoading}>
              <ActivityIndicator color={BRAND} />
            </View>
          ) : visibleTemplates.length === 0 ? (
            <Text style={[styles.emptyTemplates, { color: theme.muted }]}>No templates in this category.</Text>
          ) : templateRows.map((row, rowIndex) => (
            <View key={`template-row-${rowIndex}`} style={styles.templateRow}>
              {[0, 1, 2].map((slotIndex) => {
                const template = row[slotIndex];

                return (
                  <View key={template?.id ?? `empty-${rowIndex}-${slotIndex}`} style={styles.templateSlot}>
                    {template ? (
                      <Pressable
                        onPress={() => openTemplate(template)}
                        style={({ pressed }) => [
                          styles.templateCard,
                          { backgroundColor: theme.panel, borderColor: theme.border },
                          pressed && styles.pressed,
                        ]}
                      >
                        <TemplatePreview template={template} compact />
                        <View style={styles.templateFooter}>
                          <View style={styles.templateFooterCopy}>
                            <Text style={[styles.templateTitle, { color: theme.text }]} numberOfLines={1}>
                              {template.title}
                            </Text>
                            <Text style={[styles.templateCategory, { color: theme.muted }]} numberOfLines={1}>
                              {template.event_type === "marriage"
                                ? "Wedding"
                                : template.event_type.charAt(0).toUpperCase() + template.event_type.slice(1)}
                            </Text>
                          </View>
                        </View>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>

      <ProfileMenu visible={profileMenuOpen} onClose={() => setProfileMenuOpen(false)} />
      <CreateEventModal
        visible={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onBrowseTemplates={() => {
          setCreateModalOpen(false);
          pageRef.current?.scrollTo({ y: Math.max(templatesTop - 8, 0), animated: true });
        }}
        onCreate={async (title, eventType, flyer) => {
          resetDraft();
          if (flyer) {
            await openUploadedFlyerWorkspace(title, eventType, flyer);
            return;
          }
          await openWorkspace(title, eventType);
        }}
      />
      <ActionConfirmModal
        visible={Boolean(deleteTarget)}
        title="Delete event?"
        description={deleteError || (deleteTarget ? `Delete ${deleteTarget.title} and its guest, admin, analytics, and invitation data? This action cannot be undone.` : "")}
        confirmLabel="Delete event"
        destructive
        loading={deleting}
        onCancel={() => {
          setDeleteError("");
          setDeleteTarget(null);
        }}
        onConfirm={confirmDelete}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#07110f" },
  pageContent: { paddingTop: 18, paddingBottom: 28 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  headerCopy: { flex: 1, paddingRight: 16 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  brandMark: { width: 22, height: 22 },
  eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 0 },
  eyebrowAccent: { color: BRAND },
  greeting: { marginTop: 5, color: "#f5f8f7", fontSize: 23, fontWeight: "800" },
  subtitle: { marginTop: 5, color: "#8ca09b", fontSize: 13, lineHeight: 19 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    elevation: 2,
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  avatarStatus: {
    position: "absolute",
    right: 2,
    bottom: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    backgroundColor: BRAND,
  },
  avatarPressed: { opacity: 0.78, transform: [{ scale: 0.96 }] },
  recentSection: { marginTop: 2 },
  sectionHeading: {
    marginTop: 27,
    marginBottom: 12,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  sectionTitle: { color: "#f5f8f7", fontSize: 18, fontWeight: "700" },
  sectionHint: { marginTop: 3, color: "#78918b", fontSize: 12 },
  countLabel: { color: BRAND, fontSize: 12, fontWeight: "700" },
  countPill: { paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderRadius: 14 },
  loadingRow: { height: 148, alignItems: "center", justifyContent: "center" },
  eventsError: {
    marginHorizontal: 20,
    marginBottom: 4,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
  },
  eventsErrorCopy: { flex: 1 },
  eventsErrorTitle: { fontSize: 13, fontWeight: "700" },
  eventsErrorMessage: { marginTop: 3, fontSize: 11, lineHeight: 16 },
  retryButton: {
    minHeight: 34,
    paddingHorizontal: 13,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    backgroundColor: BRAND,
  },
  retryButtonText: { color: "#07110f", fontSize: 12, fontWeight: "800" },
  horizontalContent: { gap: 12, paddingHorizontal: 20, paddingTop: 6, paddingBottom: 8 },
  emptyRecentCard: {
    width: 210,
    height: 126,
    flexShrink: 0,
    justifyContent: "center",
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 9,
  },
  emptyRecentTitle: { fontSize: 14, fontWeight: "700" },
  emptyRecentMessage: { marginTop: 6, fontSize: 11, lineHeight: 16 },
  createCard: {
    width: 138,
    flexShrink: 0,
    height: 126,
  },
  createBackdrop: {
    borderRadius: 9,
    borderWidth: 1.5,
  },
  createContent: { flex: 1, zIndex: 1, padding: 13, alignItems: "center", justifyContent: "center" },
  createIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND,
  },
  createText: { marginTop: 13, color: "#f5f8f7", fontSize: 14, fontWeight: "800", textAlign: "center" },
  stickyCategories: {
    backgroundColor: "#07110f",
    borderBottomWidth: 1,
    borderBottomColor: "#102720",
  },
  categoryContent: { gap: 8, paddingHorizontal: 12, paddingVertical: 11 },
  category: {
    minHeight: 34,
    paddingHorizontal: 15,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#24433b",
    backgroundColor: "#0c1c18",
  },
  categorySelected: { borderColor: BRAND, backgroundColor: BRAND },
  categoryText: { color: "#9cada8", fontSize: 12, fontWeight: "700" },
  categoryTextSelected: { color: "#07110f" },
  templateGrid: {
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 10,
  },
  templateRow: { flexDirection: "row", gap: 8 },
  templateSlot: { flex: 1, minWidth: 0 },
  templateCard: {
    width: "100%",
    minWidth: 0,
    overflow: "hidden", 
    borderRadius: 12, // Slightly more rounded to match modern styling
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  templateLoading: { width: "100%", minHeight: 180, alignItems: "center", justifyContent: "center" },
  emptyTemplates: { width: "100%", paddingVertical: 40, textAlign: "center", fontSize: 12 },
  templateFooter: {
    minHeight: 50,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  templateFooterCopy: { flex: 1 },
  templateTitle: { color: "#f5f8f7", fontSize: 11, fontWeight: "700" },
  templateCategory: { marginTop: 3, color: "#78918b", fontSize: 9 },
  cardPressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  pressed: { opacity: 0.72 },
});
