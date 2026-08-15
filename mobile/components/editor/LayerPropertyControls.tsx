import { useEffect, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type GestureResponderEvent,
} from "react-native";
import type { CanvasLayer } from "@/lib/types/canvas";
import { useThemeMode } from "@/context/ThemeContext";
import {
  BUNDLED_FONT_FAMILIES,
  normalizeFontFamily,
  resolveMobileFontFace,
} from "@/lib/flyer/fontRegistry";

const COLOUR_PRESETS = [
  "#FFFFFF",
  "#10211D",
  "#4FD6BE",
  "#3A7E94",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
];

const HEX_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const DARK_THEME = {
  text: "#dce8e5",
  heading: "#f5f8f7",
  muted: "#9bb0aa",
  subtle: "#78918b",
  border: "#326052",
  separator: "#24483f",
  input: "#0a1815",
  control: "#17332c",
  selected: "#20463c",
  dangerSurface: "#39191c",
  dangerBorder: "#8d353b",
};

const LIGHT_THEME = {
  text: "#18332d",
  heading: "#10211d",
  muted: "#657772",
  subtle: "#71837e",
  border: "#b8d8d0",
  separator: "#d8e7e3",
  input: "#ffffff",
  control: "#f4f8f6",
  selected: "#dff6f0",
  dangerSurface: "#fff0f1",
  dangerBorder: "#efc1c5",
};

function useControlTheme() {
  const { resolvedMode } = useThemeMode();
  return resolvedMode === "light" ? LIGHT_THEME : DARK_THEME;
}

export function isGradientPaint(value: string | undefined) {
  return Boolean(value && /gradient\s*\(/i.test(value));
}

export function normalizeHexColour(value: string) {
  const trimmed = value.trim();
  if (!HEX_PATTERN.test(trimmed)) return null;
  if (trimmed.length === 4) {
    const [, red, green, blue] = trimmed;
    return `#${red}${red}${green}${green}${blue}${blue}`.toUpperCase();
  }
  return trimmed.toUpperCase();
}

export function TextEditControls({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const theme = useControlTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.label, { color: theme.text }]}>Content</Text>
      <TextInput
        accessibilityLabel="Text content"
        autoFocus
        multiline
        value={value}
        onChangeText={onChange}
        placeholder="Invitation text"
        placeholderTextColor={theme.subtle}
        style={[styles.input, styles.multilineInput, { color: theme.heading, borderColor: theme.border, backgroundColor: theme.input }]}
        textAlignVertical="top"
      />
      <Text style={[styles.hint, { color: theme.muted }]}>Changes preview on the canvas and enter history only when applied.</Text>
    </View>
  );
}

export function ColourControls({
  label,
  value,
  allowTransparent = false,
  allowAlpha = true,
  onChange,
  onValidityChange,
}: {
  label: string;
  value: string | undefined;
  allowTransparent?: boolean;
  allowAlpha?: boolean;
  onChange: (value: string) => void;
  onValidityChange: (valid: boolean) => void;
}) {
  const theme = useControlTheme();
  const normalizeAllowed = (next: string) => {
    const normalized = normalizeHexColour(next);
    return normalized && (allowAlpha || normalized.length !== 9) ? normalized : null;
  };
  const [manual, setManual] = useState(() => normalizeAllowed(value ?? "") ?? "");
  const [manualValid, setManualValid] = useState(true);
  const gradient = isGradientPaint(value);

  useEffect(() => onValidityChange(manualValid), [manualValid, onValidityChange]);

  const updateManual = (next: string) => {
    setManual(next);
    const normalized = normalizeAllowed(next);
    setManualValid(Boolean(normalized));
    if (normalized) onChange(normalized);
  };

  const choose = (colour: string) => {
    setManual(colour === "transparent" ? "" : colour);
    setManualValid(true);
    onChange(colour);
  };

  return (
    <View style={styles.section}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      {gradient ? (
        <Text style={[styles.hint, { color: theme.muted }]}>The current web gradient is preserved until you choose a solid colour.</Text>
      ) : null}
      <View style={styles.swatches}>
        {COLOUR_PRESETS.map((colour) => (
          <Pressable
            key={colour}
            accessibilityLabel={`Use ${colour}`}
            onPress={() => choose(colour)}
            style={[
              styles.swatch,
              { backgroundColor: colour },
              value?.toUpperCase() === colour && styles.selectedSwatch,
            ]}
          />
        ))}
        {allowTransparent ? (
          <Pressable
            accessibilityLabel="Use transparent"
            onPress={() => choose("transparent")}
            style={[styles.swatch, styles.transparentSwatch, value === "transparent" && styles.selectedSwatch]}
          >
            <Text style={styles.transparentText}>×</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={[styles.label, { color: theme.text }]}>Hex colour</Text>
      <TextInput
        accessibilityLabel="Manual hex colour"
        autoCapitalize="characters"
        autoCorrect={false}
        value={manual}
        onChangeText={updateManual}
        placeholder={allowAlpha ? "#RRGGBB or #RRGGBBAA" : "#RRGGBB"}
        placeholderTextColor={theme.subtle}
        style={[styles.input, { color: theme.heading, borderColor: theme.border, backgroundColor: theme.input }, !manualValid && styles.invalidInput]}
      />
      {!manualValid ? <Text style={styles.error}>{allowAlpha ? "Enter #RGB, #RRGGBB, or #RRGGBBAA." : "Enter #RGB or #RRGGBB."}</Text> : null}
    </View>
  );
}

export function NumberControls({
  label,
  value,
  minimum,
  maximum,
  step,
  unit,
  presets = [],
  onChange,
  onValidityChange,
}: {
  label: string;
  value: number;
  minimum: number;
  maximum: number;
  step: number;
  unit: string;
  presets?: number[];
  onChange: (value: number) => void;
  onValidityChange: (valid: boolean) => void;
}) {
  const theme = useControlTheme();
  const [manual, setManual] = useState(formatNumber(value));
  const [manualValid, setManualValid] = useState(true);
  const [trackWidth, setTrackWidth] = useState(1);

  useEffect(() => onValidityChange(manualValid), [manualValid, onValidityChange]);
  useEffect(() => setManual(formatNumber(value)), [value]);

  const choose = (next: number) => {
    const clamped = clamp(next, minimum, maximum);
    setManual(formatNumber(clamped));
    setManualValid(true);
    onChange(clamped);
  };

  const updateManual = (next: string) => {
    setManual(next);
    const parsed = Number(next);
    const valid = next.trim() !== "" && Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum;
    setManualValid(valid);
    if (valid) onChange(parsed);
  };

  const updateFromTrack = (event: GestureResponderEvent) => {
    const ratio = clamp(event.nativeEvent.locationX / trackWidth, 0, 1);
    const raw = minimum + ratio * (maximum - minimum);
    const snapped = minimum + Math.round((raw - minimum) / step) * step;
    choose(snapped);
  };

  const progress = (clamp(value, minimum, maximum) - minimum) / Math.max(maximum - minimum, 0.0001) * 100;

  return (
    <View style={styles.section}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      <View style={styles.stepper}>
        <ControlButton label="−" accessibilityLabel={`Decrease ${label}`} onPress={() => choose(value - step)} />
        <View style={[styles.valueWrap, { borderColor: theme.border, backgroundColor: theme.input }]}>
          <TextInput
            accessibilityLabel={label}
            keyboardType="decimal-pad"
            value={manual}
            onChangeText={updateManual}
            style={[styles.numberInput, { color: theme.heading }, !manualValid && styles.invalidInput]}
          />
          <Text style={[styles.unit, { color: theme.muted }]}>{unit}</Text>
        </View>
        <ControlButton label="+" accessibilityLabel={`Increase ${label}`} onPress={() => choose(value + step)} />
      </View>
      <View
        accessibilityLabel={`${label} slider`}
        accessibilityRole="adjustable"
        accessibilityValue={{ min: minimum, max: maximum, now: clamp(value, minimum, maximum) }}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === "increment") choose(value + step);
          if (event.nativeEvent.actionName === "decrement") choose(value - step);
        }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onLayout={(event) => setTrackWidth(Math.max(event.nativeEvent.layout.width, 1))}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={updateFromTrack}
        onResponderMove={updateFromTrack}
        style={styles.sliderHitArea}
      >
        <View style={[styles.sliderTrack, { backgroundColor: theme.separator }]}>
          <View style={[styles.sliderFill, { width: `${progress}%` }]} />
          <View style={[styles.sliderThumb, { left: `${progress}%` }]} />
        </View>
      </View>
      <Text style={[styles.range, { color: theme.subtle }]}>{minimum}–{maximum}{unit}</Text>
      {presets.length ? (
        <View style={styles.chips}>
          {presets.map((preset) => (
            <ChoiceButton
              key={preset}
              label={`${preset}${unit}`}
              selected={Math.abs(value - preset) < 0.0001}
              onPress={() => choose(preset)}
            />
          ))}
        </View>
      ) : null}
      {!manualValid ? <Text style={styles.error}>Enter a value from {minimum} to {maximum}.</Text> : null}
    </View>
  );
}

export function AlignmentControls({
  value,
  onChange,
}: {
  value: NonNullable<CanvasLayer["textAlign"]>;
  onChange: (value: NonNullable<CanvasLayer["textAlign"]>) => void;
}) {
  const theme = useControlTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.label, { color: theme.text }]}>Text alignment</Text>
      <View style={styles.chips}>
        {(["left", "center", "right", "justify"] as const).map((alignment) => (
          <ChoiceButton
            key={alignment}
            label={alignment}
            selected={value === alignment}
            onPress={() => onChange(alignment)}
          />
        ))}
      </View>
    </View>
  );
}

export function TypographyControls({
  layer,
  onChange,
}: {
  layer: CanvasLayer;
  onChange: (patch: Partial<CanvasLayer>) => void;
}) {
  const theme = useControlTheme();
  const selectedFamily = normalizeFontFamily(layer.fontFamily);

  return (
    <View style={styles.section}>
      <Text style={[styles.label, { color: theme.text }]}>Font family</Text>
      <Text style={[styles.hint, { color: theme.muted }]}>Bundled on web, mobile, and exported invitations.</Text>
      <View style={styles.chips}>
        {BUNDLED_FONT_FAMILIES.map((option) => (
          <ChoiceButton
            key={option.family}
            label={option.family}
            previewFontFamily={resolveMobileFontFace(option.family)}
            selected={selectedFamily === option.family}
            onPress={() => onChange({ fontFamily: option.family })}
          />
        ))}
      </View>

      <Text style={[styles.label, { color: theme.text }]}>Weight</Text>
      <View style={styles.chips}>
        {(["normal", "medium", "semibold", "bold"] as const).map((weight) => (
          <ChoiceButton
            key={weight}
            label={weight}
            selected={(layer.fontWeight ?? "normal") === weight}
            onPress={() => onChange({ fontWeight: weight })}
          />
        ))}
      </View>

      <Text style={[styles.label, { color: theme.text }]}>Style</Text>
      <View style={styles.chips}>
        {(["normal", "italic"] as const).map((fontStyle) => (
          <ChoiceButton
            key={fontStyle}
            label={fontStyle}
            selected={(layer.fontStyle ?? "normal") === fontStyle}
            onPress={() => onChange({ fontStyle })}
          />
        ))}
      </View>
    </View>
  );
}

export function ShapeControls({
  value,
  onChange,
}: {
  value: "rect" | "ellipse";
  onChange: (value: "rect" | "ellipse") => void;
}) {
  const theme = useControlTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.label, { color: theme.text }]}>Shape</Text>
      <Text style={[styles.hint, { color: theme.muted }]}>Conversion keeps the layer’s bounds, paint, stroke, opacity, and ordering.</Text>
      <View style={styles.chips}>
        <ChoiceButton label="Rectangle" selected={value === "rect"} onPress={() => onChange("rect")} />
        <ChoiceButton label="Ellipse" selected={value === "ellipse"} onPress={() => onChange("ellipse")} />
      </View>
    </View>
  );
}

export function SheetFooter({
  applyDisabled,
  onReset,
  onCancel,
  onApply,
}: {
  applyDisabled: boolean;
  onReset: () => void;
  onCancel: () => void;
  onApply: () => void;
}) {
  const theme = useControlTheme();
  return (
    <View style={[styles.footer, { borderTopColor: theme.separator }]}>
      <SheetButton label="Reset" onPress={onReset} />
      <View style={styles.footerEnd}>
        <SheetButton label="Cancel" onPress={onCancel} />
        <SheetButton label="Apply" onPress={onApply} primary disabled={applyDisabled} />
      </View>
    </View>
  );
}

export function SheetButton({
  label,
  onPress,
  primary = false,
  danger = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  const theme = useControlTheme();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.sheetButton,
        { borderColor: theme.border, backgroundColor: theme.control },
        primary && styles.primaryButton,
        danger && styles.dangerButton,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.sheetButtonText, { color: theme.text }, primary && styles.primaryButtonText, danger && styles.dangerButtonText]}>{label}</Text>
    </Pressable>
  );
}

function ChoiceButton({
  label,
  selected,
  onPress,
  previewFontFamily,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  previewFontFamily?: string;
}) {
  const theme = useControlTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.choice, { borderColor: theme.border, backgroundColor: theme.control }, selected && styles.selectedChoice, selected && { backgroundColor: theme.selected }, pressed && styles.pressed]}
    >
      <Text style={[styles.choiceText, { color: theme.text }, previewFontFamily ? { fontFamily: previewFontFamily } : undefined, selected && styles.selectedChoiceText]}>{label}</Text>
    </Pressable>
  );
}

function ControlButton({
  label,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const theme = useControlTheme();
  return (
    <Pressable accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [styles.control, { borderColor: theme.border, backgroundColor: theme.control }, pressed && styles.pressed]}>
      <Text style={[styles.controlText, { color: theme.heading }]}>{label}</Text>
    </Pressable>
  );
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  label: { marginTop: 4, color: "#dce8e5", fontSize: 12, fontWeight: "800" },
  hint: { color: "#9bb0aa", fontSize: 11, lineHeight: 17 },
  range: { color: "#78918b", fontSize: 10, textAlign: "center" },
  error: { color: "#ff8b91", fontSize: 11 },
  input: { minHeight: 44, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: "#326052", color: "#f5f8f7", backgroundColor: "#0a1815" },
  multilineInput: { minHeight: 126, paddingTop: 12 },
  invalidInput: { borderColor: "#d95962" },
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  swatch: { width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: "#55746c" },
  selectedSwatch: { borderWidth: 3, borderColor: "#4fd6be" },
  transparentSwatch: { alignItems: "center", justifyContent: "center", backgroundColor: "#ffffff" },
  transparentText: { color: "#ef4444", fontSize: 30, lineHeight: 32, fontWeight: "300" },
  stepper: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 },
  control: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#326052", backgroundColor: "#17332c" },
  controlText: { color: "#f5f8f7", fontSize: 24, fontWeight: "600" },
  valueWrap: { minWidth: 116, height: 48, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", borderRadius: 10, borderWidth: 1, borderColor: "#326052", backgroundColor: "#0a1815" },
  numberInput: { flex: 1, color: "#f5f8f7", textAlign: "right", fontSize: 16, fontWeight: "800" },
  unit: { marginLeft: 4, color: "#9bb0aa", fontSize: 11 },
  sliderHitArea: { height: 38, justifyContent: "center" },
  sliderTrack: { height: 6, borderRadius: 3, backgroundColor: "#285046" },
  sliderFill: { height: 6, borderRadius: 3, backgroundColor: "#4fd6be" },
  sliderThumb: { position: "absolute", top: -7, width: 20, height: 20, marginLeft: -10, borderRadius: 10, borderWidth: 2, borderColor: "#4fd6be", backgroundColor: "#ffffff" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: { minHeight: 42, minWidth: 76, paddingHorizontal: 13, borderRadius: 10, borderWidth: 1, borderColor: "#326052", alignItems: "center", justifyContent: "center", backgroundColor: "#17332c" },
  selectedChoice: { borderColor: "#4fd6be", backgroundColor: "#20463c" },
  choiceText: { color: "#dce8e5", fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
  selectedChoiceText: { color: "#79e4d0" },
  footer: { marginTop: 22, paddingTop: 16, borderTopWidth: 1, borderTopColor: "#24483f", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  footerEnd: { flexDirection: "row", gap: 8 },
  sheetButton: { minHeight: 44, minWidth: 78, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: "#326052", alignItems: "center", justifyContent: "center", backgroundColor: "#17332c" },
  sheetButtonText: { color: "#dce8e5", fontSize: 12, fontWeight: "800" },
  primaryButton: { borderColor: "#4fd6be", backgroundColor: "#4fd6be" },
  primaryButtonText: { color: "#07110f" },
  dangerButton: { borderColor: "#8d353b", backgroundColor: "#39191c" },
  dangerButtonText: { color: "#ff8b91" },
  pressed: { opacity: 0.66 },
  disabled: { opacity: 0.38 },
});
