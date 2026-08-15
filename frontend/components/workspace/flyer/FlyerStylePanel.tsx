"use client";

import { ModernColorPicker } from "./ModernColorPicker";
import { useFlyerDraft } from "@/context/FlyerDraftContext";

export function FlyerStylePanel() {
  const { draft, updateFlyerConfiguration } = useFlyerDraft();
  const configuration = draft.configuration;
  const isArtboardSelected =
    draft.isFrameSelected && !draft.selectedLayerId;

  if (!configuration) return null;

  return (
    <div className="space-y-4 text-xs">
      <div className="space-y-3 rounded-xl border border-brand-400/10 bg-brand-400/5 p-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-brand-400">
          Canvas
        </h4>

        <ModernColorPicker
          label="Background colour"
          color={configuration.canvas_background_color}
          onColorChange={(color) => updateFlyerConfiguration({
            canvas_background_color: color,
          })}
        />
      </div>

      <div
        className={`space-y-3 rounded-xl border p-3 transition ${
          isArtboardSelected
            ? "border-brand-400 bg-brand-400/10"
            : "border-brand-400/10 bg-brand-400/5"
        }`}
      >
        <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-400">
          Artboard stroke
          {isArtboardSelected ? (
            <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
          ) : null}
        </h4>

        <ModernColorPicker
          label="Stroke colour"
          color={configuration.artboard_stroke_color ?? "#000000"}
          onColorChange={(color) => updateFlyerConfiguration({
            artboard_stroke_color: color,
          })}
        />

        <label className="block space-y-1.5">
          <span className="flex items-center justify-between gap-3 text-[10px] font-medium text-foreground/70">
            <span>Width</span>
            <span className="font-mono">
              {configuration.artboard_stroke_width ?? 0}px
            </span>
          </span>

          <input
            type="range"
            min={0}
            max={20}
            step={1}
            value={configuration.artboard_stroke_width ?? 0}
            aria-label="Artboard stroke width"
            onChange={(event) => updateFlyerConfiguration({
              artboard_stroke_width: Number(event.target.value),
            })}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-brand-400/20 accent-brand-400"
          />
        </label>
      </div>
    </div>
  );
}
