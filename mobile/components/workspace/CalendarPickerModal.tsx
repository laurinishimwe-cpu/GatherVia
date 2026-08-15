import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronLeft, ChevronRight, X } from "lucide-react-native";
import { useThemeMode } from "@/context/ThemeContext";

interface CalendarPickerModalProps {
  visible: boolean;
  value: string;
  onClose: () => void;
  onSelect: (value: string) => void;
}

export function CalendarPickerModal({ visible, value, onClose, onSelect }: CalendarPickerModalProps) {
  const entrance = useRef(new Animated.Value(0)).current;
  const selectedDate = parseDate(value);
  const [month, setMonth] = useState(() => startOfMonth(selectedDate ?? new Date()));
  const { resolvedMode } = useThemeMode();
  const light = resolvedMode === "light";
  const colors = light
    ? { card: "#ffffff", panel: "#f4f7f6", border: "#d5e2de", text: "#10211d", muted: "#657772" }
    : { card: "#0b1815", panel: "#10221e", border: "#285046", text: "#f5f8f7", muted: "#89a099" };
  const days = useMemo(() => buildDays(month), [month]);

  useEffect(() => {
    if (!visible) return;
    setMonth(startOfMonth(parseDate(value) ?? new Date()));
    entrance.setValue(0);
    Animated.timing(entrance, {
      toValue: 1,
      duration: 120,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [entrance, value, visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
            {
              opacity: entrance,
              transform: [
                { translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
                { scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) },
              ],
            },
          ]}
        >
          <View style={styles.header}>
            <View><Text style={[styles.title, { color: colors.text }]}>Event date</Text><Text style={[styles.subtitle, { color: colors.muted }]}>Required for guests and analytics</Text></View>
            <Pressable accessibilityLabel="Close calendar" style={[styles.close, { borderColor: colors.border }]} onPress={onClose}><X color={colors.muted} size={17} /></Pressable>
          </View>
          <View style={[styles.calendar, { backgroundColor: colors.panel, borderColor: colors.border }]}>
            <View style={styles.monthRow}>
              <Pressable accessibilityLabel="Previous month" style={[styles.monthButton, { borderColor: colors.border }]} onPress={() => setMonth(addMonths(month, -1))}><ChevronLeft color={colors.text} size={18} /></Pressable>
              <Text style={[styles.monthTitle, { color: colors.text }]}>{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</Text>
              <Pressable accessibilityLabel="Next month" style={[styles.monthButton, { borderColor: colors.border }]} onPress={() => setMonth(addMonths(month, 1))}><ChevronRight color={colors.text} size={18} /></Pressable>
            </View>
            <View style={styles.weekRow}>{["S", "M", "T", "W", "T", "F", "S"].map((day, index) => <Text key={`${day}-${index}`} style={[styles.weekDay, { color: colors.muted }]}>{day}</Text>)}</View>
            <View style={styles.daysGrid}>
              {days.map((date) => {
                const dateValue = formatDate(date);
                const selected = value === dateValue;
                const today = formatDate(new Date()) === dateValue;
                const currentMonth = date.getMonth() === month.getMonth();
                return (
                  <View key={dateValue} style={styles.daySlot}>
                    <Pressable
                      onPress={() => onSelect(dateValue)}
                      style={[
                        styles.day,
                        today && { borderColor: "#4fd6be", borderWidth: 1 },
                        selected && styles.selectedDay,
                      ]}
                    >
                      <Text style={[styles.dayText, { color: currentMonth ? colors.text : colors.muted }, selected && styles.selectedDayText]}>{date.getDate()}</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </View>
          <Pressable style={styles.todayButton} onPress={() => onSelect(formatDate(new Date()))}><Text style={styles.todayText}>Choose today</Text></Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

export function formatDateLong(value: string) {
  const date = parseDate(value);
  return date ? date.toLocaleDateString(undefined, { weekday: "short", month: "long", day: "numeric", year: "numeric" }) : "Choose an event date";
}

function parseDate(value: string) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  return year && month && day ? new Date(year, month - 1, day) : null;
}

function formatDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function startOfMonth(date: Date) { return new Date(date.getFullYear(), date.getMonth(), 1); }
function addMonths(date: Date, amount: number) { return new Date(date.getFullYear(), date.getMonth() + amount, 1); }
function buildDays(month: Date) {
  const start = startOfMonth(month);
  const first = new Date(start);
  first.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(first);
    date.setDate(first.getDate() + index);
    return date;
  });
}

const styles = StyleSheet.create({
  overlay: { flex: 1, padding: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0, 0, 0, 0.66)" },
  card: { width: "100%", maxWidth: 430, padding: 16, borderRadius: 8, borderWidth: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 17, fontWeight: "800" },
  subtitle: { marginTop: 3, fontSize: 9 },
  close: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  calendar: { marginTop: 14, padding: 10, borderRadius: 8, borderWidth: 1 },
  monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  monthButton: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  monthTitle: { fontSize: 12, fontWeight: "800" },
  weekRow: { marginTop: 12, flexDirection: "row" },
  weekDay: { width: "14.285%", textAlign: "center", fontSize: 9, fontWeight: "800" },
  daysGrid: { marginTop: 5, flexDirection: "row", flexWrap: "wrap" },
  daySlot: { width: "14.285%", aspectRatio: 1, padding: 2 },
  day: { flex: 1, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  selectedDay: { backgroundColor: "#4fd6be", borderColor: "#4fd6be" },
  dayText: { fontSize: 10, fontWeight: "700" },
  selectedDayText: { color: "#07110f" },
  todayButton: { minHeight: 42, marginTop: 13, borderRadius: 21, backgroundColor: "#4fd6be", alignItems: "center", justifyContent: "center" },
  todayText: { color: "#07110f", fontSize: 11, fontWeight: "800" },
});
