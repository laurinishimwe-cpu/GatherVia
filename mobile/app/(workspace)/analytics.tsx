import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { AlertTriangle, ArrowDownLeft, Clock3, RefreshCw, TrendingUp, UsersRound } from "lucide-react-native";
import Svg, { Circle, G, Line, Rect, Text as SvgText } from "react-native-svg";
import { useEvent } from "@/context/EventContext";
import { useThemeMode } from "@/context/ThemeContext";
import { fetchEventAnalytics } from "@/lib/api/guests";
import type { EventAnalytics } from "@/lib/types/guest";

const CYAN = "#4fd6be";
const ORANGE = "#f3a44b";
const RED = "#e66d72";
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type ThemeColors = {
  background: string;
  panel: string;
  border: string;
  text: string;
  muted: string;
  soft: string;
  grid: string;
};

export default function AnalyticsScreen() {
  const { activeEvent } = useEvent();
  const { resolvedMode } = useThemeMode();
  const { width: windowWidth } = useWindowDimensions();
  const light = resolvedMode === "light";
  const colors: ThemeColors = light
    ? { background: "#f4f7f6", panel: "#ffffff", border: "#bad3cc", text: "#10211d", muted: "#657772", soft: "#edf4f2", grid: "#d9e6e2" }
    : { background: "#07110f", panel: "#10221e", border: "#32685b", text: "#f5f8f7", muted: "#89a099", soft: "#0b1916", grid: "#24483f" };
  const [data, setData] = useState<EventAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (refresh = false) => {
    if (!activeEvent) return;
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      setData(await fetchEventAnalytics(activeEvent.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load analytics.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeEvent]);

  useEffect(() => { void load(); }, [load]);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={CYAN} />}
    >
      <View style={styles.headingRow}>
        <View><Text style={[styles.heading, { color: colors.text }]}>Analytics</Text><Text style={[styles.hint, { color: colors.muted }]}>Live attendance and invitation insights.</Text></View>
        <Pressable accessibilityLabel="Refresh analytics" style={[styles.refresh, { borderColor: colors.border }]} onPress={() => load(true)}><RefreshCw color={CYAN} size={17} /></Pressable>
      </View>

      {loading ? <ActivityIndicator color={CYAN} style={styles.loader} /> : error ? <Text style={styles.error}>{error}</Text> : data ? (
        <AnalyticsContent data={data} colors={colors} chartViewportWidth={Math.max(280, windowWidth - 60)} />
      ) : null}
    </ScrollView>
  );
}

function AnalyticsContent({ data, colors, chartViewportWidth }: { data: EventAnalytics; colors: ThemeColors; chartViewportWidth: number }) {
  const percentage = Math.max(0, Math.min(100, Math.round(data.summary.completion_rate)));
  const timeline = useMemo(() => {
    const activeGuests = Math.max(data.summary.total - data.summary.rejected, 0);
    let arrived = 0;
    return data.checkInTimeline.map((item) => {
      arrived += item.count;
      return { hour: item.hour, checkedIn: item.count, pending: Math.max(activeGuests - arrived, 0) };
    });
  }, [data.checkInTimeline, data.summary.rejected, data.summary.total]);

  return <>
    <View style={[styles.attendanceCard, { backgroundColor: colors.panel, borderColor: colors.border }]}>
      <AttendanceRing percentage={percentage} colors={colors} />
      <View style={styles.attendanceCopy}>
        <View style={styles.eyebrowRow}><TrendingUp color={CYAN} size={14} /><Text style={[styles.eyebrow, { color: colors.muted }]}>ATTENDANCE RATE</Text></View>
        <Text style={[styles.attendanceTitle, { color: colors.text }]}>{data.summary.checked_in} of {data.summary.total} guests</Text>
        <Text style={[styles.attendanceHint, { color: colors.muted }]}>Guests who have arrived and checked in.</Text>
      </View>
    </View>

    <View style={styles.metricsRow}>
      <Metric label="Checked in" value={data.summary.checked_in} accent={CYAN} colors={colors} />
      <Metric label="Pending" value={data.summary.pending} accent={ORANGE} colors={colors} />
      <Metric label="Rejected" value={data.summary.rejected} accent={RED} colors={colors} />
    </View>

    <View style={[styles.card, { backgroundColor: colors.panel, borderColor: colors.border }]}>
      <View style={styles.cardHeaderRow}><View><Text style={[styles.cardTitle, { color: colors.text }]}>Arrivals by hour</Text><Text style={[styles.cardHint, { color: colors.muted }]}>Hourly arrivals and remaining invitations</Text></View><UsersRound color={CYAN} size={18} /></View>
      <View style={styles.legend}><Legend color={CYAN} label="Checked in" colors={colors} /><Legend color={ORANGE} label="Pending" colors={colors} /></View>
      {timeline.length ? <HourlyBarChart data={timeline} viewportWidth={chartViewportWidth} colors={colors} /> : <View style={styles.chartEmpty}><Clock3 color={colors.muted} size={22} /><Text style={[styles.emptyText, { color: colors.muted }]}>Hourly activity will appear after the first scan.</Text></View>}
    </View>

    <ActivityCard title="Recent activity" entries={data.recentActivity.slice(0, 8)} colors={colors} />
    {data.duplicateAttempts.length ? <ActivityCard title="Duplicate scan attempts" entries={data.duplicateAttempts} colors={colors} duplicate /> : null}
  </>;
}

function AttendanceRing({ percentage, colors }: { percentage: number; colors: ThemeColors }) {
  const progress = useRef(new Animated.Value(0)).current;
  const size = 116;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, { toValue: percentage, duration: 850, useNativeDriver: false }).start();
  }, [percentage, progress]);

  const dashOffset = progress.interpolate({ inputRange: [0, 100], outputRange: [circumference, 0] });
  return <View style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={size / 2} cy={size / 2} r={radius} stroke={colors.soft} strokeWidth={stroke} fill="none" />
      <AnimatedCircle cx={size / 2} cy={size / 2} r={radius} stroke={CYAN} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={dashOffset} rotation="-90" origin={`${size / 2}, ${size / 2}`} />
    </Svg>
    <View style={styles.ringLabel}><AnimatedPercent progress={progress} /><Text style={[styles.ringCaption, { color: colors.muted }]}>ARRIVED</Text></View>
  </View>;
}

function AnimatedPercent({ progress }: { progress: Animated.Value }) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const id = progress.addListener(({ value: next }) => setValue(Math.round(next)));
    return () => progress.removeListener(id);
  }, [progress]);
  return <Text style={styles.ringValue}>{value}%</Text>;
}

function HourlyBarChart({ data, viewportWidth, colors }: { data: { hour: string; checkedIn: number; pending: number }[]; viewportWidth: number; colors: ThemeColors }) {
  const left = 28;
  const top = 12;
  const plotHeight = 130;
  const baseline = top + plotHeight;
  const groupWidth = 58;
  const width = Math.max(viewportWidth, left + data.length * groupWidth + 12);
  const maxValue = Math.max(1, ...data.flatMap((item) => [item.checkedIn, item.pending]));
  const ticks = [maxValue, Math.ceil(maxValue / 2), 0];

  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chartScroll}>
    <Svg width={width} height={178}>
      {ticks.map((tick, index) => {
        const y = top + (index * plotHeight) / 2;
        return <Line key={`line-${tick}-${index}`} x1={left} x2={width - 6} y1={y} y2={y} stroke={colors.grid} strokeWidth={1} strokeDasharray="3 5" />;
      })}
      {ticks.map((tick, index) => <SvgText key={`label-${tick}-${index}`} x={left - 6} y={top + (index * plotHeight) / 2 + 3} fill={colors.muted} fontSize="8" textAnchor="end">{tick}</SvgText>)}
      {data.map((item, index) => {
        const center = left + index * groupWidth + groupWidth / 2;
        const checkedHeight = (item.checkedIn / maxValue) * plotHeight;
        const pendingHeight = (item.pending / maxValue) * plotHeight;
        return <G key={item.hour}>
          <Rect x={center - 15} y={baseline - checkedHeight} width={12} height={Math.max(checkedHeight, item.checkedIn ? 3 : 0)} rx={4} fill={CYAN} />
          <Rect x={center + 3} y={baseline - pendingHeight} width={12} height={Math.max(pendingHeight, item.pending ? 3 : 0)} rx={4} fill={ORANGE} />
          <SvgText x={center} y={baseline + 19} fill={colors.muted} fontSize="8" textAnchor="middle">{item.hour}</SvgText>
        </G>;
      })}
    </Svg>
  </ScrollView>;
}

function Metric({ label, value, accent, colors }: { label: string; value: number; accent: string; colors: ThemeColors }) {
  return <View style={[styles.metric, { backgroundColor: colors.panel, borderColor: colors.border }]}><View style={[styles.metricMarker, { backgroundColor: accent }]} /><Text style={[styles.metricValue, { color: accent }]}>{value}</Text><Text style={[styles.metricLabel, { color: colors.muted }]}>{label}</Text></View>;
}

function Legend({ color, label, colors }: { color: string; label: string; colors: ThemeColors }) {
  return <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: color }]} /><Text style={[styles.legendLabel, { color: colors.muted }]}>{label}</Text></View>;
}

type ActivityEntry = EventAnalytics["recentActivity"][number];
function ActivityCard({ title, entries, colors, duplicate = false }: { title: string; entries: ActivityEntry[]; colors: ThemeColors; duplicate?: boolean }) {
  const accent = duplicate ? RED : CYAN;
  return <View style={[styles.card, { backgroundColor: duplicate ? (colors.background === "#07110f" ? "#211113" : "#fff6f6") : colors.panel, borderColor: duplicate ? "#6b3033" : colors.border }]}>
    <View style={styles.cardHeaderRow}><Text style={[styles.cardTitle, { color: duplicate ? accent : colors.text }]}>{title}</Text>{duplicate ? <AlertTriangle color={RED} size={18} /> : <ArrowDownLeft color={CYAN} size={18} />}</View>
    {entries.length === 0 ? <Text style={[styles.emptyText, { color: colors.muted }]}>No recent activity.</Text> : entries.map((entry, index) => (
      <View key={`${entry.id}-${entry.timestamp}-${index}`} style={[styles.activity, index < entries.length - 1 && { borderBottomColor: duplicate ? "#6b3033" : colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
        <View style={[styles.activityIcon, { backgroundColor: duplicate ? "#472423" : "#173a32" }]}>{duplicate ? <AlertTriangle color={RED} size={14} /> : <ArrowDownLeft color={CYAN} size={14} />}</View>
        <View style={styles.activityCopy}><Text style={[styles.activityName, { color: colors.text }]} numberOfLines={1}>{entry.guest_name}</Text><Text style={[styles.activityAction, { color: colors.muted }]} numberOfLines={1}>{duplicate ? "Duplicate scan rejected" : entry.action} · {entry.category}</Text></View>
        <View style={styles.activityTimeCopy}><Text style={[styles.activityTime, { color: colors.text }]}>{new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text><Text style={[styles.activityDay, { color: colors.muted }]}>{new Date(entry.timestamp).toLocaleDateString([], { day: "numeric", month: "short" })}</Text></View>
      </View>
    ))}
  </View>;
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 36 }, headingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, heading: { fontSize: 20, fontWeight: "800" }, hint: { marginTop: 4, fontSize: 10 }, refresh: { width: 38, height: 38, borderWidth: 1, borderRadius: 19, alignItems: "center", justifyContent: "center" }, loader: { marginTop: 70 }, error: { marginTop: 30, color: RED, textAlign: "center", fontSize: 11 },
  attendanceCard: { minHeight: 148, marginTop: 14, padding: 14, borderWidth: 1.5, borderRadius: 9, flexDirection: "row", alignItems: "center" }, attendanceCopy: { flex: 1, minWidth: 0, marginLeft: 16 }, eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 6 }, eyebrow: { fontSize: 7, fontWeight: "800" }, attendanceTitle: { marginTop: 9, fontSize: 17, fontWeight: "800" }, attendanceHint: { marginTop: 5, fontSize: 9, lineHeight: 13 }, ringLabel: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" }, ringValue: { color: CYAN, fontSize: 22, fontWeight: "800" }, ringCaption: { marginTop: 1, fontSize: 6, fontWeight: "800" },
  metricsRow: { marginTop: 9, flexDirection: "row", gap: 7 }, metric: { flex: 1, minHeight: 76, padding: 10, borderWidth: 1, borderRadius: 8 }, metricMarker: { width: 16, height: 3, borderRadius: 2 }, metricValue: { marginTop: 8, fontSize: 20, fontWeight: "800" }, metricLabel: { marginTop: 3, fontSize: 8, fontWeight: "700" },
  card: { marginTop: 12, padding: 14, borderWidth: 1.5, borderRadius: 9 }, cardHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, cardTitle: { fontSize: 13, fontWeight: "800" }, cardHint: { marginTop: 3, fontSize: 8 }, legend: { marginTop: 12, flexDirection: "row", gap: 16 }, legendItem: { flexDirection: "row", alignItems: "center" }, legendDot: { width: 8, height: 8, borderRadius: 4 }, legendLabel: { marginLeft: 5, fontSize: 8 }, chartScroll: { paddingTop: 8 }, chartEmpty: { height: 150, alignItems: "center", justifyContent: "center" }, emptyText: { marginTop: 8, fontSize: 9, textAlign: "center" },
  activity: { minHeight: 62, flexDirection: "row", alignItems: "center" }, activityIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" }, activityCopy: { flex: 1, minWidth: 0, marginLeft: 9 }, activityName: { fontSize: 10, fontWeight: "800" }, activityAction: { marginTop: 3, fontSize: 7, textTransform: "capitalize" }, activityTimeCopy: { marginLeft: 7, alignItems: "flex-end" }, activityTime: { fontSize: 8, fontWeight: "700" }, activityDay: { marginTop: 2, fontSize: 7 },
});
