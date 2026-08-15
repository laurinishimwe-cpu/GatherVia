import { Pressable, StyleSheet, Text, View } from "react-native";
import { CalendarDays, Trash2 } from "lucide-react-native";
import type { HistoricEventRecord } from "@/lib/types/auth";

const BRAND = "#4fd6be";

interface RecentEventCardProps {
  event: HistoricEventRecord;
  lightMode: boolean;
  onPress: () => void;
  onDelete: () => void;
}

type EventTimingState = "today" | "past" | "missing" | "upcoming";

function getEventTiming(dateValue: string | null): { label: string; state: EventTimingState } {
  if (!dateValue) return { label: "Needs date", state: "missing" };
  const [year, month, day] = dateValue.split("-").map(Number);
  if (!year || !month || !day) {
    return { label: "Needs date", state: "missing" };
  }
  const eventDate = new Date(year, month - 1, day);
  if (
    eventDate.getFullYear() !== year ||
    eventDate.getMonth() !== month - 1 ||
    eventDate.getDate() !== day
  ) {
    return { label: "Needs date", state: "missing" };
  }
  const today = new Date();
  eventDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const days = Math.round((eventDate.getTime() - today.getTime()) / 86_400_000);
  if (days === 0) return { label: "Today", state: "today" };
  if (days === 1) return { label: "In 1 day", state: "upcoming" };
  if (days > 1 && days < 30) return { label: `In ${days} days`, state: "upcoming" };
  if (days >= 30) return { label: `In ${Math.ceil(days / 30)} mo`, state: "upcoming" };
  if (days === -1) return { label: "1 day ago", state: "past" };
  return { label: `${Math.abs(days)} days ago`, state: "past" };
}

function getTimingBadgeColors(state: EventTimingState, lightMode: boolean) {
  if (state === "today") {
    return lightMode
      ? { background: "#daf4ed", border: "#b9e7db", text: "#16816d" }
      : { background: "#173a32", border: "#286050", text: BRAND };
  }
  if (state === "past") {
    return lightMode
      ? { background: "#fff4c7", border: "#eadb9a", text: "#8a6a00" }
      : { background: "#3b3518", border: "#625823", text: "#e3c655" };
  }
  if (state === "missing") {
    return lightMode
      ? { background: "#fde7e8", border: "#f1c3c6", text: "#b7444a" }
      : { background: "#3a1f22", border: "#653237", text: "#f08a8f" };
  }
  return lightMode
    ? { background: "#e9eeec", border: "#d3dedb", text: "#4d766c" }
    : { background: "#26312e", border: "#394a45", text: "#9bc8bd" };
}

function getEventTypeLabel(eventType: HistoricEventRecord["event_type"]) {
  if (eventType === "marriage") return "Wedding";
  return eventType.charAt(0).toUpperCase() + eventType.slice(1);
}

function formatEventDate(dateValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function RecentEventCard({ event, lightMode, onPress, onDelete }: RecentEventCardProps) {
  const timing = getEventTiming(event.event_date);
  const timingColors = getTimingBadgeColors(timing.state, lightMode);
  const colors = lightMode
      ? {
        background: "#ffffff",
        border: "#bad3cc",
        text: "#10211d",
        muted: "#496c63",
        deleteSurface: "#fff0f1",
      }
    : {
        background: "#10221e",
        border: "#32685b",
        text: "#f5f8f7",
        muted: "#b5cbc5",
        deleteSurface: "#321b1e",
      };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${event.title}`}
      onPress={onPress}
      style={({ pressed }) => [styles.cardShell, pressed && styles.pressed]}
    >
      <View
        collapsable={false}
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          styles.cardBackdrop,
          { backgroundColor: colors.background, borderColor: colors.border },
        ]}
      />
      <View style={styles.cardContent}>
        <View style={styles.topRow}>
          <View style={styles.typeRow}>
            <View style={styles.typeDot} />
            <Text style={styles.eventType}>
              {getEventTypeLabel(event.event_type)}
            </Text>
          </View>
          <View
            style={[
              styles.badge,
              { backgroundColor: timingColors.background, borderColor: timingColors.border },
            ]}
          >
            <Text style={[styles.badgeText, { color: timingColors.text }]}>
              {timing.label}
            </Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Delete ${event.title}`}
          hitSlop={6}
          style={[styles.deleteButton, { backgroundColor: colors.deleteSurface }]}
          onPress={(pressEvent) => {
            pressEvent.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 color="#df6666" size={14} strokeWidth={2.2} />
        </Pressable>

        <Text numberOfLines={2} style={[styles.title, { color: colors.text }]}>
          {event.title || "Untitled event"}
        </Text>

        <View style={styles.metaRow}>
          <CalendarDays color={colors.muted} size={14} />
          <Text style={[styles.date, { color: colors.muted }]}>
            {event.event_date ? formatEventDate(event.event_date) : "Date not set"}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardShell: {
    width: 210,
    height: 126,
    flexShrink: 0,
  },
  cardBackdrop: {
    borderRadius: 9,
    borderWidth: 1.5,
  },
  cardContent: {
    flex: 1,
    zIndex: 1,
    position: "relative",
    marginHorizontal: 13,
    marginVertical: 11,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingRight: 35,
  },
  typeRow: { maxWidth: 76, flexDirection: "row", alignItems: "center", gap: 6 },
  typeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: BRAND },
  eventType: { maxWidth: 64, color: BRAND, fontSize: 9, fontWeight: "800" },
  badge: { maxWidth: 84, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 11, borderWidth: 1 },
  badgeText: { fontSize: 9, fontWeight: "700" },
  title: {
    width: "100%",
    marginTop: 13,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "800",
  },
  metaRow: { marginTop: "auto", flexDirection: "row", alignItems: "center" },
  date: { marginLeft: 6, flexShrink: 1, fontSize: 10, fontWeight: "600" },
  deleteButton: { position: "absolute", top: -1, right: 0, width: 29, height: 29, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
});
