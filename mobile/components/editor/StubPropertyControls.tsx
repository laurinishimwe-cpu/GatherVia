import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ColourControls, NumberControls } from "@/components/editor/LayerPropertyControls";
import { getStubDetailsTopMaximum, getStubGuestTopMaximum, getStubQrBottomRange, clampStubValue } from "@/lib/flyer/stubGeometry";
import type { FlyerConfiguration } from "@/lib/types/flyer";
import { BUNDLED_FONT_FAMILY_NAMES } from "@/lib/flyer/fontRegistry";

export type StubPropertySheetKind =
  | "stub-background" | "stub-text" | "stub-accent" | "stub-shadow"
  | "stub-name" | "stub-font" | "stub-name-size" | "stub-guest-position" | "stub-category"
  | "stub-details-visibility" | "stub-details-icon" | "stub-details-position"
  | "stub-qr-frame" | "stub-qr-size" | "stub-qr-position";

export function initialStubPropertyPatch(kind: StubPropertySheetKind, config: FlyerConfiguration): Partial<FlyerConfiguration> {
  if (kind === "stub-background") return { stub_background_color: config.stub_background_color };
  if (kind === "stub-text") return { stub_text_color: config.stub_text_color };
  if (kind === "stub-accent") return { stub_accent_color: config.stub_accent_color };
  if (kind === "stub-shadow") return {
    stub_curve_shadow_color: config.stub_curve_shadow_color,
    stub_curve_shadow_opacity: config.stub_curve_shadow_opacity,
    stub_curve_shadow_blur: config.stub_curve_shadow_blur,
    stub_curve_shadow_offset: config.stub_curve_shadow_offset,
  };
  if (kind === "stub-name") return { stub_guest_name_mode: config.stub_guest_name_mode };
  if (kind === "stub-font") return {
    stub_guest_font_family: config.stub_guest_font_family,
    stub_guest_font_weight: config.stub_guest_font_weight,
    stub_guest_font_style: config.stub_guest_font_style,
  };
  if (kind === "stub-name-size") return { stub_guest_name_font_size: config.stub_guest_name_font_size };
  if (kind === "stub-guest-position") return { stub_guest_info_left: config.stub_guest_info_left, stub_guest_info_top: config.stub_guest_info_top };
  if (kind === "stub-category") return { stub_show_guest_category: config.stub_show_guest_category };
  if (kind === "stub-details-visibility") return {
    stub_show_event_date: config.stub_show_event_date,
    stub_show_event_time: config.stub_show_event_time,
    stub_show_event_location: config.stub_show_event_location,
  };
  if (kind === "stub-details-icon") return { stub_event_details_icon_color: config.stub_event_details_icon_color };
  if (kind === "stub-details-position") return { stub_event_details_left: config.stub_event_details_left, stub_event_details_top: config.stub_event_details_top };
  if (kind === "stub-qr-frame") return { qr_foreground_color: config.qr_foreground_color };
  if (kind === "stub-qr-size") return { stub_qr_size: config.stub_qr_size, stub_qr_right: config.stub_qr_right, stub_qr_bottom: config.stub_qr_bottom };
  return { stub_qr_right: config.stub_qr_right, stub_qr_bottom: config.stub_qr_bottom };
}

export function StubPropertyControls({
  kind,
  configuration,
  onPatch,
  onValidityChange,
}: {
  kind: StubPropertySheetKind;
  configuration: FlyerConfiguration;
  onPatch: (patch: Partial<FlyerConfiguration>) => void;
  onValidityChange: (valid: boolean) => void;
}) {
  const [validity, setValidity] = useState<Record<string, boolean>>({});
  const validityKey = JSON.stringify(validity);
  useEffect(() => onValidityChange(Object.values(validity).every(Boolean)), [onValidityChange, validityKey]);
  const markValidity = useCallback((key: string) => (valid: boolean) => setValidity((current) => current[key] === valid ? current : { ...current, [key]: valid }), []);

  if (kind === "stub-background" || kind === "stub-text" || kind === "stub-accent" || kind === "stub-details-icon" || kind === "stub-qr-frame") {
    const field = kind === "stub-background" ? "stub_background_color"
      : kind === "stub-text" ? "stub_text_color"
      : kind === "stub-accent" ? "stub_accent_color"
      : kind === "stub-details-icon" ? "stub_event_details_icon_color"
      : "qr_foreground_color";
    const label = kind === "stub-qr-frame" ? "QR outer frame colour" : kind === "stub-details-icon" ? "Detail icon colour" : kind.replace("stub-", "Stub ").replace("-", " ");
    return <View style={styles.section}>
      <ColourControls label={label} value={configuration[field]} allowAlpha={false} onChange={(value) => onPatch({ [field]: value })} onValidityChange={markValidity(field)} />
      {kind === "stub-qr-frame" ? <Text style={styles.secureNote}>For reliable scanning, the secure QR itself always stays black on white. This setting changes only its outer frame and the “Via” accent.</Text> : null}
    </View>;
  }

  if (kind === "stub-shadow") return <View style={styles.section}>
    <ColourControls label="Curve shadow colour" value={configuration.stub_curve_shadow_color} allowAlpha={false} onChange={(value) => onPatch({ stub_curve_shadow_color: value })} onValidityChange={markValidity("shadow-color")} />
    <NumberControls label="Shadow opacity" value={configuration.stub_curve_shadow_opacity} minimum={0} maximum={100} step={5} unit="%" onChange={(value) => onPatch({ stub_curve_shadow_opacity: value })} onValidityChange={markValidity("shadow-opacity")} />
    <NumberControls label="Shadow blur" value={configuration.stub_curve_shadow_blur} minimum={0} maximum={60} step={1} unit="px" onChange={(value) => onPatch({ stub_curve_shadow_blur: value })} onValidityChange={markValidity("shadow-blur")} />
    <NumberControls label="Shadow offset" value={configuration.stub_curve_shadow_offset} minimum={-30} maximum={60} step={1} unit="px" onChange={(value) => onPatch({ stub_curve_shadow_offset: value })} onValidityChange={markValidity("shadow-offset")} />
  </View>;

  if (kind === "stub-name") return <ChoiceGroup label="Guest-name display" options={["first", "full"]} value={configuration.stub_guest_name_mode} onChange={(value) => onPatch({ stub_guest_name_mode: value as FlyerConfiguration["stub_guest_name_mode"] })} />;

  if (kind === "stub-font") return <View style={styles.section}>
    <ChoiceGroup label="Font family" options={BUNDLED_FONT_FAMILY_NAMES} value={configuration.stub_guest_font_family} onChange={(value) => onPatch({ stub_guest_font_family: value })} />
    <ChoiceGroup label="Weight" options={["normal", "medium", "semibold", "bold"]} value={configuration.stub_guest_font_weight} onChange={(value) => onPatch({ stub_guest_font_weight: value as FlyerConfiguration["stub_guest_font_weight"] })} />
    <ChoiceGroup label="Style" options={["normal", "italic"]} value={configuration.stub_guest_font_style} onChange={(value) => onPatch({ stub_guest_font_style: value as FlyerConfiguration["stub_guest_font_style"] })} />
  </View>;

  if (kind === "stub-name-size") return <NumberControls label="Guest-name size" value={configuration.stub_guest_name_font_size} minimum={12} maximum={48} step={1} unit="px" presets={[18, 22, 28, 36]} onChange={(value) => onPatch({ stub_guest_name_font_size: value })} onValidityChange={markValidity("name-size")} />;

  if (kind === "stub-guest-position") return <View style={styles.section}>
    <NumberControls label="Guest left" value={configuration.stub_guest_info_left} minimum={0} maximum={36} step={0.5} unit="%" onChange={(value) => onPatch({ stub_guest_info_left: value })} onValidityChange={markValidity("guest-left")} />
    <NumberControls label="Guest top" value={configuration.stub_guest_info_top} minimum={0} maximum={getStubGuestTopMaximum(configuration)} step={0.5} unit="%" onChange={(value) => onPatch({ stub_guest_info_top: value })} onValidityChange={markValidity("guest-top")} />
  </View>;

  if (kind === "stub-category") return <ToggleRows rows={[{ label: "Show guest category", value: configuration.stub_show_guest_category, field: "stub_show_guest_category" }]} onPatch={onPatch} />;

  if (kind === "stub-details-visibility") return <ToggleRows rows={[
    { label: "Show event date", value: configuration.stub_show_event_date, field: "stub_show_event_date" },
    { label: "Show event time", value: configuration.stub_show_event_time, field: "stub_show_event_time" },
    { label: "Show event location", value: configuration.stub_show_event_location, field: "stub_show_event_location" },
  ]} onPatch={onPatch} />;

  if (kind === "stub-details-position") return <View style={styles.section}>
    <NumberControls label="Details left" value={configuration.stub_event_details_left} minimum={0} maximum={56} step={0.5} unit="%" onChange={(value) => onPatch({ stub_event_details_left: value })} onValidityChange={markValidity("details-left")} />
    <NumberControls label="Details top" value={configuration.stub_event_details_top} minimum={0} maximum={getStubDetailsTopMaximum(configuration)} step={0.5} unit="%" onChange={(value) => onPatch({ stub_event_details_top: value })} onValidityChange={markValidity("details-top")} />
  </View>;

  if (kind === "stub-qr-size") return <View style={styles.section}>
    <NumberControls label="QR size" value={configuration.stub_qr_size} minimum={10} maximum={36} step={0.5} unit="%" presets={[18, 24, 30, 36]} onChange={(value) => {
      const range = getStubQrBottomRange(value);
      onPatch({
        stub_qr_size: value,
        stub_qr_right: clampStubValue(configuration.stub_qr_right, 0, 100 - value),
        stub_qr_bottom: clampStubValue(configuration.stub_qr_bottom, range.minimum, range.maximum),
      });
    }} onValidityChange={markValidity("qr-size")} />
    <Text style={styles.secureNote}>Sizing preserves the fixed black/white QR payload and its quiet inner area.</Text>
  </View>;

  const bottomRange = getStubQrBottomRange(configuration.stub_qr_size);
  return <View style={styles.section}>
    <NumberControls label="QR right" value={configuration.stub_qr_right} minimum={0} maximum={100 - configuration.stub_qr_size} step={0.5} unit="%" onChange={(value) => onPatch({ stub_qr_right: value })} onValidityChange={markValidity("qr-right")} />
    <NumberControls label="QR bottom" value={Math.max(configuration.stub_qr_bottom, bottomRange.minimum)} minimum={bottomRange.minimum} maximum={bottomRange.maximum} step={0.5} unit="%" onChange={(value) => onPatch({ stub_qr_bottom: value })} onValidityChange={markValidity("qr-bottom")} />
  </View>;
}

function ChoiceGroup({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (value: string) => void }) {
  return <View style={styles.section}><Text style={styles.label}>{label}</Text><View style={styles.choices}>{options.map((option) => <Pressable key={option} onPress={() => onChange(option)} style={({ pressed }) => [styles.choice, option === value && styles.selectedChoice, pressed && styles.pressed]}><Text style={[styles.choiceText, option === value && styles.selectedChoiceText]}>{option}</Text></Pressable>)}</View></View>;
}

function ToggleRows({ rows, onPatch }: { rows: Array<{ label: string; value: boolean; field: keyof FlyerConfiguration }>; onPatch: (patch: Partial<FlyerConfiguration>) => void }) {
  return <View style={styles.section}>{rows.map((row) => <Pressable key={row.field} accessibilityRole="switch" accessibilityState={{ checked: row.value }} onPress={() => onPatch({ [row.field]: !row.value })} style={({ pressed }) => [styles.toggleRow, pressed && styles.pressed]}><Text style={styles.toggleText}>{row.label}</Text><View style={[styles.switchTrack, row.value && styles.switchTrackOn]}><View style={[styles.switchThumb, row.value && styles.switchThumbOn]} /></View></Pressable>)}</View>;
}

const styles = StyleSheet.create({
  section: { gap: 14 },
  label: { color: "#dce8e5", fontSize: 12, fontWeight: "800" },
  secureNote: { color: "#9bb0aa", fontSize: 11, lineHeight: 17, padding: 10, borderRadius: 10, backgroundColor: "#0a1815" },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: { minHeight: 42, minWidth: 78, paddingHorizontal: 13, borderRadius: 10, borderWidth: 1, borderColor: "#326052", alignItems: "center", justifyContent: "center", backgroundColor: "#17332c" },
  selectedChoice: { borderColor: "#4fd6be", backgroundColor: "#20463c" },
  choiceText: { color: "#dce8e5", fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
  selectedChoiceText: { color: "#79e4d0" },
  toggleRow: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: "#326052", backgroundColor: "#0a1815" },
  toggleText: { flex: 1, color: "#dce8e5", fontSize: 12, fontWeight: "700" },
  switchTrack: { width: 46, height: 26, padding: 3, borderRadius: 13, backgroundColor: "#36534c" },
  switchTrackOn: { backgroundColor: "#4fd6be" },
  switchThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#ffffff" },
  switchThumbOn: { alignSelf: "flex-end" },
  pressed: { opacity: 0.66 },
});
