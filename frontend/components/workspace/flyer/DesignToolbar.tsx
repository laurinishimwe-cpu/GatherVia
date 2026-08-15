"use client";

import { useState, useRef } from "react";
import { useFlyerDraft } from "@/context/FlyerDraftContext";
import { ORIGINAL_FLYER_TOP_RATIO } from "@/lib/invitation/originalFlyerLayout";

function ChevronIcon() {
  return (
    <svg className="h-3 w-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export function DesignToolbar() {
  const { addLayer, addImageFromDevice, draft, setStubPreviewMode, setViewport, activeTool, setActiveTool } = useFlyerDraft();
  const { viewport } = draft;

  const [shapeMenuOpen, setShapeMenuOpen] = useState(false);
  const [polygonSides, setPolygonSides] = useState(6);
  const [cursorMenuOpen, setCursorMenuOpen] = useState(false);

  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest(".menu-content")) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setPosition({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const getCanvasRatio = () => {
    if (draft.configuration?.image_width && draft.configuration?.image_height) {
      return (
        draft.configuration.image_width /
        (draft.configuration.image_height * ORIGINAL_FLYER_TOP_RATIO)
      );
    }
    // Fallback to reading the physical DOM element
    const canvasEl = document.getElementById("editor-canvas") || document.querySelector("[data-canvas]");
    if (canvasEl) {
      return canvasEl.clientWidth / canvasEl.clientHeight;
    }
    return 1080 / 1920; 
  };

  const addPolygonLayer = (sides: number) => {
    const canvasRatio = getCanvasRatio();
    const defaultWidth = 20;
    const defaultHeight = defaultWidth * canvasRatio;


    let points = "";
    const angleStep = (2 * Math.PI) / sides;
    for (let i = 0; i < sides; i++) {
      const angle = i * angleStep - Math.PI / 2;
      const x = 50 + 50 * Math.cos(angle);
      const y = 50 + 50 * Math.sin(angle);
      points += `${x},${y} `;
    }

    addLayer({
      type: "polygon", 
      name: `Polygon (${sides})`,
      points: points.trim(),
      x: 40, y: 40, width: defaultWidth, height: defaultHeight,
      fill: "#cfcfcf", stroke: "#000000", strokeWidth: 0,
      rotation: 0, opacity: 1, zIndex: draft.layers.length,
      visible: true, locked: false,
    });
  };

  // --- LINE ---
  const addLineLayer = () => {
    addLayer({
      type: "path",
      name: "Line",
      pathData: "M 0 50 L 100 50",
      nodes: [
        { id: crypto.randomUUID(), x: 0, y: 50, mirror: "mirrored" },
        { id: crypto.randomUUID(), x: 100, y: 50, mirror: "mirrored" }
      ], 
      x: 35, y: 50, width: 30, height: 0.5,
      fill: "none", stroke: "#000000", strokeWidth: 4,
      rotation: 0, opacity: 1, zIndex: draft.layers.length,
      visible: true, locked: false,
    });
  };

  // --- RECT & ELLIPSE (NATIVE TYPES SO THEY DON'T COLLAPSE) ---
  const addShapeLayer = (shapeType: "rect" | "ellipse") => {
    const canvasRatio = getCanvasRatio();
    const defaultWidth = 20;
    const defaultHeight = defaultWidth * canvasRatio; // Guaranteed perfect aspect ratio

    addLayer({
      type: shapeType, 
      name: shapeType === "rect" ? "Rectangle" : "Ellipse",
      x: 40, y: 40, width: defaultWidth, height: defaultHeight,
      rotation: 0, opacity: 1, zIndex: draft.layers.length,
      visible: true, locked: false, fill: "#cfcfcf", stroke: "#000000", strokeWidth: 0,
    });
    
    setShapeMenuOpen(false);
  };

  const handleImageUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) void addImageFromDevice(file);
    };
    input.click();
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className={`fixed bottom-4 left-1/2 z-50 flex items-center gap-1.5 bg-background/90 backdrop-blur-xl border border-brand-400/20 rounded-full pl-2 pr-2.5 py-1.5 shadow-lg touch-none ${
        isDragging ? "cursor-grabbing" : "cursor-grab"
      }`}
      style={{ transform: `translate(calc(-50% + ${position.x}px), ${position.y}px)` }}
    >
      <div className="flex flex-col gap-[3px] px-1.5 text-foreground/30 hover:text-foreground/50 transition">
        <div className="w-1 h-1 rounded-full bg-current" />
        <div className="w-1 h-1 rounded-full bg-current" />
        <div className="w-1 h-1 rounded-full bg-current" />
      </div>

      <div className="w-[1px] h-5 bg-brand-400/20 mx-0.5" />

      <div className="relative">
        <button
          onClick={() => setCursorMenuOpen(!cursorMenuOpen)}
          className="flex items-center gap-0.5 p-1.5 rounded-full hover:bg-brand-400/10 text-foreground/70 hover:text-brand-400 transition"
          title="Selection tools"
        >
          {activeTool !== "hand" ? (
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" /></svg>
          ) : (
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 11V7a5 5 0 0110 0v4m-5 8v-4m-4 0h8a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2z" /></svg>
          )}
          <ChevronIcon />
        </button>
        {cursorMenuOpen && (
          <div className="menu-content absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-background/95 backdrop-blur-xl border border-brand-400/20 rounded-2xl p-2 shadow-lg flex flex-col gap-1">
            <button title="Select (V)" onClick={() => { setActiveTool("select"); setCursorMenuOpen(false); }} className={`flex items-center gap-2 p-2 rounded-lg text-xs transition ${activeTool === "select" ? "bg-brand-400/20 text-brand-400" : "hover:bg-brand-400/10 text-foreground/70"}`}>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" /></svg> Pointer
            </button>
            <button title="Hand (H)" onClick={() => { setActiveTool("hand"); setCursorMenuOpen(false); }} className={`flex items-center gap-2 p-2 rounded-lg text-xs transition ${activeTool === "hand" ? "bg-brand-400/20 text-brand-400" : "hover:bg-brand-400/10 text-foreground/70"}`}>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 11V7a5 5 0 0110 0v4m-5 8v-4m-4 0h8a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2z" /></svg> Hand
            </button>
          </div>
        )}
      </div>

      <button
        onClick={() => setActiveTool(activeTool === "pen" ? "select" : "pen")}
        className={`p-1.5 rounded-full transition ${activeTool === "pen" ? "bg-brand-400/20 text-brand-400" : "hover:bg-brand-400/10 text-foreground/70 hover:text-brand-400"}`}
        title="Pen (P)"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
      </button>

      <div className="w-[1px] h-5 bg-brand-400/20 mx-0.5" />

      <button onClick={() => setActiveTool("text")} className={`p-1.5 rounded-full transition ${activeTool === "text" ? "bg-brand-400/20 text-brand-400" : "hover:bg-brand-400/10 text-foreground/70 hover:text-brand-400"}`} title="Text (T)">
        <span className="font-serif text-base font-bold leading-none">T</span>
      </button>

      <div className="relative">
        <button onClick={() => setShapeMenuOpen(!shapeMenuOpen)} className="flex items-center gap-0.5 p-1.5 rounded-full hover:bg-brand-400/10 text-foreground/70 hover:text-brand-400 transition" title="Add shape">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <ChevronIcon />
        </button>
        {shapeMenuOpen && (
          <div className="menu-content absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-background/95 backdrop-blur-xl border border-brand-400/20 rounded-2xl p-3 shadow-lg flex flex-col gap-2">
            <div className="flex gap-2">
              <button onClick={() => addShapeLayer("rect")} className="p-2 rounded-lg hover:bg-brand-400/10 text-foreground/70 hover:text-brand-400 transition" title="Rectangle"><svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="1" /></svg></button>
              <button onClick={() => addShapeLayer("ellipse")} className="p-2 rounded-lg hover:bg-brand-400/10 text-foreground/70 hover:text-brand-400 transition" title="Circle"><svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /></svg></button>
              <button onClick={() => { addLineLayer(); setShapeMenuOpen(false); }} className="p-2 rounded-lg hover:bg-brand-400/10 text-foreground/70 hover:text-brand-400 transition" title="Line"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><line x1="4" y1="20" x2="20" y2="4" /></svg></button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { addPolygonLayer(polygonSides); setShapeMenuOpen(false); }} className="p-2 rounded-lg hover:bg-brand-400/10 text-foreground/70 hover:text-brand-400 transition" title="Polygon">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><polygon points="12,2 22,8 22,16 12,22 2,16 2,8" /></svg>
              </button>
              <input type="number" min="3" max="12" value={polygonSides} onChange={(e) => setPolygonSides(Number(e.target.value))} className="w-10 text-xs rounded-md border border-brand-400/20 bg-background px-1 py-0.5 outline-none" title="Number of sides" />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button onClick={() => setViewport((p) => ({ ...p, scale: Math.max(0.1, p.scale - 0.2) }))} className="p-1.5 rounded-full hover:bg-brand-400/10 text-foreground/70 hover:text-brand-400 transition text-xs font-medium" title="Zoom out">−</button>
        <span className="text-[10px] font-mono w-8 text-center select-none">{Math.round(viewport.scale * 100)}%</span>
        <button onClick={() => setViewport((p) => ({ ...p, scale: Math.min(4, p.scale + 0.2) }))} className="p-1.5 rounded-full hover:bg-brand-400/10 text-foreground/70 hover:text-brand-400 transition text-xs font-medium" title="Zoom in">+</button>
      </div>

      <button onClick={() => setViewport({ x: 0, y: 0, scale: 1 })} className="p-1.5 rounded-full hover:bg-brand-400/10 text-foreground/70 hover:text-brand-400 transition text-[10px] font-medium" title="Reset View">Reset</button>

      <div className="w-[1px] h-5 bg-brand-400/20 mx-0.5" />

      <button onClick={handleImageUpload} className="p-1.5 rounded-full hover:bg-brand-400/10 text-foreground/70 hover:text-brand-400 transition" title="Upload image">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
      </button>

      <button onClick={() => setStubPreviewMode(true)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full hover:bg-brand-400/10 text-foreground/70 hover:text-brand-400 transition ml-1" title="Preview invitation">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
        <span className="text-xs font-medium">Preview</span>
      </button>
    </div>
  );
}
