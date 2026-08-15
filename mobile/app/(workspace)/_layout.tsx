import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, BackHandler, Pressable, StyleSheet, Text, View } from "react-native";
import { Tabs, useGlobalSearchParams, usePathname, useRouter } from "expo-router";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { BarChart3, Palette, Settings2, ShieldCheck, UsersRound } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEvent } from "@/context/EventContext";
import { useFlyerDraft } from "@/context/FlyerDraftContext";
import { useThemeMode } from "@/context/ThemeContext";
import { useToast } from "@/context/ToastContext";
import { WorkspaceChromeProvider, useWorkspaceChrome } from "@/context/WorkspaceChromeContext";
import { useEditorOrientation } from "@/hooks/useEditorOrientation";
import { WorkspaceHeader } from "@/components/workspace/WorkspaceHeader";
import { ActionConfirmModal } from "@/components/common/ActionConfirmModal";
import { deleteEvent } from "@/lib/api/events";
import { prefetchEventGuests } from "@/lib/api/guests";
import { prefetchWorkspacePlanData } from "@/lib/api/plans";

const tabs = [
  { name: "editor", label: "Editor", Icon: Palette },
  { name: "settings", label: "Settings", Icon: Settings2 },
  { name: "guests", label: "Guests", Icon: UsersRound },
  { name: "admins", label: "Admins", Icon: ShieldCheck },
  { name: "analytics", label: "Analytics", Icon: BarChart3 },
] as const;

function WorkspaceBottomBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { activeEvent } = useEvent();
  const { prepareNavigation } = useWorkspaceChrome();
  const { resolvedMode } = useThemeMode();
  const { showToast } = useToast();
  const light = resolvedMode === "light";

  return (
    <View
      style={[
        styles.tabBar,
        {
          height: 58 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 6),
          backgroundColor: light ? "#ffffff" : "#081512",
          borderTopColor: light ? "#cfe0dc" : "#1e4037",
        },
      ]}
    >
      {tabs.map(({ name, label, Icon }) => {
        const routeIndex = state.routes.findIndex((route) => route.name === name);
        const focused = routeIndex === state.index;
        return (
          <View key={name} style={styles.tabSlot}>
            <Pressable
              onPress={async () => {
                const preparation = await prepareNavigation();
                if (!preparation.allowed) return;
                const eventForNavigation = preparation.event ?? activeEvent;
                const needsDate = name === "guests" || name === "admins" || name === "analytics";
                if (needsDate && !eventForNavigation?.event_date) {
                  showToast("Save an event date in Settings before opening this section.", { tone: "error", duration: 3800 });
                  navigation.navigate("settings", { eventId: eventForNavigation?.id });
                  return;
                }
                if (needsDate && eventForNavigation?.design_status !== "published") {
                  showToast("Convert the design into an invitation in Editor before opening Guests, Admins, or Analytics.", { tone: "error", duration: 4400 });
                  navigation.navigate("editor", { eventId: eventForNavigation?.id });
                  return;
                }
                navigation.navigate(name, { eventId: eventForNavigation?.id });
              }}
              accessibilityRole="button"
              style={styles.tabButton}
            >
              <Icon color={focused ? "#4fd6be" : "#78918b"} size={focused ? 21 : 19} strokeWidth={2.1} />
              <Text style={[styles.tabLabel, { color: focused ? "#4fd6be" : "#78918b" }]}>{label}</Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

function GuardedWorkspaceHeader() {
  const { leaveWorkspace } = useWorkspaceChrome();
  return <WorkspaceHeader onBack={leaveWorkspace} />;
}

function WorkspaceBackHandler() {
  const { leaveWorkspace } = useWorkspaceChrome();

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      void leaveWorkspace();
      return true;
    });
    return () => subscription.remove();
  }, [leaveWorkspace]);

  return null;
}

export default function WorkspaceLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useGlobalSearchParams<{ eventId?: string | string[] }>();
  const eventId = Array.isArray(params.eventId) ? params.eventId[0] : params.eventId;
  const { activeEvent, clearPendingDraft, loadEvent, pendingDraftEventId, setActiveEvent } = useEvent();
  const { resetDraft, setLayers, setConfiguration, selectLayer, markSaved } = useFlyerDraft();
  const [loading, setLoading] = useState(Boolean(eventId && activeEvent?.id !== eventId));
  const [error, setError] = useState("");
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [discardError, setDiscardError] = useState("");
  const { isLandscape } = useEditorOrientation();
  const { showToast } = useToast();

  const hasUnfinishedEvent = Boolean(activeEvent?.id && activeEvent.id === pendingDraftEventId);

  useEffect(() => {
    if (!activeEvent?.id || activeEvent.id.startsWith("mobile-")) return;
    const canLoadGuestData = activeEvent.design_status === "published";
    prefetchWorkspacePlanData(activeEvent.id, canLoadGuestData);
    if (canLoadGuestData) prefetchEventGuests(activeEvent.id);
  }, [activeEvent?.design_status, activeEvent?.id]);

  const attemptLeave = useCallback(() => {
    if (hasUnfinishedEvent) {
      setDiscardError("");
      setLeaveOpen(true);
      return;
    }
    router.replace("/(tabs)/dashboard");
  }, [hasUnfinishedEvent, router]);

  const discardAndLeave = async () => {
    if (!activeEvent) return;
    setDiscarding(true);
    try {
      if (!activeEvent.id.startsWith("mobile-")) await deleteEvent(activeEvent.id);
      await clearPendingDraft();
      setActiveEvent(null);
      resetDraft();
      setLeaveOpen(false);
      router.replace("/(tabs)/dashboard");
    } catch (caught) {
      setDiscardError(caught instanceof Error ? caught.message : "Could not discard this draft.");
    } finally {
      setDiscarding(false);
    }
  };

  useEffect(() => {
    if (!eventId || activeEvent?.id === eventId) return;
    setLoading(true);
    loadEvent(eventId)
      .then((event) => {
        if (event.design_layers) setLayers(event.design_layers);
        if (event.design_configuration) setConfiguration(event.design_configuration);
        selectLayer(null);
        markSaved();
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load event."))
      .finally(() => setLoading(false));
  }, [activeEvent?.id, eventId, loadEvent, markSaved, selectLayer, setConfiguration, setLayers]);

  useEffect(() => {
    if (!activeEvent) return;
    const restrictedSection = ["/guests", "/admins", "/analytics"].some((suffix) => pathname.endsWith(suffix));
    if (!restrictedSection) return;
    if (!activeEvent.event_date) {
      showToast("Save an event date in Settings before opening this section.", { tone: "error", duration: 3800 });
      router.replace({ pathname: "/(workspace)/settings", params: { eventId: activeEvent.id } });
      return;
    }
    if (activeEvent.design_status !== "published") {
      showToast("Convert the design into an invitation in Editor before opening Guests, Admins, or Analytics.", { tone: "error", duration: 4400 });
      router.replace({ pathname: "/(workspace)/editor", params: { eventId: activeEvent.id } });
    }
  }, [activeEvent, pathname, router, showToast]);

  if (loading) {
    return <View style={styles.state}><ActivityIndicator color="#4fd6be" /></View>;
  }
  if (error) {
    return <View style={styles.state}><Text style={styles.error}>{error}</Text></View>;
  }

  return (
    <WorkspaceChromeProvider leaveWorkspace={attemptLeave}>
      <WorkspaceBackHandler />
      <Tabs
        tabBar={(props) => (
          isLandscape && props.state.routes[props.state.index]?.name === "editor"
            ? null
            : <WorkspaceBottomBar {...props} />
        )}
        screenOptions={({ route }) => ({
          headerShown: !(isLandscape && route.name === "editor"),
          header: () => <GuardedWorkspaceHeader />,
        })}
      >
        {tabs.map(({ name }) => <Tabs.Screen key={name} name={name} options={{ title: name }} />)}
      </Tabs>
      <ActionConfirmModal
        visible={leaveOpen}
        title="Delete unfinished event?"
        description={discardError || "This event has not been saved or converted. Leaving now will permanently delete the draft."}
        confirmLabel="Delete and leave"
        destructive
        loading={discarding}
        onCancel={() => setLeaveOpen(false)}
        onConfirm={discardAndLeave}
      />
    </WorkspaceChromeProvider>
  );
}

const styles = StyleSheet.create({
  state: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#07110f" },
  error: { color: "#f47b7b", fontSize: 13 },
  tabBar: { borderTopWidth: 1, flexDirection: "row", paddingTop: 5 },
  tabSlot: { flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center" },
  tabButton: { width: "100%", alignItems: "center", justifyContent: "center" },
  tabLabel: { marginTop: 2, textAlign: "center", fontSize: 8, fontWeight: "700" },
});
