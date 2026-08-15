"use client";

import type { ReactNode } from "react";
import { ModernColorPicker } from "@/components/workspace/flyer/ModernColorPicker";
import { useFlyerDraft } from "@/context/FlyerDraftContext";
import { useVectorEdit, type VectorAppearance } from "@/context/VectorEditContext";
import type { MirrorMode } from "@/lib/types/canvas";
import { roundVectorValue, type VectorHandleType } from "@/lib/flyer/vectorGeometry";

const sectionClass = "space-y-3 rounded-xl border border-brand-400/10 bg-brand-400/5 p-3";
const inputClass = "mt-1 w-full rounded-lg border border-brand-400/20 bg-background px-2 py-1.5 text-xs outline-none focus:border-brand-400/50";

function SegmentButton({ active, disabled, onClick, children }: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return <button type="button" aria-pressed={active} disabled={disabled} onClick={onClick}
    className={`flex-1 rounded-md px-2 py-1.5 text-[11px] transition disabled:cursor-not-allowed disabled:opacity-35 ${active ? "bg-brand-400/20 text-brand-400" : "text-foreground/60 hover:bg-brand-400/10"}`}>
    {children}
  </button>;
}

function NumberField({ label, value, onChange, min = -100, max = 200, step = 0.0001 }: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return <label><span className="text-[10px] text-foreground/55">{label}</span><input type="number" value={roundVectorValue(value)} min={min} max={max} step={step}
    onChange={(event) => { const next = Number(event.target.value); if (Number.isFinite(next)) onChange(next); }} className={inputClass} /></label>;
}

export function VectorPropertiesPanel() {
  const vector = useVectorEdit();
  const { draft, updateLayer } = useFlyerDraft();
  const { session } = vector;
  if (!session) return null;

  const activeNode = session.activeNodeIndex === null ? null : session.workingNodes[session.activeNodeIndex] ?? null;
  const storedLayer = session.layerId ? draft.layers.find((layer) => layer.id === session.layerId) : null;
  const updateAppearance = (patch: Partial<VectorAppearance>) => {
    vector.setAppearance(patch);
    if (storedLayer) updateLayer(storedLayer.id, patch);
  };
  const updateHandle = (type: VectorHandleType, axis: "x" | "y", value: number) => {
    if (!activeNode) return;
    const handle = activeNode[type];
    if (!handle) return;
    vector.updateActiveHandle(type, axis === "x" ? value : handle.x, axis === "y" ? value : handle.y);
  };
  const setMirror = (mirror: MirrorMode) => vector.setActiveNodeMirror(mirror);

  return <div className="space-y-4 overflow-x-hidden pb-4 text-xs">
    <section className={sectionClass}>
      <h4 className="text-[10px] font-bold uppercase tracking-wider text-brand-400">Path</h4>
      <div className="space-y-1 text-[11px] text-foreground/60">
        <p>{session.closed ? "Closed path" : "Open path"}</p>
        <p>{session.workingNodes.length} {session.workingNodes.length === 1 ? "point" : "points"}</p>
        <p>{session.mode === "create" ? "Creating a new path" : "Editing an existing path"}</p>
      </div>
      <div className="flex rounded-lg border border-brand-400/15 bg-background p-0.5">
        <SegmentButton active={!session.closed} onClick={() => vector.setClosed(false)}>Open</SegmentButton>
        <SegmentButton active={session.closed} disabled={!session.closed && session.workingNodes.length < 3} onClick={() => vector.setClosed(true)}>Closed</SegmentButton>
      </div>
      {session.workingNodes.length < 3 && <p className="text-[10px] text-foreground/45">A closed path needs at least three points.</p>}
    </section>

    <section className={sectionClass}>
      <div className="flex items-center justify-between">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-brand-400">Selected point</h4>
        <span className="text-[10px] text-foreground/50">{activeNode && session.activeNodeIndex !== null ? `${session.activeNodeIndex + 1} / ${session.workingNodes.length}` : `0 / ${session.workingNodes.length}`}</span>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => vector.cycleActiveNode(-1)} disabled={!session.workingNodes.length} className="flex-1 rounded-lg border border-brand-400/15 py-1.5 disabled:opacity-35">Previous</button>
        <button type="button" onClick={() => vector.cycleActiveNode(1)} disabled={!session.workingNodes.length} className="flex-1 rounded-lg border border-brand-400/15 py-1.5 disabled:opacity-35">Next</button>
      </div>
      {!activeNode ? <p className="text-[11px] text-foreground/50">Select a vector point on the canvas to edit its position and handles.</p> : <>
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="X" value={activeNode.x} onChange={(x) => vector.updateActiveNodePosition(x, activeNode.y)} />
          <NumberField label="Y" value={activeNode.y} onChange={(y) => vector.updateActiveNodePosition(activeNode.x, y)} />
        </div>
        <div className="flex rounded-lg border border-brand-400/15 bg-background p-0.5">
          <SegmentButton active={!activeNode.handleIn && !activeNode.handleOut} onClick={vector.convertActiveNodeToCorner}>Corner</SegmentButton>
          <SegmentButton active={Boolean(activeNode.handleIn || activeNode.handleOut)} onClick={vector.convertActiveNodeToSmooth}>Smooth</SegmentButton>
        </div>
      </>}
    </section>

    {activeNode && (activeNode.handleIn || activeNode.handleOut) && <section className={sectionClass}>
      <h4 className="text-[10px] font-bold uppercase tracking-wider text-brand-400">Handles</h4>
      <div className="flex rounded-lg border border-brand-400/15 bg-background p-0.5">
        {(["mirrored", "asymmetric", "disconnected"] as const).map((mirror) => <SegmentButton key={mirror} active={activeNode.mirror === mirror} onClick={() => setMirror(mirror)}>{mirror === "mirrored" ? "Mirrored" : mirror === "asymmetric" ? "Asym." : "Free"}</SegmentButton>)}
      </div>
      {(["handleIn", "handleOut"] as const).map((type) => {
        const handle = activeNode[type];
        return <div key={type} className="space-y-2">
          <div className="flex items-center justify-between"><span className="text-[10px] font-medium text-foreground/60">{type === "handleIn" ? "Handle in" : "Handle out"}</span>{!handle && <button type="button" onClick={vector.convertActiveNodeToSmooth} className="text-[10px] text-brand-400">Add handle</button>}</div>
          {handle ? <div className="grid grid-cols-2 gap-2"><NumberField label="X" value={handle.x} onChange={(value) => updateHandle(type, "x", value)} /><NumberField label="Y" value={handle.y} onChange={(value) => updateHandle(type, "y", value)} /></div> : <p className="text-[10px] text-foreground/40">Not set</p>}
        </div>;
      })}
    </section>}

    <section className={sectionClass}>
      <h4 className="text-[10px] font-bold uppercase tracking-wider text-brand-400">Appearance</h4>
      <ModernColorPicker label="Stroke colour" color={session.appearance.stroke} onColorChange={(stroke) => updateAppearance({ stroke })} />
      <NumberField label="Stroke width" value={session.appearance.strokeWidth} min={0} max={40} step={0.5} onChange={(strokeWidth) => updateAppearance({ strokeWidth })} />
      <div aria-disabled={!session.closed} className={!session.closed ? "pointer-events-none opacity-45" : undefined}>
        <ModernColorPicker label="Fill colour" color={session.appearance.fill === "none" ? "#ffffff" : session.appearance.fill} onColorChange={(fill) => updateAppearance({ fill })} />
      </div>
      {!session.closed && <p className="text-[10px] text-foreground/45">Fill is available for closed paths. The stored fill is retained.</p>}
      <label><span className="text-[10px] text-foreground/55">Opacity · {Math.round(session.appearance.opacity * 100)}%</span><input type="range" min="0" max="100" value={Math.round(session.appearance.opacity * 100)} onChange={(event) => updateAppearance({ opacity: Number(event.target.value) / 100 })} className="mt-2 w-full accent-brand-400" /></label>
    </section>

    <section className={sectionClass}>
      <button type="button" onClick={vector.deleteActiveNode} disabled={!activeNode} className="w-full rounded-lg border border-red-400/20 py-2 text-red-400 disabled:opacity-35">Delete point</button>
      {(session.validationMessage || session.workingNodes.length < 2) && <p className="text-[10px] text-red-400">{session.validationMessage ?? "A path needs at least two points."}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={vector.cancel} className="rounded-lg border border-brand-400/20 py-2">Cancel</button>
        <button type="button" onClick={vector.commit} disabled={session.workingNodes.length < 2} className="rounded-lg bg-brand-400 py-2 font-semibold text-black disabled:opacity-35">Done</button>
      </div>
    </section>
  </div>;
}
