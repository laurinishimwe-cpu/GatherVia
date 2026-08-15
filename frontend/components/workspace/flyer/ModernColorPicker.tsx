"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

interface ModernColorPickerProps {
  label?: string;
  color: string;
  opacity?: number;
  onColorChange: (color: string) => void;
  onOpacityChange?: (opacity: number) => void;
  showOpacity?: boolean;
}

interface GradientStop {
  id: string;
  color: string;
  position: number;
}

// --- HSV / RGB / HEX / ALPHA Utility Functions ---
function hexToRgba(hex: string): { r: number; g: number; b: number; a: number } {
  let clean = hex.replace(/^#/, "");
  if (clean.length === 3) clean = clean.split("").map((c) => c + c).join("");
  else if (clean.length === 4) clean = clean.split("").map((c) => c + c).join("");

  const r = parseInt(clean.slice(0, 2), 16) || 0;
  const g = parseInt(clean.slice(2, 4), 16) || 0;
  const b = parseInt(clean.slice(4, 6), 16) || 0;
  let a = 1;

  if (clean.length === 8) {
    a = Math.round((parseInt(clean.slice(6, 8), 16) / 255) * 100) / 100;
  }
  return { r, g, b, a };
}

function rgbToHex(r: number, g: number, b: number, a: number = 1, forceAlpha = false): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  let hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  if (a < 1 || forceAlpha) hex += toHex(a * 255);
  return hex.toUpperCase();
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (max !== min) {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, v: v * 100 };
}

function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  s /= 100; v /= 100;
  const i = Math.floor((h / 60) % 6);
  const f = h / 60 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let r = 0, g = 0, b = 0;
  switch (i) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }
  return { r: r * 255, g: g * 255, b: b * 255 };
}

const checkerboardBg =
  "bg-background bg-[linear-gradient(45deg,rgba(0,0,0,0.05)_25%,transparent_25%),linear-gradient(-45deg,rgba(0,0,0,0.05)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,rgba(0,0,0,0.05)_75%),linear-gradient(-45deg,transparent_75%,rgba(0,0,0,0.05)_75%)] dark:bg-[linear-gradient(45deg,rgba(255,255,255,0.08)_25%,transparent_25%),linear-gradient(-45deg,rgba(255,255,255,0.08)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,rgba(255,255,255,0.08)_75%),linear-gradient(-45deg,transparent_75%,rgba(255,255,255,0.08)_75%)] bg-[size:8px_8px] bg-[position:0_0,0_4px,4px_-4px,-4px_0]";

function isGradientString(str: string): boolean {
  return /^(linear|radial)-gradient\(/.test(str);
}

function parseGradient(str: string, existingStops?: GradientStop[]): { type: string; angle: number; stops: GradientStop[] } {
  const defaultRes = { type: "linear", angle: 90, stops: [{ id: "1", color: "#FF0000", position: 0 }, { id: "2", color: "#0000FF", position: 100 }] };
  if (!str) return defaultRes;
  const match = str.match(/^(linear|radial)-gradient\((.*)\)$/);
  if (!match) return defaultRes;
  
  const type = match[1];
  const parts = match[2].match(/(?:[^,]+|\([^)]+\))+/g)?.map((s) => s.trim()) || [];
  let angle = 90;

  if (type === "linear" && (parts[0].endsWith("deg") || parts[0].startsWith("to "))) {
    const anglePart = parts.shift();
    if (anglePart?.endsWith("deg")) angle = parseFloat(anglePart);
  } else if (type === "radial" && parts[0].includes("circle")) {
    parts.shift();
  }

  const stops = parts.map((part, i) => {
    const pMatch = part.match(/^(#[\da-fA-F]+|rgba?\([^)]+\)|[a-zA-Z]+)\s*(\d+(?:\.\d+)?%)?$/);
    const color = pMatch ? pMatch[1] : part;
    const posStr = pMatch && pMatch[2] ? pMatch[2] : null;
    let position = i === 0 ? 0 : i === parts.length - 1 ? 100 : (i / (parts.length - 1)) * 100;
    if (posStr) position = parseFloat(posStr);
    
    const id = existingStops && existingStops[i] ? existingStops[i].id : Math.random().toString(36).substring(7);
    return { id, color, position };
  });

  return { type, angle, stops: stops.length >= 2 ? stops : defaultRes.stops };
}

function generateGradientCss(type: string, angle: number, stops: GradientStop[]): string {
  const sorted = [...stops].sort((a, b) => a.position - b.position);
  const stopsStr = sorted.map((s) => `${s.color} ${s.position}%`).join(", ");
  return type === "radial" ? `radial-gradient(circle, ${stopsStr})` : `linear-gradient(${angle}deg, ${stopsStr})`;
}

const STATE_EPSILON = 0.001;

function areNumbersEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < STATE_EPSILON;
}

function areHsvValuesEqual(
  a: { h: number; s: number; v: number },
  b: { h: number; s: number; v: number },
): boolean {
  return areNumbersEqual(a.h, b.h) && areNumbersEqual(a.s, b.s) && areNumbersEqual(a.v, b.v);
}

function areGradientStopsEqual(a: GradientStop[], b: GradientStop[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (stop, index) =>
        stop.id === b[index]?.id &&
        stop.color === b[index]?.color &&
        areNumbersEqual(stop.position, b[index]?.position ?? Number.NaN),
    )
  );
}

function normalizeColorForComparison(value: string): string {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

function areColorsEqual(a: string, b: string): boolean {
  return normalizeColorForComparison(a) === normalizeColorForComparison(b);
}

function getHexInputValue(
  hsv: { h: number; s: number; v: number },
  alpha: number,
): string {
  const rgb = hsvToRgb(hsv.h, hsv.s, hsv.v);
  return rgbToHex(rgb.r, rgb.g, rgb.b, alpha).replace(/^#/, "");
}

export function ModernColorPicker({
  label,
  color,
  opacity,
  onColorChange,
  onOpacityChange,
  showOpacity = true,
}: ModernColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [gradientMode, setGradientMode] = useState(() => isGradientString(color));
  
  // Gradient state
  const [gradientType, setGradientType] = useState<string>("linear");
  const [gradientAngle, setGradientAngle] = useState(90);
  const [stops, setStops] = useState<GradientStop[]>([]);
  const [activeStopId, setActiveStopId] = useState<string>("");

  // Core HSV state
  const [hsv, setHsv] = useState({ h: 0, s: 0, v: 0 });
  const [internalAlpha, setInternalAlpha] = useState(1);
  const [hexInputValue, setHexInputValue] = useState("");

  // Refs to avoid stale closures
  const stopsRef = useRef(stops);
  const hsvRef = useRef(hsv);
  const internalAlphaRef = useRef(internalAlpha);
  const gradientTypeRef = useRef(gradientType);
  const gradientAngleRef = useRef(gradientAngle);
  const activeStopIdRef = useRef(activeStopId);
  const gradientModeRef = useRef(gradientMode);
  
  stopsRef.current = stops;
  hsvRef.current = hsv;
  internalAlphaRef.current = internalAlpha;
  gradientTypeRef.current = gradientType;
  gradientAngleRef.current = gradientAngle;
  activeStopIdRef.current = activeStopId;
  gradientModeRef.current = gradientMode;

  const onColorChangeRef = useRef(onColorChange);
  const onOpacityChangeRef = useRef(onOpacityChange);
  const lastKnownColorRef = useRef(color);
  const lastKnownOpacityRef = useRef(opacity);
  
  useEffect(() => {
    onColorChangeRef.current = onColorChange;
    onOpacityChangeRef.current = onOpacityChange;
  }, [onColorChange, onOpacityChange]);

  const emitColorChange = useCallback((nextColor: string) => {
    if (areColorsEqual(lastKnownColorRef.current, nextColor)) return;

    // Update immediately so rapid pointer events cannot emit the same value
    // repeatedly before the parent has completed its re-render.
    lastKnownColorRef.current = nextColor;
    onColorChangeRef.current(nextColor);
  }, []);

  const emitOpacityChange = useCallback((nextOpacity: number) => {
    if (
      lastKnownOpacityRef.current !== undefined &&
      areNumbersEqual(lastKnownOpacityRef.current, nextOpacity)
    ) {
      return;
    }

    lastKnownOpacityRef.current = nextOpacity;
    onOpacityChangeRef.current?.(nextOpacity);
  }, []);

  const syncLocalColor = useCallback((
    nextHsv: { h: number; s: number; v: number },
    nextAlpha: number,
  ) => {
    if (!areHsvValuesEqual(hsvRef.current, nextHsv)) {
      hsvRef.current = nextHsv;
      setHsv(nextHsv);
    }

    if (!areNumbersEqual(internalAlphaRef.current, nextAlpha)) {
      internalAlphaRef.current = nextAlpha;
      setInternalAlpha(nextAlpha);
    }

    const nextHexInputValue = getHexInputValue(nextHsv, nextAlpha);
    setHexInputValue((current) =>
      current === nextHexInputValue ? current : nextHexInputValue,
    );
  }, []);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const satBoxRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });
  const [isDraggingSat, setIsDraggingSat] = useState(false);
  const [isDraggingPopover, setIsDraggingPopover] = useState(false);
  const [draggingStopId, setDraggingStopId] = useState<string | null>(null);

  const dragStartPos = useRef({ x: 0, y: 0 });
  const popoverStartPos = useRef({ top: 0, left: 0 });
  const dragContext = useRef<{ stopId: string; startX: number; startPos: number } | null>(null);

  // ─── Synchronise from external controlled props ────
  useEffect(() => {
    lastKnownColorRef.current = color;
    lastKnownOpacityRef.current = opacity;

    const nextGradientMode = isGradientString(color);
    gradientModeRef.current = nextGradientMode;
    setGradientMode((current) => (current === nextGradientMode ? current : nextGradientMode));

    if (nextGradientMode) {
      const parsed = parseGradient(color, stopsRef.current);

      gradientTypeRef.current = parsed.type;
      gradientAngleRef.current = parsed.angle;
      setGradientType((current) => (current === parsed.type ? current : parsed.type));
      setGradientAngle((current) => (areNumbersEqual(current, parsed.angle) ? current : parsed.angle));

      if (!areGradientStopsEqual(stopsRef.current, parsed.stops)) {
        stopsRef.current = parsed.stops;
        setStops(parsed.stops);
      }

      const targetStop =
        parsed.stops.find((stop) => stop.id === activeStopIdRef.current) ?? parsed.stops[0];

      if (targetStop) {
        if (activeStopIdRef.current !== targetStop.id) {
          activeStopIdRef.current = targetStop.id;
          setActiveStopId(targetStop.id);
        }

        const rgba = hexToRgba(targetStop.color);
        const nextHsv = rgbToHsv(rgba.r, rgba.g, rgba.b);

        syncLocalColor(nextHsv, rgba.a);
      }

      return;
    }

    const rgba = hexToRgba(color || "#000000");
    const nextAlpha = opacity ?? rgba.a;
    const nextHsv = rgbToHsv(rgba.r, rgba.g, rgba.b);

    syncLocalColor(nextHsv, nextAlpha);
  }, [color, opacity, syncLocalColor]);

  // ─── Positioning engine ────────────────────────────
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popoverWidth = 280, popoverHeight = gradientMode ? 540 : 360, safetyMargin = 12;
    let left = Math.max(safetyMargin, rect.left);
    if (left + popoverWidth > window.innerWidth - safetyMargin) left = window.innerWidth - popoverWidth - safetyMargin;
    let top = rect.bottom + 8;
    if (top + popoverHeight > window.innerHeight - safetyMargin) {
      top = rect.top - popoverHeight - 8 >= safetyMargin ? rect.top - popoverHeight - 8 : safetyMargin;
    }
    setPopoverPos({ top, left });
  }, [gradientMode]);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener("resize", updatePosition);
      window.addEventListener("scroll", updatePosition, true);
    }
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen, updatePosition]); // ✅ Explicit

  // ─── Close on outside click ────────────────────────
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node) && triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  // ─── Popover drag ──────────────────────────────────
  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    setIsDraggingPopover(true);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    popoverStartPos.current = { ...popoverPos };
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingPopover) return;
      setPopoverPos({
        top: popoverStartPos.current.top + (e.clientY - dragStartPos.current.y),
        left: popoverStartPos.current.left + (e.clientX - dragStartPos.current.x),
      });
    };
    const onMouseUp = () => setIsDraggingPopover(false);
    if (isDraggingPopover) {
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isDraggingPopover]);

  // ─── Color update logic ────────────────────────────
  const updateActiveColor = useCallback((newH: number, newS: number, newV: number, newA: number) => {
    const rgb = hsvToRgb(newH, newS, newV);
    const hex = rgbToHex(rgb.r, rgb.g, rgb.b, newA);

    if (gradientModeRef.current) {
      const nextStops = stopsRef.current.map((s) => (s.id === activeStopIdRef.current ? { ...s, color: hex } : s));
      stopsRef.current = nextStops; 
      setStops(nextStops);
      emitColorChange(generateGradientCss(gradientTypeRef.current, gradientAngleRef.current, nextStops));
    } else {
      if (onOpacityChangeRef.current) {
        emitColorChange(rgbToHex(rgb.r, rgb.g, rgb.b, 1));
        emitOpacityChange(newA);
      } else {
        emitColorChange(hex);
      }
    }
  }, [emitColorChange, emitOpacityChange]);

  const updateHsv = useCallback((newH: number, newS: number, newV: number) => {
    const nextHsv = { h: newH, s: newS, v: newV };
    syncLocalColor(nextHsv, internalAlphaRef.current);
    updateActiveColor(newH, newS, newV, internalAlphaRef.current);
  }, [syncLocalColor, updateActiveColor]);

  const updateAlpha = useCallback((newA: number) => {
    const clamped = Math.max(0, Math.min(1, Math.round(newA * 100) / 100));
    syncLocalColor(hsvRef.current, clamped);
    updateActiveColor(hsvRef.current.h, hsvRef.current.s, hsvRef.current.v, clamped);
  }, [syncLocalColor, updateActiveColor]);

  const handleSatBoxMove = useCallback((e: MouseEvent | React.MouseEvent) => {
    if (!satBoxRef.current) return;
    const rect = satBoxRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    updateHsv(hsvRef.current.h, (x / rect.width) * 100, 100 - (y / rect.height) * 100);
  }, [updateHsv]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => isDraggingSat && handleSatBoxMove(e);
    const onMouseUp = () => setIsDraggingSat(false);
    if (isDraggingSat) {
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isDraggingSat, handleSatBoxMove]);

  // ─── EyeDropper ─────────────────────────────────────
  const handleEyeDropper = async () => {
    if (typeof window === "undefined" || !("EyeDropper" in window)) return;
    try {
      // @ts-ignore
      const eyeDropper = new window.EyeDropper();
      const result = await eyeDropper.open();
      const rgba = hexToRgba(result.sRGBHex);
      const newHsv = rgbToHsv(rgba.r, rgba.g, rgba.b);
      
      syncLocalColor(newHsv, rgba.a);
      updateActiveColor(newHsv.h, newHsv.s, newHsv.v, rgba.a);
    } catch (err) {
      console.log("EyeDropper dismissed or failed");
    }
  };

  // ─── Gradient track & stops ────────────────────────
  const handleTrackMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".stop-thumb-pin")) return;

    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const position = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    
    const solidHex = rgbToHex(
      hsvToRgb(hsvRef.current.h, hsvRef.current.s, hsvRef.current.v).r,
      hsvToRgb(hsvRef.current.h, hsvRef.current.s, hsvRef.current.v).g,
      hsvToRgb(hsvRef.current.h, hsvRef.current.s, hsvRef.current.v).b,
      internalAlphaRef.current
    );
    const newStop = { id: Math.random().toString(36).substring(7), color: solidHex, position };
    const newStops = [...stopsRef.current, newStop].sort((a, b) => a.position - b.position);
    
    stopsRef.current = newStops;
    setStops(newStops);
    setActiveStopId(newStop.id);
    activeStopIdRef.current = newStop.id;
    emitColorChange(generateGradientCss(gradientTypeRef.current, gradientAngleRef.current, newStops));
  };

  const handleStopMouseDown = (e: React.MouseEvent, stopId: string) => {
    e.stopPropagation();
    setActiveStopId(stopId);
    activeStopIdRef.current = stopId;
    setDraggingStopId(stopId);

    const stop = stopsRef.current.find((s) => s.id === stopId);
    if (stop) {
      dragContext.current = { stopId, startX: e.clientX, startPos: stop.position };
      const rgba = hexToRgba(stop.color);
      const newHsv = rgbToHsv(rgba.r, rgba.g, rgba.b);
      syncLocalColor(newHsv, rgba.a);
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragContext.current || !trackRef.current) return;
      
      const { stopId, startX, startPos } = dragContext.current;
      const rect = trackRef.current.getBoundingClientRect();
      
      const deltaX = e.clientX - startX;
      const deltaPercent = (deltaX / rect.width) * 100;
      const newPosition = Math.max(0, Math.min(100, startPos + deltaPercent));
      
      const nextStops = stopsRef.current.map((s) => (s.id === stopId ? { ...s, position: newPosition } : s));
      stopsRef.current = nextStops; 
      setStops(nextStops);
      emitColorChange(generateGradientCss(gradientTypeRef.current, gradientAngleRef.current, nextStops));
    };
    
    const handleMouseUp = () => {
      setDraggingStopId(null);
      dragContext.current = null;
    };
    
    if (draggingStopId) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [draggingStopId]);

  const handleDeleteStop = (stopId: string) => {
    if (stopsRef.current.length <= 2) return;
    const nextStops = stopsRef.current.filter((s) => s.id !== stopId);
    stopsRef.current = nextStops;
    setStops(nextStops);
    emitColorChange(generateGradientCss(gradientTypeRef.current, gradientAngleRef.current, nextStops));

    if (activeStopIdRef.current === stopId) {
      const nextActive = nextStops[0];
      setActiveStopId(nextActive.id);
      activeStopIdRef.current = nextActive.id;
      const rgba = hexToRgba(nextActive.color);
      const newHsv = rgbToHsv(rgba.r, rgba.g, rgba.b);
      syncLocalColor(newHsv, rgba.a);
    }
  };

  const handleHexInput = (val: string) => {
    setHexInputValue(val);
    const clean = val.replace(/[^0-9A-Fa-f]/g, "").slice(0, 8).toUpperCase();
    if (clean.length === 6 || clean.length === 3 || clean.length === 8) {
      const rgba = hexToRgba(`#${clean}`);
      const newHsv = rgbToHsv(rgba.r, rgba.g, rgba.b);
      syncLocalColor(newHsv, rgba.a);
      updateActiveColor(newHsv.h, newHsv.s, newHsv.v, rgba.a);
    }
  };

  const solidHex = rgbToHex(hsvToRgb(hsv.h, hsv.s, hsv.v).r, hsvToRgb(hsv.h, hsv.s, hsv.v).g, hsvToRgb(hsv.h, hsv.s, hsv.v).b, 1);
  const pureHueHex = rgbToHex(...(Object.values(hsvToRgb(hsv.h, 100, 100)) as [number, number, number]), 1);
  const triggerBg = gradientMode && stops.length > 0 ? generateGradientCss(gradientType, gradientAngle, stops) : solidHex;
  const triggerOpacity = gradientMode ? 1 : internalAlpha;

  return (
    <div className="inline-block w-full">
      {label && <span className="text-[11px] font-medium text-foreground/70">{label}</span>}
      <div className="flex items-center gap-2 mt-1">
        <button
          ref={triggerRef}
          onClick={() => setIsOpen(!isOpen)}
          className={`h-8 w-8 rounded-md border border-brand-400/20 bg-background overflow-hidden relative shadow-sm hover:border-brand-400/40 transition ${checkerboardBg}`}
        >
          <div className="absolute inset-0" style={{ background: triggerBg, opacity: triggerOpacity }} />
        </button>

        <div className="flex-1 relative flex items-center border border-brand-400/20 rounded-lg bg-background px-2 py-1">
          <span className="text-xs text-foreground/40 font-mono mr-1">#</span>
          <input
            type="text"
            value={hexInputValue}
            onChange={(e) => handleHexInput(e.target.value)}
            className="w-full bg-transparent text-xs outline-none uppercase font-mono text-foreground"
            maxLength={8}
          />
        </div>
      </div>

      {isOpen &&
        createPortal(
          <div
            ref={popoverRef}
            style={{ top: popoverPos.top, left: popoverPos.left, zIndex: 99999 }}
            className="fixed w-[280px] max-h-[calc(100vh-24px)] overflow-y-auto rounded-xl border border-brand-400/20 bg-background shadow-2xl select-none scrollbar-custom animate-in fade-in zoom-in-95 duration-100 flex flex-col"
          >
            <div
              className="flex items-center justify-between px-3 py-2.5 border-b border-brand-400/10 sticky top-0 bg-background z-10 shrink-0"
              onMouseDown={handleHeaderMouseDown}
              style={{ cursor: isDraggingPopover ? "grabbing" : "grab" }}
            >
              <span className="text-xs font-semibold text-foreground">Color Picker</span>
              <button onClick={() => setIsOpen(false)} className="text-foreground/50 hover:text-foreground transition rounded p-0.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-3 overflow-y-auto">
              <div className="flex bg-brand-400/10 rounded-lg p-0.5 mb-3">
                <button
                  onClick={() => {
                    setGradientMode(false);
                    const rgba = hexToRgba(stops.find(s => s.id === activeStopId)?.color || "#000000");
                    syncLocalColor(rgbToHsv(rgba.r, rgba.g, rgba.b), rgba.a);
                  }}
                  className={`flex-1 text-[10px] font-medium py-1 rounded-md transition ${!gradientMode ? "bg-background shadow-sm text-foreground" : "text-foreground/60 hover:text-foreground"}`}
                >
                  Solid
                </button>
                <button
                  onClick={() => {
                    setGradientMode(true);
                    if (stops.length < 2) {
                      const newStops = [{ id: "1", color: solidHex, position: 0 }, { id: "2", color: "#FFFFFF00", position: 100 }];
                      setStops(newStops);
                      setActiveStopId("1");
                    }
                  }}
                  className={`flex-1 text-[10px] font-medium py-1 rounded-md transition ${gradientMode ? "bg-background shadow-sm text-foreground" : "text-foreground/60 hover:text-foreground"}`}
                >
                  Gradient
                </button>
              </div>

              {/* ─── COMMON HSV CONTROLS ─── */}
              <div className="space-y-3 mb-4">
                <div
                  ref={satBoxRef}
                  onMouseDown={(e) => { setIsDraggingSat(true); handleSatBoxMove(e); }}
                  className="relative w-full h-36 rounded-lg cursor-crosshair overflow-hidden shadow-inner"
                  style={{ backgroundColor: pureHueHex }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
                  <div className="absolute w-3.5 h-3.5 -ml-1.75 -mt-1.75 rounded-full border-2 border-white shadow-[0_0_2px_rgba(0,0,0,0.6)] pointer-events-none" style={{ left: `${hsv.s}%`, top: `${100 - hsv.v}%`, backgroundColor: solidHex }} />
                </div>

                <div className="flex items-center gap-2.5 pt-0.5">
                  <div className="flex-1 space-y-2">
                    <div className="relative h-3 w-full rounded-full overflow-hidden shadow-sm">
                      <div className="absolute inset-0" style={{ background: "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)" }} />
                      <input type="range" min="0" max="360" value={hsv.h} onChange={(e) => updateHsv(Number(e.target.value), hsv.s, hsv.v)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                      <div className="absolute top-0 w-3 h-3 rounded-full border-2 border-white shadow-[0_0_2px_rgba(0,0,0,0.5)] pointer-events-none -ml-1.5" style={{ left: `${(hsv.h / 360) * 100}%`, backgroundColor: pureHueHex }} />
                    </div>

                    {showOpacity && (
                      <div className={`relative h-3 w-full rounded-full overflow-hidden shadow-sm ${checkerboardBg}`}>
                        <div className="absolute inset-0" style={{ background: `linear-gradient(to right, transparent, ${solidHex})` }} />
                        <input type="range" min="0" max="1" step="0.01" value={internalAlpha} onChange={(e) => updateAlpha(Number(e.target.value))} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                        <div className="absolute top-0 w-3 h-3 rounded-full border-2 border-white shadow-[0_0_2px_rgba(0,0,0,0.5)] pointer-events-none -ml-1.5" style={{ left: `${internalAlpha * 100}%`, backgroundColor: solidHex }} />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 pt-1">
                  {/* EyeDropper */}
                  {typeof window !== "undefined" && "EyeDropper" in window && (
                    <button
                      type="button"
                      onClick={handleEyeDropper}
                      className="p-1.5 border border-brand-400/20 rounded-md bg-brand-400/5 hover:bg-brand-400/15 text-foreground/70 hover:text-foreground transition shadow-sm shrink-0"
                      title="Sample color anywhere from screen"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m15 4 5 5" />
                        <path d="m17 2-3.5 3.5-6.4 6.4a2.7 2.7 0 0 0-.7 1.2l-1.2 4.2a.5.5 0 0 0 .6.6l4.2-1.2a2.7 2.7 0 0 0 1.2-.7l6.4-6.4L22 7Z" />
                        <path d="m2 22 5.5-5.5" />
                      </svg>
                    </button>
                  )}

                  <div className="flex-1 flex items-center justify-between border border-brand-400/20 rounded-md bg-brand-400/5 px-2 py-1 text-xs">
                    <span className="text-foreground/40 font-mono">#</span>
                    <input type="text" value={hexInputValue} onChange={(e) => handleHexInput(e.target.value)} className="w-full bg-transparent text-center font-mono uppercase text-foreground outline-none" maxLength={8} />
                  </div>
                  {showOpacity && (
                    <div className="w-16 flex items-center justify-between border border-brand-400/20 rounded-md bg-brand-400/5 px-2 py-1 text-xs">
                      <input type="number" min="0" max="100" value={Math.round(internalAlpha * 100)} onChange={(e) => updateAlpha(Math.max(0, Math.min(100, Number(e.target.value))) / 100)} className="w-full bg-transparent text-right font-mono text-foreground outline-none appearance-none" />
                      <span className="text-foreground/40 ml-0.5">%</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ─── GRADIENT TRACK AND LIST ─── */}
              {gradientMode && (
                <div className="space-y-3 pt-4 border-t border-brand-400/10">
                  <div className="flex flex-col gap-3">
                    <div className="flex bg-brand-400/10 rounded-lg p-0.5">
                      <button type="button" onClick={() => { setGradientType("linear"); gradientTypeRef.current = "linear"; emitColorChange(generateGradientCss("linear", gradientAngleRef.current, stopsRef.current)); }} className={`flex-1 px-2 py-1 text-[10px] rounded-md ${gradientType === "linear" ? "bg-background shadow-sm text-foreground" : "text-foreground/60"}`}>Linear</button>
                      <button type="button" onClick={() => { setGradientType("radial"); gradientTypeRef.current = "radial"; emitColorChange(generateGradientCss("radial", gradientAngleRef.current, stopsRef.current)); }} className={`flex-1 px-2 py-1 text-[10px] rounded-md ${gradientType === "radial" ? "bg-background shadow-sm text-foreground" : "text-foreground/60"}`}>Radial</button>
                    </div>
                    {gradientType === "linear" && (
                      <div className="flex items-center gap-2 px-1">
                        <input type="range" min="0" max="360" value={gradientAngle} onChange={(e) => { const nextAngle = Number(e.target.value); setGradientAngle(nextAngle); gradientAngleRef.current = nextAngle; emitColorChange(generateGradientCss("linear", nextAngle, stopsRef.current)); }} className="flex-1 h-1.5 rounded-full appearance-none bg-brand-400/20 accent-brand-400 cursor-pointer" />
                        <span className="text-[10px] text-foreground/70 font-mono w-8 text-right">{gradientAngle}°</span>
                      </div>
                    )}
                  </div>

                  {/* Gradient Track */}
                  <div className="pt-6 pb-2 relative">
                    <div
                      ref={trackRef}
                      onMouseDown={handleTrackMouseDown}
                      className={`relative h-5 w-full rounded-md shadow-inner cursor-crosshair ${checkerboardBg}`}
                    >
                      <div className="absolute inset-0 rounded-md pointer-events-none" style={{ background: generateGradientCss("linear", 90, stops) }} />
                      
                      {stops.map((stop) => {
                        const isActive = activeStopId === stop.id;
                        return (
                          <div
                            key={stop.id}
                            onMouseDown={(e) => handleStopMouseDown(e, stop.id)}
                            className="stop-thumb-pin absolute top-[-10px] cursor-grab active:cursor-grabbing select-none"
                            style={{ left: `${stop.position}%`, transform: "translateX(-50%)" }}
                          >
                            <div className={`relative flex flex-col items-center group transition-transform ${isActive ? "z-20 scale-105" : "z-10"}`}>
                              <div className={`w-6 h-6 rounded-md p-0.5 flex items-center justify-center shadow-md border-2 ${
                                isActive ? "bg-[#0082f6] border-[#0082f6]" : "bg-white border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700"
                              }`}>
                                <div className="w-full h-full rounded-[3px]" style={{ backgroundColor: stop.color }} />
                              </div>
                              <div className={`w-2.5 h-2.5 rotate-45 -mt-1.5 border-r-2 border-b-2 ${
                                isActive ? "bg-[#0082f6] border-[#0082f6]" : "bg-white border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700"
                              }`} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Stops list with custom scrollbar */}
                  <div className="space-y-1.5 pt-2 max-h-32 overflow-y-auto scrollbar-custom pr-1">
                    {stops.map((stop) => (
                      <div
                        key={stop.id}
                        className={`flex items-center justify-between p-1.5 rounded-md border cursor-pointer transition ${activeStopId === stop.id ? "bg-brand-400/10 border-brand-400/40" : "bg-brand-400/5 border-transparent hover:border-brand-400/20"}`}
                        onClick={() => {
                          setActiveStopId(stop.id);
                          activeStopIdRef.current = stop.id;
                          const rgba = hexToRgba(stop.color);
                          const newHsv = rgbToHsv(rgba.r, rgba.g, rgba.b);
                          syncLocalColor(newHsv, rgba.a);
                        }}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`w-4 h-4 rounded shadow-sm border border-black/10 ${checkerboardBg}`}>
                            <div className="w-full h-full rounded" style={{ backgroundColor: stop.color }} />
                          </div>
                          <span className="text-[10px] text-foreground/70 font-mono w-8">{Math.round(stop.position)}%</span>
                        </div>
                        {stops.length > 2 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteStop(stop.id); }}
                            className="text-red-400/60 hover:text-red-400 hover:bg-red-400/10 p-1 rounded transition"
                            title="Delete color stop"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
