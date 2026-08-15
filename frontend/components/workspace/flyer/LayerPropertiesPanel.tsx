
"use client";

import { useFlyerDraft } from "@/context/FlyerDraftContext";
import { ModernColorPicker } from "./ModernColorPicker";
import { FontPicker } from "./FontPicker";

/* ------------------------------------------------------------------ */
/*  Tiny alignment SVG icons                                           */
/* ------------------------------------------------------------------ */
function AlignLeftIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h10M4 14h14M4 18h8" />
    </svg>
  );
}
function AlignCenterIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M8 10h8M4 14h16M8 18h8" />
    </svg>
  );
}
function AlignRightIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M14 10h6M4 14h16M10 18h10" />
    </svg>
  );
}
function AlignJustifyIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Helper: segmented control button                                   */
/* ------------------------------------------------------------------ */
function SegmentBtn({ active, onClick, children, title }: any) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex-1 flex items-center justify-center py-1.5 rounded-md text-xs transition ${
        active
          ? "bg-brand-400/20 text-brand-400 shadow-sm"
          : "text-foreground/60 hover:bg-brand-400/10 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */
const fieldClass =
  "w-full mt-1 rounded-lg border border-brand-400/20 bg-background px-2 py-1.5 text-xs outline-none focus:border-brand-400/50";

export function LayerPropertiesPanel() {
  const { draft, updateLayer } = useFlyerDraft();
  const selectedLayer = draft.layers.find((l) => l.id === draft.selectedLayerId);

  if (!selectedLayer) return null;

  return (
    <div className="space-y-4 text-xs pb-10 overflow-y-auto scrollbar-custom">
      {/* ---------- LAYOUT & TRANSFORM ---------- */}
      <div className="rounded-xl border border-brand-400/10 bg-brand-400/5 p-3 space-y-3">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-brand-400">
          Layout
        </h4>

        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className="text-[10px] text-foreground/60">X</span>
            <input
              type="number"
              value={Math.round(selectedLayer.x)}
              onChange={(e) => updateLayer(selectedLayer.id, { x: Number(e.target.value) })}
              className={fieldClass}
            />
          </label>
          <label>
            <span className="text-[10px] text-foreground/60">Y</span>
            <input
              type="number"
              value={Math.round(selectedLayer.y)}
              onChange={(e) => updateLayer(selectedLayer.id, { y: Number(e.target.value) })}
              className={fieldClass}
            />
          </label>
          <label>
            <span className="text-[10px] text-foreground/60">Width</span>
            <input
              type="number"
              value={Math.round(selectedLayer.width)}
              onChange={(e) => updateLayer(selectedLayer.id, { width: Number(e.target.value) })}
              className={fieldClass}
            />
          </label>
          <label>
            <span className="text-[10px] text-foreground/60">Height</span>
            <input
              type="number"
              value={Math.round(selectedLayer.height)}
              onChange={(e) => updateLayer(selectedLayer.id, { height: Number(e.target.value) })}
              className={fieldClass}
            />
          </label>
        </div>

        {/* Rotation slider */}
        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between text-[10px]">
            <span className="text-foreground/70">Rotation</span>
            <span className="font-mono">{selectedLayer.rotation ?? 0}°</span>
          </div>
          <input
            type="range"
            min="0"
            max="360"
            value={selectedLayer.rotation ?? 0}
            onChange={(e) => updateLayer(selectedLayer.id, { rotation: Number(e.target.value) })}
            className="w-full h-1.5 bg-brand-400/20 rounded-full appearance-none accent-brand-400"
          />
        </div>
      </div>

      {/* ---------- TEXT PROPERTIES ---------- */}
      {selectedLayer.type === "text" && (
        <div className="rounded-xl border border-brand-400/10 bg-brand-400/5 p-3 space-y-3">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-brand-400">
            Typography
          </h4>

          <input
            type="text"
            value={selectedLayer.text ?? ""}
            onChange={(e) => updateLayer(selectedLayer.id, { text: e.target.value })}
            className="w-full rounded-lg border border-brand-400/20 bg-background px-2 py-1.5 outline-none focus:border-brand-400"
          />

          <FontPicker
            fontFamily={selectedLayer.fontFamily ?? "Inter"}
            fontWeight={selectedLayer.fontWeight ?? "normal"}
            fontStyle={selectedLayer.fontStyle ?? "normal"}
            onChangeFamily={(family) => updateLayer(selectedLayer.id, { fontFamily: family })}
            onChangeStyle={(fontWeight, fontStyle) =>
              updateLayer(selectedLayer.id, {
                fontWeight: fontWeight as "bold" | "normal" | "medium" | "semibold",
                fontStyle: fontStyle as "normal" | "italic",
              })
            }
          />

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[10px] text-foreground/60">Size</span>
              <input
                type="number"
                value={selectedLayer.fontSize ?? 24}
                onChange={(e) => updateLayer(selectedLayer.id, { fontSize: Number(e.target.value) })}
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className="text-[10px] text-foreground/60">Colour</span>
              <ModernColorPicker
                label=""
                color={selectedLayer.color ?? "#ffffff"}
                onColorChange={(color) => updateLayer(selectedLayer.id, { color })}
              />
            </label>
          </div>

          {/* Alignment – SVG icons */}
          <div className="flex gap-2">
            <div className="flex flex-1 bg-background border border-brand-400/20 rounded-lg p-0.5">
              <SegmentBtn
                active={selectedLayer.textAlign === "left"}
                onClick={() => updateLayer(selectedLayer.id, { textAlign: "left" })}
                title="Align Left"
              >
                <AlignLeftIcon />
              </SegmentBtn>
              <SegmentBtn
                active={(selectedLayer.textAlign ?? "center") === "center"}
                onClick={() => updateLayer(selectedLayer.id, { textAlign: "center" })}
                title="Align Center"
              >
                <AlignCenterIcon />
              </SegmentBtn>
              <SegmentBtn
                active={selectedLayer.textAlign === "right"}
                onClick={() => updateLayer(selectedLayer.id, { textAlign: "right" })}
                title="Align Right"
              >
                <AlignRightIcon />
              </SegmentBtn>
              <SegmentBtn
                active={selectedLayer.textAlign === "justify"}
                onClick={() => updateLayer(selectedLayer.id, { textAlign: "justify" })}
                title="Justify"
              >
                <AlignJustifyIcon />
              </SegmentBtn>
            </div>
          </div>
        </div>
      )}

      {/* ---------- STYLE (Paths & Shapes) ---------- */}
      {(selectedLayer.type === "rect" ||
        selectedLayer.type === "ellipse" ||
        selectedLayer.type === "path") && (
        <div className="space-y-3">
          {/* Fill Section */}
          <div className="rounded-xl border border-brand-400/10 bg-brand-400/5 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-brand-400">Fill</h4>
              <button
                onClick={() =>
                  updateLayer(selectedLayer.id, {
                    fill: selectedLayer.fill === "none" ? "#D9D9D9" : "none",
                  })
                }
                className="text-foreground/50 hover:text-foreground text-lg leading-none"
                title={selectedLayer.fill === "none" ? "Add Fill" : "Remove Fill"}
              >
                {selectedLayer.fill === "none" ? "+" : "−"}
              </button>
            </div>

            {selectedLayer.fill !== "none" && (
              <ModernColorPicker
                label=""
                color={selectedLayer.fill ?? "#ffffff"}
                opacity={selectedLayer.opacity}
                showOpacity={selectedLayer.type !== "path"}
                onColorChange={(color) => updateLayer(selectedLayer.id, { fill: color })}
                onOpacityChange={(opacity) => updateLayer(selectedLayer.id, { opacity })}
              />
            )}
          </div>

          {/* Stroke Section */}
          <div className="rounded-xl border border-brand-400/10 bg-brand-400/5 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-brand-400">Stroke</h4>
              <button
                onClick={() =>
                  updateLayer(selectedLayer.id, {
                    strokeWidth: selectedLayer.strokeWidth === 0 ? 1 : 0,
                  })
                }
                className="text-foreground/50 hover:text-foreground text-lg leading-none"
                title={selectedLayer.strokeWidth === 0 ? "Add Stroke" : "Remove Stroke"}
              >
                {selectedLayer.strokeWidth === 0 ? "+" : "−"}
              </button>
            </div>

            {selectedLayer.strokeWidth !== 0 && (
              <>
                <ModernColorPicker
                  label=""
                  color={selectedLayer.stroke ?? "#000000"}
                  onColorChange={(color) => updateLayer(selectedLayer.id, { stroke: color })}
                />

                {/* Progressive Stroke Weight Slider */}
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[10px] text-foreground/50">Weight</span>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="1"
                    value={selectedLayer.strokeWidth ?? 1}
                    onChange={(e) =>
                      updateLayer(selectedLayer.id, { strokeWidth: Number(e.target.value) })
                    }
                    className="flex-1 h-1.5 rounded-full appearance-none bg-brand-400/20 accent-brand-400 cursor-ew-resize"
                  />
                  <input
                    type="number"
                    min="0"
                    value={selectedLayer.strokeWidth ?? 1}
                    onChange={(e) =>
                      updateLayer(selectedLayer.id, { strokeWidth: Number(e.target.value) })
                    }
                    className="w-12 rounded border border-brand-400/20 bg-background px-1 py-1 text-center text-xs outline-none focus:border-brand-400/50"
                  />
                </div>
              </>
            )}
          </div>

          {/* Corner Radius (for rect, not ellipse/path) */}
          {selectedLayer.type !== "path" && selectedLayer.type !== "ellipse" && (
            <div className="rounded-xl border border-brand-400/10 bg-brand-400/5 p-3 space-y-2">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-foreground/70">Corner Radius</span>
                <span className="font-mono text-brand-400 bg-brand-400/10 px-1 rounded">
                  {selectedLayer.borderRadius ?? 0}px
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="200"
                step="1"
                value={selectedLayer.borderRadius ?? 0}
                onChange={(e) =>
                  updateLayer(selectedLayer.id, { borderRadius: Number(e.target.value) })
                }
                className="w-full h-1.5 rounded-full appearance-none bg-brand-400/20 accent-brand-400 cursor-ew-resize"
              />
            </div>
          )}
        </div>
      )}

      {/* ---------- DROP SHADOW ---------- */}
      <div className="rounded-xl border border-brand-400/10 bg-brand-400/5 p-3 space-y-3">
        <div
          className="flex items-center justify-between cursor-pointer select-none"
          onClick={() =>
            updateLayer(selectedLayer.id, {
              shadow: selectedLayer.shadow
                ? undefined
                : { color: "rgba(0,0,0,0.5)", blur: 10, offsetX: 0, offsetY: 4 },
            })
          }
        >
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-brand-400">
            Drop Shadow
          </h4>
          <span
            className={`text-[10px] font-medium ${
              selectedLayer.shadow ? "text-brand-400" : "text-foreground/50"
            }`}
          >
            {selectedLayer.shadow ? "On" : "Off"}
          </span>
        </div>

        {selectedLayer.shadow && (
          <div className="space-y-3 pt-2">
            <ModernColorPicker
              label="Shadow Colour"
              color={selectedLayer.shadow.color}
              onColorChange={(color) =>
                updateLayer(selectedLayer.id, {
                  shadow: { ...selectedLayer.shadow!, color },
                })
              }
            />

            <div className="space-y-2">
              <div className="flex justify-between text-[10px]">
                <span className="text-foreground/70">Blur</span>
                <span>{selectedLayer.shadow.blur}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={selectedLayer.shadow.blur}
                onChange={(e) =>
                  updateLayer(selectedLayer.id, {
                    shadow: { ...selectedLayer.shadow!, blur: Number(e.target.value) },
                  })
                }
                className="w-full h-1.5 bg-brand-400/20 rounded-full appearance-none accent-brand-400"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-[10px]">
                <span className="text-foreground/70">Offset X</span>
                <span>{selectedLayer.shadow.offsetX}px</span>
              </div>
              <input
                type="range"
                min="-50"
                max="50"
                value={selectedLayer.shadow.offsetX}
                onChange={(e) =>
                  updateLayer(selectedLayer.id, {
                    shadow: { ...selectedLayer.shadow!, offsetX: Number(e.target.value) },
                  })
                }
                className="w-full h-1.5 bg-brand-400/20 rounded-full appearance-none accent-brand-400"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-[10px]">
                <span className="text-foreground/70">Offset Y</span>
                <span>{selectedLayer.shadow.offsetY}px</span>
              </div>
              <input
                type="range"
                min="-50"
                max="50"
                value={selectedLayer.shadow.offsetY}
                onChange={(e) =>
                  updateLayer(selectedLayer.id, {
                    shadow: { ...selectedLayer.shadow!, offsetY: Number(e.target.value) },
                  })
                }
                className="w-full h-1.5 bg-brand-400/20 rounded-full appearance-none accent-brand-400"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
