"use client";

import { RotateCcw } from "lucide-react";
import {
  useState,
  type ReactNode,
} from "react";

import type { StubEditorRegion } from "@/components/editor/editor-types";
import {
  clampStubValue,
  getEventDetailsTopMaximum,
  getGuestTopMaximum,
  getQrBottomMaximum,
  getQrBottomMinimum,
  getQrRightMaximum,
  roundStubPercentage,
  STUB_DETAILS_LEFT_MAX,
  STUB_DETAILS_LEFT_MIN,
  STUB_DETAILS_TOP_MIN,
  STUB_GUEST_LEFT_MAX,
  STUB_GUEST_LEFT_MIN,
  STUB_GUEST_TOP_MIN,
  STUB_QR_SIZE_MAX,
  STUB_QR_SIZE_MIN,
  STUB_REFERENCE_HEIGHT,
} from "@/components/editor/stub-editor-geometry";
import { FontPicker } from "@/components/workspace/flyer/FontPicker";
import { ModernColorPicker } from "@/components/workspace/flyer/ModernColorPicker";
import { useFlyerDraft } from "@/context/FlyerDraftContext";
import {
  DEFAULT_FLYER_CONFIGURATION,
  type FlyerConfiguration,
} from "@/lib/types/flyer";

interface StubPropertiesPanelProps {
  selectedRegion: StubEditorRegion;
  onSelectRegion: (region: StubEditorRegion) => void;
}

type FontWeight = FlyerConfiguration["stub_guest_font_weight"];
type FontStyle = FlyerConfiguration["stub_guest_font_style"];

const REGION_OPTIONS: readonly {
  value: StubEditorRegion;
  label: string;
}[] = [
  { value: "background", label: "Background" },
  { value: "guest", label: "Name" },
  { value: "badge", label: "Badge" },
  { value: "event-details", label: "Details" },
  { value: "qr", label: "QR" },
];

const FONT_WEIGHT_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "medium", label: "Medium" },
  { value: "semibold", label: "Semibold" },
  { value: "bold", label: "Bold" },
] as const;

const FONT_STYLE_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "italic", label: "Italic" },
] as const;

function formatNumber(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function isFontWeight(value: string): value is FontWeight {
  return FONT_WEIGHT_OPTIONS.some((option) => option.value === value);
}

function isFontStyle(value: string): value is FontStyle {
  return FONT_STYLE_OPTIONS.some((option) => option.value === value);
}

interface NumberInputProps {
  value: number;
  minimum: number;
  maximum: number;
  step: number;
  ariaLabel: string;
  onChange: (value: number) => void;
}

function NumberInput({
  value,
  minimum,
  maximum,
  step,
  ariaLabel,
  onChange,
}: NumberInputProps) {
  const [editValue, setEditValue] = useState<string | null>(null);
  const inputValue = editValue ?? formatNumber(value);

  const commit = (rawValue: string) => {
    setEditValue(rawValue);
    const parsed = Number(rawValue);
    if (rawValue.trim() === "" || !Number.isFinite(parsed)) return;

    onChange(
      roundStubPercentage(
        clampStubValue(parsed, minimum, maximum),
      ),
    );
  };

  const normalize = () => {
    const parsed = Number(inputValue);
    if (inputValue.trim() === "" || !Number.isFinite(parsed)) {
      setEditValue(null);
      return;
    }

    const nextValue = roundStubPercentage(
      clampStubValue(parsed, minimum, maximum),
    );
    setEditValue(null);
    if (nextValue !== value) onChange(nextValue);
  };

  return (
    <input
      type="number"
      inputMode="decimal"
      min={minimum}
      max={maximum}
      step={step}
      value={inputValue}
      aria-label={ariaLabel}
      onFocus={() => setEditValue(formatNumber(value))}
      onChange={(event) => commit(event.target.value)}
      onBlur={normalize}
      className="h-8 w-[74px] rounded-lg border border-brand-400/15 bg-background px-2 text-right text-xs outline-none transition focus:border-brand-400/50 focus:ring-1 focus:ring-brand-400/20"
    />
  );
}

interface NumberControlProps extends NumberInputProps {
  label: string;
  slider?: boolean;
}

function NumberControl({
  label,
  slider = true,
  ...inputProps
}: NumberControlProps) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center justify-between gap-3">
        <span className="text-xs text-foreground/65">{label}</span>
        <NumberInput {...inputProps} />
      </span>

      {slider ? (
        <input
          type="range"
          min={inputProps.minimum}
          max={inputProps.maximum}
          step={inputProps.step}
          value={inputProps.value}
          aria-label={`${inputProps.ariaLabel} slider`}
          onChange={(event) => inputProps.onChange(Number(event.target.value))}
          className="h-1.5 w-full accent-brand-400"
        />
      ) : null}
    </label>
  );
}

function SegmentedControl({
  value,
  options,
  ariaLabel,
  onChange,
}: {
  value: string;
  options: readonly { value: string; label: string }[];
  ariaLabel: string;
  onChange: (value: string) => void;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="grid grid-cols-2 gap-1 rounded-lg border border-brand-400/10 bg-brand-400/[0.04] p-1"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`min-h-8 rounded-md px-2 py-1.5 text-[11px] font-medium transition ${
            value === option.value
              ? "bg-brand-400/20 text-brand-400"
              : "text-foreground/55 hover:bg-brand-400/10 hover:text-foreground"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-lg px-1 py-1 text-left transition hover:bg-brand-400/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
    >
      <span className="text-xs text-foreground/70">{label}</span>
      <span
        aria-hidden="true"
        className={`relative h-5 w-9 shrink-0 rounded-full transition ${
          checked ? "bg-brand-400" : "bg-foreground/20"
        }`}
      >
        <span
          className={`absolute top-1 h-3 w-3 rounded-full bg-white transition ${
            checked ? "left-5" : "left-1"
          }`}
        />
      </span>
    </button>
  );
}

function InspectorSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3 border-t border-brand-400/10 pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-400">
        {title}
      </h3>
      {children}
    </section>
  );
}

function RegionHeader({
  title,
  onReset,
}: {
  title: string;
  onReset: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm font-semibold">{title}</p>
      <button
        type="button"
        aria-label={`Reset ${title}`}
        title={`Reset ${title}`}
        onClick={onReset}
        className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-[11px] font-medium text-foreground/50 transition hover:bg-brand-400/10 hover:text-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
      >
        <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
        Reset
      </button>
    </div>
  );
}

function ColorField({
  label,
  color,
  disabled = false,
  onChange,
}: {
  label: string;
  color: string;
  disabled?: boolean;
  onChange: (color: string) => void;
}) {
  return (
    <div
      aria-disabled={disabled}
      className={disabled ? "pointer-events-none opacity-45" : ""}
    >
      <ModernColorPicker
        label={label}
        color={color}
        onColorChange={onChange}
      />
    </div>
  );
}

export function StubPropertiesPanel({
  selectedRegion,
  onSelectRegion,
}: StubPropertiesPanelProps) {
  const { draft, updateFlyerConfiguration } = useFlyerDraft();
  const configuration = draft.configuration;

  if (!configuration) {
    return (
      <div className="rounded-xl border border-brand-400/10 bg-brand-400/[0.04] p-4 text-xs leading-5 text-foreground/55">
        Load a flyer configuration before editing the ticket stub.
      </div>
    );
  }

  const defaults = DEFAULT_FLYER_CONFIGURATION(
    configuration.image_width,
    configuration.image_height,
  );
  const guestTopMaximum = getGuestTopMaximum(
    configuration,
    STUB_REFERENCE_HEIGHT,
    4,
    configuration.stub_show_guest_category,
  );
  const detailsTopMaximum = getEventDetailsTopMaximum(
    configuration,
    STUB_REFERENCE_HEIGHT,
  );
  const qrSizeForBounds = clampStubValue(
    configuration.stub_qr_size,
    STUB_QR_SIZE_MIN,
    STUB_QR_SIZE_MAX,
  );
  const qrBottomMinimum = getQrBottomMinimum(qrSizeForBounds);
  const qrBottomMaximum = getQrBottomMaximum(qrSizeForBounds);

  const backgroundPanel = (
    <div className="space-y-4">
      <RegionHeader
        title="Background"
        onReset={() => {
          updateFlyerConfiguration({
            stub_background_color: defaults.stub_background_color,
            stub_text_color: defaults.stub_text_color,
            stub_curve_shadow_color: defaults.stub_curve_shadow_color,
            stub_curve_shadow_opacity: defaults.stub_curve_shadow_opacity,
            stub_curve_shadow_blur: defaults.stub_curve_shadow_blur,
            stub_curve_shadow_offset: defaults.stub_curve_shadow_offset,
          });
        }}
      />

      <InspectorSection title="Appearance">
        <div className="space-y-2">
          <ColorField
            label="Background"
            color={configuration.stub_background_color}
            onChange={(color) => updateFlyerConfiguration({
              stub_background_color: color,
            })}
          />
          <ColorField
            label="Text"
            color={configuration.stub_text_color}
            onChange={(color) => updateFlyerConfiguration({
              stub_text_color: color,
            })}
          />
        </div>
      </InspectorSection>

      <InspectorSection title="Curve and shadow">
        <div className="space-y-3">
          <ColorField
            label="Shadow colour"
            color={configuration.stub_curve_shadow_color}
            onChange={(color) => updateFlyerConfiguration({
              stub_curve_shadow_color: color,
            })}
          />
          <NumberControl
            label="Opacity"
            value={configuration.stub_curve_shadow_opacity}
            minimum={0}
            maximum={100}
            step={1}
            ariaLabel="Shadow opacity"
            slider
            onChange={(value) => updateFlyerConfiguration({
              stub_curve_shadow_opacity: value,
            })}
          />
          <NumberControl
            label="Blur"
            value={configuration.stub_curve_shadow_blur}
            minimum={0}
            maximum={60}
            step={1}
            ariaLabel="Shadow blur"
            slider
            onChange={(value) => updateFlyerConfiguration({
              stub_curve_shadow_blur: value,
            })}
          />
          <NumberControl
            label="Offset"
            value={configuration.stub_curve_shadow_offset}
            minimum={-30}
            maximum={60}
            step={1}
            ariaLabel="Shadow offset"
            slider
            onChange={(value) => updateFlyerConfiguration({
              stub_curve_shadow_offset: value,
            })}
          />
        </div>
      </InspectorSection>
    </div>
  );

  const guestPanel = (
    <div className="space-y-4">
      <RegionHeader
        title="Guest name"
        onReset={() => {
          updateFlyerConfiguration({
            stub_guest_info_top: defaults.stub_guest_info_top,
            stub_guest_info_left: defaults.stub_guest_info_left,
            stub_guest_name_mode: defaults.stub_guest_name_mode,
            stub_guest_font_family: defaults.stub_guest_font_family,
            stub_guest_font_weight: defaults.stub_guest_font_weight,
            stub_guest_font_style: defaults.stub_guest_font_style,
            stub_guest_name_font_size: defaults.stub_guest_name_font_size,
          });
        }}
      />

      <InspectorSection title="Name display">
        <SegmentedControl
          value={configuration.stub_guest_name_mode}
          options={[
            { value: "first", label: "First name" },
            { value: "full", label: "Full name" },
          ]}
          ariaLabel="Guest name display"
          onChange={(value) => {
            if (value === "first" || value === "full") {
              updateFlyerConfiguration({ stub_guest_name_mode: value });
            }
          }}
        />
      </InspectorSection>

      <InspectorSection title="Typography">
        <div className="space-y-3">
          <FontPicker
            fontFamily={configuration.stub_guest_font_family}
            fontWeight={configuration.stub_guest_font_weight}
            fontStyle={configuration.stub_guest_font_style}
            onChangeFamily={(family) => updateFlyerConfiguration({
              stub_guest_font_family: family,
            })}
            onChangeStyle={(weight, style) => {
              updateFlyerConfiguration({
                stub_guest_font_weight: isFontWeight(weight)
                  ? weight
                  : defaults.stub_guest_font_weight,
                stub_guest_font_style: isFontStyle(style)
                  ? style
                  : defaults.stub_guest_font_style,
              });
            }}
          />

          <div className="space-y-1.5">
            <span className="text-[11px] text-foreground/50">Weight</span>
            <SegmentedControl
              value={configuration.stub_guest_font_weight}
              options={FONT_WEIGHT_OPTIONS}
              ariaLabel="Guest font weight"
              onChange={(value) => {
                if (isFontWeight(value)) {
                  updateFlyerConfiguration({ stub_guest_font_weight: value });
                }
              }}
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] text-foreground/50">Style</span>
            <SegmentedControl
              value={configuration.stub_guest_font_style}
              options={FONT_STYLE_OPTIONS}
              ariaLabel="Guest font style"
              onChange={(value) => {
                if (isFontStyle(value)) {
                  updateFlyerConfiguration({ stub_guest_font_style: value });
                }
              }}
            />
          </div>

          <NumberControl
            label="Font size"
            value={configuration.stub_guest_name_font_size}
            minimum={12}
            maximum={48}
            step={1}
            ariaLabel="Guest font size"
            onChange={(value) => updateFlyerConfiguration({
              stub_guest_name_font_size: value,
            })}
          />
        </div>
      </InspectorSection>

      <InspectorSection title="Position">
        <div className="space-y-3">
          <NumberControl
            label="Left offset"
            value={configuration.stub_guest_info_left}
            minimum={STUB_GUEST_LEFT_MIN}
            maximum={STUB_GUEST_LEFT_MAX}
            step={0.5}
            ariaLabel="Guest information X position"
            onChange={(value) => updateFlyerConfiguration({
              stub_guest_info_left: value,
            })}
          />
          <NumberControl
            label="Top offset"
            value={configuration.stub_guest_info_top}
            minimum={STUB_GUEST_TOP_MIN}
            maximum={guestTopMaximum}
            step={0.5}
            ariaLabel="Guest information Y position"
            onChange={(value) => updateFlyerConfiguration({
              stub_guest_info_top: value,
            })}
          />
        </div>
      </InspectorSection>
    </div>
  );

  const badgePanel = (
    <div className="space-y-4">
      <RegionHeader
        title="Category badge"
        onReset={() => {
          updateFlyerConfiguration({
            stub_show_guest_category: defaults.stub_show_guest_category,
            stub_accent_color: defaults.stub_accent_color,
          });
        }}
      />

      <InspectorSection title="Visibility">
        <ToggleRow
          label="Show category badge"
          checked={configuration.stub_show_guest_category}
          onChange={(checked) => updateFlyerConfiguration({
            stub_show_guest_category: checked,
          })}
        />
      </InspectorSection>

      <InspectorSection title="Appearance">
        <ColorField
          label="Badge colour"
          color={configuration.stub_accent_color}
          disabled={!configuration.stub_show_guest_category}
          onChange={(color) => updateFlyerConfiguration({
            stub_accent_color: color,
          })}
        />
      </InspectorSection>
    </div>
  );

  const detailsPanel = (
    <div className="space-y-4">
      <RegionHeader
        title="Event details"
        onReset={() => {
          updateFlyerConfiguration({
            stub_show_event_date: defaults.stub_show_event_date,
            stub_show_event_time: defaults.stub_show_event_time,
            stub_show_event_location: defaults.stub_show_event_location,
            stub_event_details_icon_color:
              defaults.stub_event_details_icon_color,
            stub_event_details_top: defaults.stub_event_details_top,
            stub_event_details_left: defaults.stub_event_details_left,
          });
        }}
      />

      <InspectorSection title="Visible information">
        <div className="space-y-1">
          <ToggleRow
            label="Show date"
            checked={configuration.stub_show_event_date}
            onChange={(checked) => updateFlyerConfiguration({
              stub_show_event_date: checked,
            })}
          />
          <ToggleRow
            label="Show time"
            checked={configuration.stub_show_event_time}
            onChange={(checked) => updateFlyerConfiguration({
              stub_show_event_time: checked,
            })}
          />
          <ToggleRow
            label="Show location"
            checked={configuration.stub_show_event_location}
            onChange={(checked) => updateFlyerConfiguration({
              stub_show_event_location: checked,
            })}
          />
        </div>
      </InspectorSection>

      <InspectorSection title="Appearance">
        <ColorField
          label="Icon colour"
          color={configuration.stub_event_details_icon_color}
          onChange={(color) => updateFlyerConfiguration({
            stub_event_details_icon_color: color,
          })}
        />
      </InspectorSection>

      <InspectorSection title="Position">
        <div className="space-y-3">
          <NumberControl
            label="Left offset"
            value={configuration.stub_event_details_left}
            minimum={STUB_DETAILS_LEFT_MIN}
            maximum={STUB_DETAILS_LEFT_MAX}
            step={0.5}
            ariaLabel="Event details X position"
            onChange={(value) => updateFlyerConfiguration({
              stub_event_details_left: value,
            })}
          />
          <NumberControl
            label="Top offset"
            value={configuration.stub_event_details_top}
            minimum={STUB_DETAILS_TOP_MIN}
            maximum={detailsTopMaximum}
            step={0.5}
            ariaLabel="Event details Y position"
            onChange={(value) => updateFlyerConfiguration({
              stub_event_details_top: value,
            })}
          />
        </div>
      </InspectorSection>
    </div>
  );

  const qrPanel = (
    <div className="space-y-4">
      <RegionHeader
        title="QR code"
        onReset={() => {
          updateFlyerConfiguration({
            qr_foreground_color: defaults.qr_foreground_color,
            stub_qr_size: defaults.stub_qr_size,
            stub_qr_right: defaults.stub_qr_right,
            stub_qr_bottom: defaults.stub_qr_bottom,
          });
        }}
      />

      <InspectorSection title="Appearance">
        <ColorField
          label="Outer frame"
          color={configuration.qr_foreground_color}
          onChange={(color) => updateFlyerConfiguration({
            qr_foreground_color: color,
          })}
        />
      </InspectorSection>

      <InspectorSection title="Size and position">
        <div className="space-y-3">
          <NumberControl
            label="Size"
            value={configuration.stub_qr_size}
            minimum={STUB_QR_SIZE_MIN}
            maximum={STUB_QR_SIZE_MAX}
            step={1}
            ariaLabel="QR size"
            onChange={(value) => {
              const nextSize = clampStubValue(
                value,
                STUB_QR_SIZE_MIN,
                STUB_QR_SIZE_MAX,
              );
              const nextBottomMinimum = getQrBottomMinimum(nextSize);
              const nextBottomMaximum = getQrBottomMaximum(nextSize);

              updateFlyerConfiguration({
                stub_qr_size: nextSize,
                stub_qr_right: clampStubValue(
                  configuration.stub_qr_right,
                  0,
                  getQrRightMaximum(nextSize),
                ),
                stub_qr_bottom: clampStubValue(
                  Math.max(
                    configuration.stub_qr_bottom,
                    nextBottomMinimum,
                  ),
                  nextBottomMinimum,
                  nextBottomMaximum,
                ),
              });
            }}
          />
          <NumberControl
            label="Right"
            value={configuration.stub_qr_right}
            minimum={0}
            maximum={getQrRightMaximum(qrSizeForBounds)}
            step={0.5}
            ariaLabel="QR right offset"
            onChange={(value) => updateFlyerConfiguration({
              stub_qr_right: value,
            })}
          />
          <NumberControl
            label="Bottom"
            value={Math.max(
              configuration.stub_qr_bottom,
              qrBottomMinimum,
            )}
            minimum={qrBottomMinimum}
            maximum={qrBottomMaximum}
            step={0.5}
            ariaLabel="QR bottom offset"
            onChange={(value) => updateFlyerConfiguration({
              stub_qr_bottom: clampStubValue(
                value,
                qrBottomMinimum,
                qrBottomMaximum,
              ),
            })}
          />
        </div>
      </InspectorSection>
    </div>
  );

  const panelContent =
    selectedRegion === "background"
      ? backgroundPanel
      : selectedRegion === "guest"
        ? guestPanel
        : selectedRegion === "badge"
          ? badgePanel
          : selectedRegion === "event-details"
            ? detailsPanel
            : qrPanel;

  return (
    <div className="space-y-4">
      <div
        role="group"
        aria-label="Ticket stub regions"
        className="grid grid-cols-3 gap-1 rounded-lg border border-brand-400/10 bg-brand-400/[0.04] p-1"
      >
        {REGION_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-label={`Select ${option.label} stub settings`}
            aria-pressed={selectedRegion === option.value}
            onClick={() => onSelectRegion(option.value)}
            className={`min-h-8 rounded-lg px-2 py-1.5 text-[11px] font-medium transition ${
              selectedRegion === option.value
                ? "bg-brand-400/20 text-brand-400"
                : "text-foreground/55 hover:bg-brand-400/10 hover:text-foreground"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {panelContent}
    </div>
  );
}
