import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { CalendarDays, ChevronRight, Clock3, CreditCard, MapPin, Save, Tags } from "lucide-react-native";
import { useEvent } from "@/context/EventContext";
import { useThemeMode } from "@/context/ThemeContext";
import { useToast } from "@/context/ToastContext";
import { useWorkspaceChrome } from "@/context/WorkspaceChromeContext";
import { CalendarPickerModal, formatDateLong } from "@/components/workspace/CalendarPickerModal";
import { CategoryEditorModal } from "@/components/workspace/CategoryEditorModal";
import { updateEvent } from "@/lib/api/events";
import type { EventRecord, EventType } from "@/lib/types/event";
import { MobilePlansPanel } from "@/components/plans/MobilePlansPanel";

const eventTypes: Array<{ label: string; value: EventType }> = [
  { label: "Wedding", value: "marriage" },
  { label: "Corporate", value: "corporate" },
  { label: "Private", value: "private" },
  { label: "Conference", value: "conference" },
  { label: "Gala", value: "gala" },
  { label: "Other", value: "other" },
];

type SettingsSaveStatus = "idle" | "pending" | "saving" | "saved" | "waiting" | "error";

interface EventSettingsDraft {
  title: string;
  date: string;
  time: string;
  location: string;
  eventType: EventType;
  approval: boolean;
  categoriesEnabled: boolean;
  categories: string[];
}

export default function WorkspaceSettingsScreen() {
  const { activeEvent, setActiveEvent } = useEvent();
  const { registerBeforeNavigate } = useWorkspaceChrome();
  const { resolvedMode } = useThemeMode();
  const { showToast } = useToast();
  const light = resolvedMode === "light";
  const localTimeZone = useMemo(resolveLocalTimeZone, []);
  const colors = light
    ? { background: "#f4f7f6", panel: "#ffffff", border: "#d5e2de", text: "#10211d", muted: "#657772", input: "#f7fbfa" }
    : { background: "#07110f", panel: "#10221e", border: "#24483f", text: "#f5f8f7", muted: "#89a099", input: "#0b1916" };
  const [title, setTitle] = useState(activeEvent?.title ?? "");
  const [date, setDate] = useState(activeEvent?.event_date?.slice(0, 10) ?? "");
  const [time, setTime] = useState(activeEvent?.event_time?.slice(0, 5) ?? "");
  const [location, setLocation] = useState(activeEvent?.event_location ?? "");
  const [eventType, setEventType] = useState<EventType>(activeEvent?.event_type ?? "other");
  const [approval, setApproval] = useState(activeEvent?.require_rsvp_approval !== false);
  const [categoriesEnabled, setCategoriesEnabled] = useState(activeEvent?.configuration.invitation_categories_enabled !== false);
  const [categories, setCategories] = useState<string[]>(activeEvent?.configuration.invitation_categories ?? ["General", "VIP"]);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SettingsSaveStatus>("idle");
  const [activeSettingsView, setActiveSettingsView] = useState<"event" | "plans">("event");
  const initialSignature = activeEvent ? eventSettingsSignature(activeEvent) : "";
  const [lastSavedSignature, setLastSavedSignature] = useState(initialSignature);
  const lastSavedSignatureRef = useRef(initialSignature);
  const activeEventRef = useRef(activeEvent);
  const loadedEventIdRef = useRef(activeEvent?.id ?? null);
  const formRef = useRef<EventSettingsDraft | null>(null);
  const savePromiseRef = useRef<Promise<EventRecord | null> | null>(null);

  const draft = useMemo<EventSettingsDraft>(() => ({
    title,
    date,
    time,
    location,
    eventType,
    approval,
    categoriesEnabled,
    categories,
  }), [approval, categories, categoriesEnabled, date, eventType, location, time, title]);
  const draftSignature = useMemo(() => settingsDraftSignature(draft), [draft]);
  const hasUnsavedChanges = Boolean(activeEvent && draftSignature !== lastSavedSignature);

  useEffect(() => {
    formRef.current = draft;
  }, [draft]);

  useEffect(() => {
    activeEventRef.current = activeEvent;
  }, [activeEvent]);

  useEffect(() => {
    if (!activeEvent || loadedEventIdRef.current === activeEvent.id) return;
    loadedEventIdRef.current = activeEvent.id;
    setTitle(activeEvent.title);
    setDate(activeEvent.event_date?.slice(0, 10) ?? "");
    setTime(activeEvent.event_time?.slice(0, 5) ?? "");
    setLocation(activeEvent.event_location ?? "");
    setEventType(activeEvent.event_type);
    setApproval(activeEvent.require_rsvp_approval !== false);
    setCategoriesEnabled(activeEvent.configuration.invitation_categories_enabled !== false);
    setCategories(activeEvent.configuration.invitation_categories ?? ["General", "VIP"]);
    const signature = eventSettingsSignature(activeEvent);
    lastSavedSignatureRef.current = signature;
    setLastSavedSignature(signature);
    setSaveStatus("idle");
  }, [activeEvent]);

  const flushSettings = useCallback(async (announceValidation: boolean): Promise<EventRecord | null> => {
    while (true) {
      if (savePromiseRef.current) {
        const inFlightResult = await savePromiseRef.current;
        if (!inFlightResult) return null;
      }

      const event = activeEventRef.current;
      const latestDraft = formRef.current;
      if (!event || !latestDraft) return event;

      const signature = settingsDraftSignature(latestDraft);
      if (signature === lastSavedSignatureRef.current) return event;

      const validationMessage = validateSettingsDraft(latestDraft);
      if (validationMessage) {
        setSaveStatus("waiting");
        if (announceValidation) showToast(validationMessage, { tone: "error", duration: 4200 });
        return null;
      }

      setSaveStatus("saving");
      const request = (async () => {
        try {
          const updated = await updateEvent(event.id, {
            title: latestDraft.title.trim(),
            event_date: latestDraft.date.trim(),
            event_time: latestDraft.time.trim() || null,
            event_timezone: localTimeZone,
            event_location: latestDraft.location.trim() || null,
            event_type: latestDraft.eventType,
            require_rsvp_approval: latestDraft.approval,
            configuration: {
              ...event.configuration,
              invitation_categories_enabled: latestDraft.categoriesEnabled,
              invitation_categories: latestDraft.categories,
            },
          });
          activeEventRef.current = updated;
          setActiveEvent(updated);
          lastSavedSignatureRef.current = signature;
          setLastSavedSignature(signature);
          setSaveStatus(settingsDraftSignature(formRef.current ?? latestDraft) === signature ? "saved" : "pending");
          return updated;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Could not save event settings automatically.";
          setSaveStatus("error");
          showToast(`Settings were not saved: ${message}`, { tone: "error", duration: 4400 });
          return null;
        }
      })();

      savePromiseRef.current = request;
      const result = await request;
      if (savePromiseRef.current === request) savePromiseRef.current = null;
      if (!result) return null;
      if (settingsDraftSignature(formRef.current ?? latestDraft) === lastSavedSignatureRef.current) return result;
    }
  }, [localTimeZone, setActiveEvent, showToast]);

  useEffect(() => {
    if (!hasUnsavedChanges) {
      setSaveStatus((current) => (
        current === "pending" || current === "waiting" || current === "error"
          ? "idle"
          : current
      ));
      return;
    }
    const validationMessage = validateSettingsDraft(draft);
    if (validationMessage) {
      setSaveStatus("waiting");
      return;
    }
    setSaveStatus("pending");
    const timer = setTimeout(() => {
      void flushSettings(false);
    }, 900);
    return () => clearTimeout(timer);
  }, [draft, draftSignature, flushSettings, hasUnsavedChanges]);

  useEffect(() => registerBeforeNavigate(async () => {
    const savedEvent = await flushSettings(true);
    return savedEvent
      ? { allowed: true, event: savedEvent }
      : { allowed: false };
  }), [flushSettings, registerBeforeNavigate]);

  return (
    <>
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={[styles.tabs, { backgroundColor: colors.panel, borderColor: colors.border }]}>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: activeSettingsView === "event" }}
          onPress={() => setActiveSettingsView("event")}
          style={[styles.tab, activeSettingsView === "event" && styles.activeTab]}
        >
          <CalendarDays color={activeSettingsView === "event" ? "#07110f" : colors.muted} size={16} />
          <Text style={[styles.tabText, { color: activeSettingsView === "event" ? "#07110f" : colors.muted }]}>Event settings</Text>
        </Pressable>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: activeSettingsView === "plans" }}
          onPress={async () => {
            const savedEvent = await flushSettings(true);
            if (savedEvent) setActiveSettingsView("plans");
          }}
          style={[styles.tab, activeSettingsView === "plans" && styles.activeTab]}
        >
          <CreditCard color={activeSettingsView === "plans" ? "#07110f" : colors.muted} size={16} />
          <Text style={[styles.tabText, { color: activeSettingsView === "plans" ? "#07110f" : colors.muted }]}>Plans</Text>
        </Pressable>
      </View>

      {activeSettingsView === "event" ? (
        <>
      <Text style={[styles.heading, { color: colors.text }]}>Event settings</Text>
      <Text style={[styles.subheading, { color: colors.muted }]}>Manage the details used across invitations and analytics.</Text>

      <View style={[styles.card, { backgroundColor: colors.panel, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.text }]}>Event name</Text>
        <TextInput value={title} onChangeText={setTitle} style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.input }]} placeholder="Event name" placeholderTextColor={colors.muted} />
        <Text style={[styles.label, { color: colors.text }]}>Event date</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose event date"
          onPress={() => setCalendarOpen(true)}
          style={[styles.inputRow, { borderColor: date ? colors.border : "#dc6262", backgroundColor: colors.input }]}
        >
          <CalendarDays color="#4fd6be" size={18} />
          <View style={styles.dateCopy}>
            <Text style={[styles.dateValue, { color: date ? colors.text : "#dc6262" }]}>{formatDateLong(date)}</Text>
            {!date ? <Text style={styles.required}>Required before opening guests, admins, or analytics</Text> : null}
            {date ? <Text style={[styles.dateStatus, { color: "#4fd6be" }]}>{formatEventCountdown(date)}</Text> : null}
          </View>
          <ChevronRight color={colors.muted} size={17} />
        </Pressable>
        <Text style={[styles.label, { color: colors.text }]}>Start time <Text style={{ color: colors.muted, fontWeight: "400" }}>(optional)</Text></Text>
        <View style={[styles.inputWithIcon, { borderColor: colors.border, backgroundColor: colors.input }]}>
          <Clock3 color="#4fd6be" size={18} />
          <TextInput
            value={time}
            onChangeText={(value) => setTime(normalizeTimeInput(value))}
            keyboardType="number-pad"
            maxLength={5}
            placeholder="18:30"
            placeholderTextColor={colors.muted}
            style={[styles.iconInput, { color: colors.text }]}
          />
        </View>
        <Text style={[styles.timezoneHint, { color: colors.muted }]}>Local time · {localTimeZone}</Text>
        <Text style={[styles.label, { color: colors.text }]}>Location <Text style={{ color: colors.muted, fontWeight: "400" }}>(optional)</Text></Text>
        <View style={[styles.inputWithIcon, { borderColor: colors.border, backgroundColor: colors.input }]}>
          <MapPin color="#4fd6be" size={18} />
          <TextInput
            value={location}
            onChangeText={setLocation}
            maxLength={160}
            placeholder="Venue or address"
            placeholderTextColor={colors.muted}
            style={[styles.iconInput, { color: colors.text }]}
          />
        </View>
        <Text style={[styles.label, { color: colors.text }]}>Event type</Text>
        <View style={styles.typeGrid}>
          {eventTypes.map((item) => {
            const selected = eventType === item.value;
            return (
              <Pressable key={item.value} onPress={() => setEventType(item.value)} style={[styles.typeButton, { borderColor: colors.border, backgroundColor: colors.input }, selected && styles.typeSelected]}>
                <Text style={[styles.typeText, { color: selected ? "#07110f" : colors.muted }]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.panel, borderColor: colors.border }]}>
        <SettingToggle title="RSVP approval" hint="Approve guests before their pass is active." value={approval} onChange={setApproval} colors={colors} />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Pressable accessibilityRole="button" onPress={() => setCategoriesOpen(true)} style={styles.categoryRow}>
          <View style={[styles.categoryIcon, { backgroundColor: colors.input }]}><Tags color="#4fd6be" size={18} /></View>
          <View style={styles.toggleCopy}>
            <Text style={[styles.toggleTitle, { color: colors.text }]}>Invitation categories</Text>
            <Text numberOfLines={1} style={[styles.toggleHint, { color: colors.muted }]}>
              {categoriesEnabled ? categories.join("  /  ") || "No categories added" : "Disabled - hidden from guest passes"}
            </Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: categoriesEnabled ? "#173a32" : colors.input }]}>
            <Text style={[styles.statusText, { color: categoriesEnabled ? "#4fd6be" : colors.muted }]}>{categoriesEnabled ? "Enabled" : "Off"}</Text>
          </View>
          <ChevronRight color={colors.muted} size={17} />
        </Pressable>
      </View>

      <View style={[styles.autoSaveCard, { backgroundColor: colors.panel, borderColor: saveStatus === "error" ? "#dc6262" : colors.border }]}>
        <View style={styles.autoSaveCopy}>
          {saveStatus === "saving" || saveStatus === "pending"
            ? <ActivityIndicator color="#4fd6be" size="small" />
            : <Save color={saveStatus === "error" || saveStatus === "waiting" ? "#dc6262" : "#4fd6be"} size={17} />}
          <View style={styles.autoSaveTextWrap}>
            <Text style={[styles.autoSaveTitle, { color: colors.text }]}>{autoSaveTitle(saveStatus, hasUnsavedChanges)}</Text>
            <Text style={[styles.autoSaveHint, { color: colors.muted }]}>
              {saveStatus === "waiting"
                ? validateSettingsDraft(draft) ?? "Complete the required fields to continue."
                : saveStatus === "error"
                  ? "Your changes are still on this screen. Retry before leaving."
                  : activeEvent?.design_status === "published"
                    ? "You can safely move to another panel."
                    : "Publishing still requires Convert in the Editor."}
            </Text>
          </View>
        </View>
        {saveStatus === "error" ? (
          <Pressable style={styles.retryButton} onPress={() => void flushSettings(true)}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        ) : null}
      </View>
        </>
      ) : activeEvent ? (
        <MobilePlansPanel eventId={activeEvent.id} />
      ) : (
        <Text style={[styles.subheading, { color: colors.muted }]}>Open an event to view its plan usage.</Text>
      )}
    </ScrollView>
    <CalendarPickerModal
      visible={calendarOpen}
      value={date}
      onClose={() => setCalendarOpen(false)}
      onSelect={(value) => { setDate(value); setCalendarOpen(false); }}
    />
    <CategoryEditorModal
      visible={categoriesOpen}
      enabled={categoriesEnabled}
      categories={categories}
      onClose={() => setCategoriesOpen(false)}
      onApply={(enabled, nextCategories) => {
        setCategoriesEnabled(enabled);
        setCategories(nextCategories);
        setCategoriesOpen(false);
      }}
    />
    </>
  );
}

function eventSettingsSignature(event: EventRecord) {
  return settingsDraftSignature({
    title: event.title,
    date: event.event_date?.slice(0, 10) ?? "",
    time: event.event_time?.slice(0, 5) ?? "",
    location: event.event_location ?? "",
    eventType: event.event_type,
    approval: event.require_rsvp_approval !== false,
    categoriesEnabled: event.configuration.invitation_categories_enabled !== false,
    categories: event.configuration.invitation_categories ?? ["General", "VIP"],
  });
}

function settingsDraftSignature(draft: EventSettingsDraft) {
  return JSON.stringify({
    title: draft.title.trim(),
    date: draft.date.trim(),
    time: draft.time.trim(),
    location: draft.location.trim(),
    eventType: draft.eventType,
    approval: draft.approval,
    categoriesEnabled: draft.categoriesEnabled,
    categories: draft.categories,
  });
}

function validateSettingsDraft(draft: EventSettingsDraft) {
  if (!draft.title.trim()) return "Add an event name before leaving Settings.";
  if (!draft.date.trim()) return "Choose an event date before leaving Settings.";
  if (draft.time.trim() && !isValidTime(draft.time.trim())) {
    return "Enter a valid time between 00:00 and 23:59 before leaving Settings.";
  }
  return null;
}

function autoSaveTitle(status: SettingsSaveStatus, hasUnsavedChanges: boolean) {
  if (status === "saving") return "Saving automatically…";
  if (status === "pending") return "Changes queued for autosave";
  if (status === "saved") return "All changes saved";
  if (status === "waiting") return "Autosave is waiting";
  if (status === "error") return "Autosave failed";
  return hasUnsavedChanges ? "Changes not saved yet" : "Changes save automatically";
}

function normalizeTimeInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function isValidTime(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  return Boolean(match && Number(match[1]) <= 23 && Number(match[2]) <= 59);
}

function resolveLocalTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function formatEventCountdown(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const eventDate = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((eventDate.getTime() - today.getTime()) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 0 && days < 31) return `In ${days} days`;
  if (days >= 31) {
    const months = Math.max(1, Math.round(days / 30));
    return `In ${months} ${months === 1 ? "month" : "months"}`;
  }
  return `${Math.abs(days)} days ago`;
}

function SettingToggle({ title, hint, value, onChange, colors }: {
  title: string;
  hint: string;
  value: boolean;
  onChange: (value: boolean) => void;
  colors: { text: string; muted: string };
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleCopy}>
        <Text style={[styles.toggleTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.toggleHint, { color: colors.muted }]}>{hint}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: "#43534f", true: "#2a8c78" }} thumbColor={value ? "#4fd6be" : "#d8dfdd"} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 36 },
  tabs: { marginBottom: 18, padding: 4, borderWidth: 1, borderRadius: 18, flexDirection: "row", gap: 4 },
  tab: { flex: 1, minHeight: 42, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  activeTab: { backgroundColor: "#4fd6be" },
  tabText: { fontSize: 10, fontWeight: "800" },
  heading: { fontSize: 20, fontWeight: "800" },
  subheading: { marginTop: 4, marginBottom: 15, fontSize: 11, lineHeight: 17 },
  card: { marginBottom: 12, padding: 14, borderWidth: 1, borderRadius: 8 },
  label: { marginBottom: 7, fontSize: 11, fontWeight: "700" },
  input: { height: 46, marginBottom: 15, paddingHorizontal: 12, borderWidth: 1, borderRadius: 7, fontSize: 13 },
  inputRow: { height: 46, marginBottom: 15, paddingHorizontal: 12, borderWidth: 1, borderRadius: 7, flexDirection: "row", alignItems: "center", gap: 8 },
  inputWithIcon: { height: 46, marginBottom: 15, paddingHorizontal: 12, borderWidth: 1, borderRadius: 7, flexDirection: "row", alignItems: "center", gap: 8 },
  timezoneHint: { marginTop: -10, marginBottom: 15, fontSize: 9 },
  iconInput: { flex: 1, height: 44, fontSize: 13 },
  dateCopy: { flex: 1, minWidth: 0 },
  dateValue: { fontSize: 11, fontWeight: "700" },
  required: { marginTop: 2, color: "#dc6262", fontSize: 7 },
  dateStatus: { marginTop: 2, fontSize: 8, fontWeight: "700" },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  typeButton: { minHeight: 34, paddingHorizontal: 11, borderWidth: 1, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  typeSelected: { backgroundColor: "#4fd6be", borderColor: "#4fd6be" },
  typeText: { fontSize: 10, fontWeight: "700" },
  toggleRow: { minHeight: 70, flexDirection: "row", alignItems: "center" },
  toggleCopy: { flex: 1, paddingRight: 12 },
  toggleTitle: { fontSize: 13, fontWeight: "700" },
  toggleHint: { marginTop: 4, fontSize: 10, lineHeight: 15 },
  divider: { height: 1 },
  categoryRow: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 9 },
  categoryIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  statusPill: { minHeight: 25, paddingHorizontal: 8, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  statusText: { fontSize: 8, fontWeight: "800" },
  autoSaveCard: { minHeight: 64, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  autoSaveCopy: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10 },
  autoSaveTextWrap: { flex: 1, minWidth: 0 },
  autoSaveTitle: { fontSize: 11, fontWeight: "800" },
  autoSaveHint: { marginTop: 3, fontSize: 9, lineHeight: 13 },
  retryButton: { minHeight: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: "#4fd6be", alignItems: "center", justifyContent: "center" },
  retryText: { color: "#07110f", fontSize: 10, fontWeight: "800" },
});
