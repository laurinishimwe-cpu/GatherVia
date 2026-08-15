"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import QRCode from "qrcode";
import { useFlyerDraft } from "@/context/FlyerDraftContext";
import { VectorEditor } from "@/components/workspace/flyer/VectorEditor";
import type { CanvasLayer } from "@/lib/types/canvas";
import { isCssGradient } from "@/lib/flyer/paint";
import { FLYER_TEXT_LINE_HEIGHT, resolveLayerFontWeight } from "@/lib/flyer/textLayout";
import { getEditorViewportBackgroundStyle } from "@/components/editor/editor-viewport";
import { loadCanvasLayerFonts } from "@/lib/flyer/fontLoader";

type HandleType = "top-left" | "top" | "top-right" | "left" | "right" | "bottom-left" | "bottom" | "bottom-right";

interface TextEditSession {
  layerId: string;
  originalText: string;
  draftText: string;
  isNewLayer: boolean;
}

const MIN_VIEWPORT_SCALE = 0.1;
const MAX_VIEWPORT_SCALE = 4;
const TRACKPAD_ZOOM_SENSITIVITY = 0.002;

function clampViewportScale(scale: number): number {
  return Math.min(Math.max(scale, MIN_VIEWPORT_SCALE), MAX_VIEWPORT_SCALE);
}

function getWheelDeltaInPixels(event: WheelEvent, pageSize: number) {
  const multiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? pageSize : 1;
  return {
    x: event.deltaX * multiplier,
    y: event.deltaY * multiplier,
  };
}

function isLayerInMainFrame(child: { x: number; y: number; width: number; height: number }): boolean {
  const overlapX = Math.max(0, Math.min(child.x + child.width, 100) - Math.max(child.x, 0));
  const overlapY = Math.max(0, Math.min(child.y + child.height, 100) - Math.max(child.y, 0));
  const overlapArea = overlapX * overlapY;
  const childArea = child.width * child.height;
  return (overlapArea / childArea) > 0.5;
}

function shouldIgnoreEditorShortcut(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(
    target.closest('input, textarea, select, button, [contenteditable="true"]'),
  );
}

function getColorLuminance(color: string): number | null {
  const hex = color.match(/^#([\da-f]{6})$/i)?.[1];
  if (!hex) return null;
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  return (red * 299 + green * 587 + blue * 114) / 1000;
}

function getReadableEditingColor(background: string, textColor?: string): string {
  const backgroundLuminance = getColorLuminance(background);
  const fallback = backgroundLuminance !== null && backgroundLuminance > 160
    ? "#111111"
    : "#ffffff";
  if (!textColor || isCssGradient(textColor)) return fallback;

  const textLuminance = getColorLuminance(textColor);
  if (
    backgroundLuminance !== null
    && textLuminance !== null
    && Math.abs(backgroundLuminance - textLuminance) >= 90
  ) {
    return textColor;
  }
  return fallback;
}

export function EditorCanvas() {
  const {
    draft,
    addLayer,
    addImageFromDevice,
    removeLayer,
    selectLayer,
    selectFrame,
    updateLayer,
    setViewport,
    activeTool,
    setActiveTool,
    copySelectedLayer,
    cutSelectedLayer,
    pasteLayer,
    duplicateSelectedLayer,
    deleteSelectedLayer,
  } = useFlyerDraft();
  const { configuration, layers, selectedLayerId, viewport, isFrameSelected } = draft;
  const penMode = activeTool === "pen";
  const hasConfiguration = Boolean(configuration);

  useEffect(() => {
    void loadCanvasLayerFonts(layers);
  }, [layers]);

  const surfaceRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const selectAllOnFocusRef = useRef(false);
  const [draggingLayerId, setDraggingLayerId] = useState<string | null>(null);
  const [isDeviceImageUploading, setIsDeviceImageUploading] = useState(false);
  const [textEditSession, setTextEditSession] = useState<TextEditSession | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  const [resizing, setResizing] = useState<{
    layerId: string;
    handle: HandleType;
    startBounds: { x: number; y: number; width: number; height: number };
    startMouse: { x: number; y: number };
  } | null>(null);

  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [framePos, setFramePos] = useState({ x: 0, y: 0 });
  const [isDraggingFrame, setIsDraggingFrame] = useState(false);

  const [vectorEditLayerId, setVectorEditLayerId] = useState<string | null>(null);
  const vectorEditorMode = vectorEditLayerId ? "edit" : penMode ? "create" : null;
  const isVectorEditorOpen = vectorEditorMode !== null;

  const beginTextEditing = useCallback((
    layerId: string,
    options: { isNewLayer?: boolean; selectAll?: boolean } = {},
  ) => {
    if (isVectorEditorOpen) return;
    const layer = layers.find((item) => item.id === layerId);
    if (!layer && !options.isNewLayer) return;
    if (layer && (layer.type !== "text" || layer.locked)) return;

    selectLayer(layerId);
    setDraggingLayerId(null);
    setResizing(null);
    setIsDraggingFrame(false);
    selectAllOnFocusRef.current = options.selectAll ?? false;
    setTextEditSession({
      layerId,
      originalText: layer?.text ?? "",
      draftText: layer?.text ?? "",
      isNewLayer: options.isNewLayer ?? false,
    });
  }, [isVectorEditorOpen, layers, selectLayer]);

  const commitTextEditing = useCallback(() => {
    if (!textEditSession) return;
    const session = textEditSession;
    const layerExists = layers.some((layer) => layer.id === session.layerId);
    setTextEditSession(null);

    if (!layerExists) return;
    if (session.isNewLayer && session.draftText.trim() === "") {
      removeLayer(session.layerId);
    } else {
      updateLayer(session.layerId, { text: session.draftText });
      selectLayer(session.layerId);
    }
    if (session.isNewLayer) setActiveTool("select");
  }, [layers, removeLayer, selectLayer, setActiveTool, textEditSession, updateLayer]);

  const cancelTextEditing = useCallback(() => {
    if (!textEditSession) return;
    const session = textEditSession;
    const layer = layers.find((item) => item.id === session.layerId);
    setTextEditSession(null);

    if (layer) {
      const currentText = layer.text ?? "";
      const removeUnchangedNewLayer = session.isNewLayer && (
        currentText.trim() === "" || currentText === session.originalText
      );
      if (removeUnchangedNewLayer) {
        removeLayer(session.layerId);
      } else {
        if ((layer.text ?? "") !== session.originalText) {
          updateLayer(session.layerId, { text: session.originalText });
        }
        selectLayer(session.layerId);
      }
    }
    if (session.isNewLayer) setActiveTool("select");
  }, [layers, removeLayer, selectLayer, setActiveTool, textEditSession, updateLayer]);

  const textEditLayerId = textEditSession?.layerId;

  useEffect(() => {
    if (!textEditLayerId) return;
    const frame = requestAnimationFrame(() => {
      const textarea = textAreaRef.current;
      if (!textarea) return;
      textarea.focus();
      if (selectAllOnFocusRef.current) textarea.select();
      else textarea.setSelectionRange(0, 0);
      selectAllOnFocusRef.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [textEditLayerId]);

  useEffect(() => {
    if (!textEditSession || layers.some((layer) => layer.id === textEditSession.layerId)) return;
    // A layer can disappear through shared commands or a draft replacement.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTextEditSession(null);
  }, [layers, textEditSession]);

  // ── Keyboard shortcuts ──────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (textEditSession && e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        cancelTextEditing();
        return;
      }
      const editing = Boolean(textEditSession || isVectorEditorOpen);
      if (shouldIgnoreEditorShortcut(e.target) || editing) return;

      if (e.code === "Space") {
        e.preventDefault();
        setIsSpacePressed(true);
        return;
      }

      const key = e.key.toLowerCase();
      const hasCommandModifier = e.ctrlKey || e.metaKey;
      if (hasCommandModifier) {
        if (key === "c") copySelectedLayer();
        else if (key === "x") cutSelectedLayer();
        else if (key === "v") pasteLayer();
        else if (key === "d") duplicateSelectedLayer();
        else return;
        e.preventDefault();
        return;
      }

      if (e.altKey) return;
      if (key === "v" || key === "h" || key === "p" || key === "t") {
        const tools = { v: "select", h: "hand", p: "pen", t: "text" } as const;
        setActiveTool(tools[key]);
        e.preventDefault();
        return;
      }

      if (e.key === "Escape") {
        if (activeTool !== "select") setActiveTool("select");
        else if (selectedLayerId) selectLayer(null);
        else if (isFrameSelected) selectFrame(false);
        return;
      }

      if (e.key === "Enter" && selectedLayerId && !draggingLayerId && !resizing) {
        const layer = layers.find((item) => item.id === selectedLayerId);
        if (layer?.type === "text" && !layer.locked) {
          e.preventDefault();
          beginTextEditing(layer.id, { selectAll: true });
        }
        return;
      }

      if (draggingLayerId || resizing) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selectedLayerId) {
        e.preventDefault();
        const layer = layers.find((item) => item.id === selectedLayerId);
        if (layer && !layer.locked) {
          deleteSelectedLayer();
        }
        return;
      }

      if (!selectedLayerId) return;
      const layer = layers.find((l) => l.id === selectedLayerId);
      if (!layer || layer.locked) return;
      const step = e.shiftKey ? 10 : 1;
      let newX = layer.x, newY = layer.y;
      if (e.key === "ArrowUp") newY -= step;
      if (e.key === "ArrowDown") newY += step;
      if (e.key === "ArrowLeft") newX -= step;
      if (e.key === "ArrowRight") newX += step;
      if (newX !== layer.x || newY !== layer.y) {
        e.preventDefault();
        updateLayer(selectedLayerId, { x: newX, y: newY });
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => { if (e.code === "Space") setIsSpacePressed(false); };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    activeTool,
    beginTextEditing,
    cancelTextEditing,
    copySelectedLayer,
    cutSelectedLayer,
    deleteSelectedLayer,
    draggingLayerId,
    duplicateSelectedLayer,
    isFrameSelected,
    isVectorEditorOpen,
    layers,
    pasteLayer,
    resizing,
    selectFrame,
    selectLayer,
    selectedLayerId,
    setActiveTool,
    textEditSession,
    updateLayer,
    vectorEditLayerId,
  ]);

  // ── Trackpad pinch zoom and two-finger pan ─────────
  // Use a native non-passive listener so browser page zoom is cancelled
  // before the gesture escapes the editor surface.
  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;

    const handleWheel = (event: WheelEvent) => {
      if (event.cancelable) event.preventDefault();
      event.stopPropagation();

      const rect = surface.getBoundingClientRect();
      const delta = getWheelDeltaInPixels(event, rect.height);

      if (event.ctrlKey || event.metaKey) {
        const pointerX = event.clientX - rect.left - rect.width / 2;
        const pointerY = event.clientY - rect.top - rect.height / 2;

        setViewport((previous) => {
          const nextScale = clampViewportScale(
            previous.scale * Math.exp(-delta.y * TRACKPAD_ZOOM_SENSITIVITY),
          );

          if (nextScale === previous.scale) return previous;

          const scaleRatio = nextScale / previous.scale;

          return {
            scale: nextScale,
            // Keep the canvas point beneath the fingers stationary.
            x: pointerX - (pointerX - previous.x) * scaleRatio,
            y: pointerY - (pointerY - previous.y) * scaleRatio,
          };
        });
        return;
      }

      // Ordinary two-finger movement pans only the editor.
      setViewport((previous) => ({
        ...previous,
        x: previous.x - delta.x,
        y: previous.y - delta.y,
      }));
    };

    const preventTouchGesture = (event: TouchEvent) => {
      if (event.cancelable) event.preventDefault();
    };

    surface.addEventListener("wheel", handleWheel, { passive: false });
    surface.addEventListener("touchmove", preventTouchGesture, { passive: false });

    return () => {
      surface.removeEventListener("wheel", handleWheel);
      surface.removeEventListener("touchmove", preventTouchGesture);
    };
  }, [setViewport, hasConfiguration]);

  // ── Canvas pointer down ────────────────────────────
  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    if (isVectorEditorOpen) return;
    if (textEditSession) {
      commitTextEditing();
    }
    if (activeTool === "hand" || isSpacePressed || e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
    } else {
      selectLayer(null);
      selectFrame(false);
    }
  };

  // ── Global pointer move ────────────────────────────
  const handleGlobalPointerMove = (e: React.PointerEvent) => {
    if (isPanning) {
      setViewport(prev => ({ ...prev, x: prev.x + e.movementX, y: prev.y + e.movementY }));
      return;
    }
    if (isDraggingFrame) {
      setFramePos(prev => ({ x: prev.x + e.movementX / viewport.scale, y: prev.y + e.movementY / viewport.scale }));
      return;
    }

    if (textEditSession || isVectorEditorOpen) return;
    if (!containerRef.current) return;

    if (draggingLayerId) {
      const layer = layers.find(l => l.id === draggingLayerId);
      if (!layer || layer.locked) return;
      const deltaX = (e.movementX / (containerRef.current.offsetWidth * viewport.scale)) * 100;
      const deltaY = (e.movementY / (containerRef.current.offsetHeight * viewport.scale)) * 100;
      updateLayer(draggingLayerId, { x: layer.x + deltaX, y: layer.y + deltaY });
      return;
    }
    if (resizing) {
      const { layerId, handle, startBounds, startMouse } = resizing;
      const deltaX = ((e.clientX - startMouse.x) / (containerRef.current.offsetWidth * viewport.scale)) * 100;
      const deltaY = ((e.clientY - startMouse.y) / (containerRef.current.offsetHeight * viewport.scale)) * 100;
      let newWidth = startBounds.width, newHeight = startBounds.height;
      let newX = startBounds.x, newY = startBounds.y;
      if (handle.includes("right")) newWidth = Math.max(1, startBounds.width + deltaX);
      if (handle.includes("left")) { newWidth = Math.max(1, startBounds.width - deltaX); newX = startBounds.x + deltaX; }
      if (handle.includes("bottom")) newHeight = Math.max(1, startBounds.height + deltaY);
      if (handle.includes("top")) { newHeight = Math.max(1, startBounds.height - deltaY); newY = startBounds.y + deltaY; }
      if (e.shiftKey && (handle.includes("top") || handle.includes("bottom")) && (handle.includes("left") || handle.includes("right"))) {
        const ratio = startBounds.width / startBounds.height;
        if (Math.abs(newWidth - startBounds.width) > Math.abs(newHeight - startBounds.height)) {
          newHeight = newWidth / ratio;
          if (handle.includes("top")) newY = startBounds.y + (startBounds.height - newHeight);
        } else {
          newWidth = newHeight * ratio;
          if (handle.includes("left")) newX = startBounds.x + (startBounds.width - newWidth);
        }
      }
      updateLayer(layerId, { x: newX, y: newY, width: newWidth, height: newHeight });
    }
  };

  const handleGlobalPointerUp = () => {
    setIsPanning(false);
    setIsDraggingFrame(false);
    if (draggingLayerId) {
      const layer = layers.find(l => l.id === draggingLayerId);
      if (layer) {
        const isInside = isLayerInMainFrame(layer);
        const targetParent = isInside ? "main-frame" : null;
        if (layer.parentId !== targetParent) updateLayer(layer.id, { parentId: targetParent });
      }
    }
    setDraggingLayerId(null);
    setResizing(null);
  };

  // ── Frame pointer down ─────────────────────────────
  const handleFramePointerDown = (e: React.PointerEvent) => {
    if (activeTool === "hand" || isSpacePressed || e.button === 1) return;
    if (isVectorEditorOpen) return;
    e.stopPropagation();

    if (textEditSession) {
      commitTextEditing();
      selectLayer(null);
      selectFrame(false);
      return;
    }

    if (activeTool === "text") {
      const artboard = containerRef.current;
      if (!artboard) return;
      const rect = artboard.getBoundingClientRect();
      const width = 30;
      const height = 7;
      const x = Math.min(Math.max(((e.clientX - rect.left) / rect.width) * 100, 0), 100 - width);
      const y = Math.min(Math.max(((e.clientY - rect.top) / rect.height) * 100, 0), 100 - height);
      const layerId = addLayer({
        type: "text",
        name: "Text",
        text: "",
        x,
        y,
        width,
        height,
        rotation: 0,
        opacity: 1,
        zIndex: layers.reduce((max, layer) => Math.max(max, layer.zIndex), -1) + 1,
        visible: true,
        locked: false,
        parentId: "main-frame",
        fontFamily: "Inter",
        fontSize: 24,
        fontWeight: "normal",
        fontStyle: "normal",
        textAlign: "left",
        color: "#ffffff",
      });
      beginTextEditing(layerId, { isNewLayer: true });
      return;
    }

    selectLayer(null);
    selectFrame(true);
    setIsDraggingFrame(true);
  };

  // ── Layer pointer down ─────────────────────────────
  const handleLayerPointerDown = (id: string, e: React.PointerEvent) => {
    if (activeTool === "hand" || isSpacePressed || e.button === 1) return;
    if (isVectorEditorOpen) return;
    if ((e.target as HTMLElement).dataset?.handle) return;
    e.stopPropagation();
    selectFrame(false);
    const layer = layers.find(l => l.id === id);
    if (!layer) return;

    if (textEditSession) {
      commitTextEditing();
      if (!layer.locked) selectLayer(id);
      return;
    }

    if (layer.locked) return;
    selectLayer(id);
    if (activeTool === "text") return;
    if (!isVectorEditorOpen) {
      setDraggingLayerId(id);
      dragOffset.current = { x: e.clientX, y: e.clientY };
    }
  };

  // ── Resize handle ──────────────────────────────────
  const handleResizeStart = (layerId: string, handle: HandleType, e: React.PointerEvent) => {
    e.stopPropagation();
    if (activeTool !== "select" || textEditSession || isVectorEditorOpen) return;
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;
    setResizing({
      layerId, handle,
      startBounds: { x: layer.x, y: layer.y, width: layer.width, height: layer.height },
      startMouse: { x: e.clientX, y: e.clientY },
    });
  };

  // ── Double click ──────────────────────────────────
  const handleDoubleClick = (id: string) => {
    const layer = layers.find(l => l.id === id);
    if (!layer || layer.locked) return;
    if (layer.type === "text") {
      beginTextEditing(id);
    } else if (layer.type === "path") {
      selectLayer(id);
      setDraggingLayerId(null);
      setResizing(null);
      setIsDraggingFrame(false);
      setVectorEditLayerId(id);
    }
  };

  // ── Render a single layer ───────────────────────────
  const renderLayer = (layer: CanvasLayer) => {
    const isSelected = layer.id === selectedLayerId;
    const isEditing = layer.id === textEditSession?.layerId;
    const isVectorEditing = layer.id === vectorEditLayerId;
    const shadowStyle = layer.shadow ? { filter: `drop-shadow(${layer.shadow.offsetX}px ${layer.shadow.offsetY}px ${layer.shadow.blur}px ${layer.shadow.color})` } : {};

    return (
      <div
        key={layer.id}
        onPointerDown={(e) => handleLayerPointerDown(layer.id, e)}
        onDoubleClick={() => handleDoubleClick(layer.id)}
        className="group pointer-events-auto"
        style={{
          position: "absolute",
          left: `${layer.x}%`,
          top: `${layer.y}%`,
          width: `${layer.width}%`,
          height: `${layer.height}%`,
          opacity: layer.opacity,
          zIndex: layer.zIndex,
          display: layer.visible ? "block" : "none",
          transform: `rotate(${layer.rotation ?? 0}deg)`,
          transformOrigin: "center center",
          ...shadowStyle,
        }}
      >
        {layer.type === "text" &&
          (isEditing ? (
            <textarea
              ref={textAreaRef}
              value={textEditSession?.draftText ?? ""}
              onChange={(e) => setTextEditSession((session) => session
                ? { ...session, draftText: e.target.value }
                : session
              )}
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  cancelTextEditing();
                } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  e.stopPropagation();
                  commitTextEditing();
                } else if (e.key === "Tab") {
                  e.preventDefault();
                  e.stopPropagation();
                  commitTextEditing();
                }
              }}
              className="w-full h-full rounded-none border-0 bg-black/20 px-1 outline outline-1 outline-brand-400/80 resize-none pointer-events-auto"
              style={{
                fontFamily: layer.fontFamily,
                fontSize: `${layer.fontSize}px`,
                fontWeight: resolveLayerFontWeight(layer.fontWeight),
                fontStyle: layer.fontStyle ?? "normal",
                lineHeight: FLYER_TEXT_LINE_HEIGHT,
                textAlign: layer.textAlign ?? "center",
                color: getReadableEditingColor(
                  configuration?.canvas_background_color ?? "#000000",
                  layer.color,
                ),
                caretColor: getReadableEditingColor(
                  configuration?.canvas_background_color ?? "#000000",
                  layer.color,
                ),
              }}
            />
          ) : (
            <div
              className="w-full h-full flex flex-col justify-center overflow-hidden pointer-events-none"
              style={{
                fontFamily: layer.fontFamily,
                fontSize: `${layer.fontSize}px`,
                fontWeight: resolveLayerFontWeight(layer.fontWeight),
                fontStyle: layer.fontStyle ?? "normal",
                lineHeight: FLYER_TEXT_LINE_HEIGHT,
                textAlign: layer.textAlign ?? "center",
                color: isCssGradient(layer.color) ? "transparent" : layer.color,
                background: isCssGradient(layer.color) ? layer.color : undefined,
                backgroundClip: isCssGradient(layer.color) ? "text" : undefined,
                WebkitBackgroundClip: isCssGradient(layer.color) ? "text" : undefined,
                whiteSpace: "pre-wrap",
              }}
            >
              {layer.text}
            </div>
          ))}

        {(layer.type === "rect" || layer.type === "frame") && (
          <div
            className="w-full h-full"
            style={{
              background: layer.fill ?? "transparent",
              border: layer.strokeWidth ? `${layer.strokeWidth}px solid ${layer.stroke ?? "#000"}` : "none",
              borderRadius: `${layer.borderRadius ?? 0}px`,
            }}
          />
        )}

        {layer.type === "ellipse" && (
          <div
            className="w-full h-full rounded-full"
            style={{
              background: layer.fill ?? "transparent",
              border: layer.strokeWidth ? `${layer.strokeWidth}px solid ${layer.stroke ?? "#000"}` : "none",
            }}
          />
        )}

        {layer.type === "image" && layer.imageUrl && (
          <img
            src={layer.imageUrl}
            alt=""
            draggable="false"
            className="w-full h-full object-cover pointer-events-none"
            style={{ borderRadius: `${layer.borderRadius ?? 0}px` }}
          />
        )}

        {layer.type === "qr" && (
          <CanvasQrLayer
            value={layer.qrValue ?? "guest-invitation-preview"}
            fill={layer.fill}
            borderRadius={layer.borderRadius}
          />
        )}

        {layer.type === "polygon" && layer.points && (
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0"
          >
            <defs>
              <clipPath id={`polygon-clip-${layer.id}`}>
                <polygon points={layer.points} />
              </clipPath>
            </defs>
            <foreignObject x="0" y="0" width="100" height="100" clipPath={`url(#polygon-clip-${layer.id})`}>
              <div className="h-full w-full" style={{ background: layer.fill ?? "transparent" }} />
            </foreignObject>
            <polygon points={layer.points} fill="none" stroke={layer.stroke ?? "#000000"} strokeWidth={layer.strokeWidth ?? 0} vectorEffect="non-scaling-stroke" />
          </svg>
        )}

        {layer.type === "path" && layer.pathData && !isVectorEditing && (
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="overflow-visible pointer-events-none absolute inset-0"
          >
            <defs>
              <clipPath id={`clip-${layer.id}`}>
                <path d={layer.pathData} />
              </clipPath>
            </defs>
            {layer.closed && (
              <foreignObject x="0" y="0" width="100" height="100" clipPath={`url(#clip-${layer.id})`}>
                <div className="h-full w-full" style={{ background: layer.fill ?? "transparent" }} />
              </foreignObject>
            )}
            <path
              d={layer.pathData}
              fill="none"
              stroke={layer.stroke ?? "#18A0FB"}
              strokeWidth={layer.strokeWidth ?? 2}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}

        {isSelected && !layer.locked && activeTool === "select" && !isVectorEditing && !textEditSession && (
          <>
            <div className="absolute inset-0 border-[2px] border-brand-400 pointer-events-none z-10" />
            {(["top-left", "top-right", "bottom-left", "bottom-right"] as HandleType[]).map((handle) => (
              <div
                key={handle}
                data-handle={handle}
                onPointerDown={(e) => handleResizeStart(layer.id, handle, e)}
                className="absolute z-20 flex items-center justify-center"
                style={{
                  width: 24,
                  height: 24,
                  cursor: `${handle}-resize`,
                  ...(handle.includes("left") ? { left: -12 } : { right: -12 }),
                  ...(handle.includes("top") ? { top: -12 } : { bottom: -12 }),
                }}
              >
                <div className="w-2.5 h-2.5 bg-white border border-brand-400 rounded-[2px] shadow-sm pointer-events-none transition-colors hover:bg-brand-400" />
              </div>
            ))}
            {(["top", "right", "bottom", "left"] as HandleType[]).map((handle) => (
              <div
                key={handle}
                data-handle={handle}
                onPointerDown={(e) => handleResizeStart(layer.id, handle, e)}
                className="absolute z-10 flex items-center justify-center"
                style={{
                  cursor: handle === "top" || handle === "bottom" ? "ns-resize" : "ew-resize",
                  ...(handle === "top"
                    ? { top: -8, left: "10%", width: "80%", height: 16 }
                    : handle === "bottom"
                    ? { bottom: -8, left: "10%", width: "80%", height: 16 }
                    : handle === "left"
                    ? { left: -8, top: "10%", width: 16, height: "80%" }
                    : { right: -8, top: "10%", width: 16, height: "80%" }),
                }}
              />
            ))}
          </>
        )}
      </div>
    );
  };

  if (!configuration) return <div className="flex items-center justify-center h-full text-foreground/50">No flyer loaded</div>;

  const handleDeviceImageDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const file = Array.from(event.dataTransfer.files).find((candidate) => candidate.type.startsWith("image/"));
    if (!file || !containerRef.current) return;

    const bounds = containerRef.current.getBoundingClientRect();
    const position = {
      centerX: ((event.clientX - bounds.left) / bounds.width) * 100,
      centerY: ((event.clientY - bounds.top) / bounds.height) * 100,
    };
    setIsDeviceImageUploading(true);
    try {
      await addImageFromDevice(file, position);
    } finally {
      setIsDeviceImageUploading(false);
    }
  };

  return (
    <div
      ref={surfaceRef}
      className="canvas-area relative h-full w-full touch-none select-none overflow-hidden overscroll-none bg-foreground/[0.035]"
      style={{
        ...getEditorViewportBackgroundStyle(viewport),
        touchAction: "none",
        overscrollBehavior: "none",
      }}
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handleGlobalPointerMove}
      onPointerUp={handleGlobalPointerUp}
      onPointerLeave={handleGlobalPointerUp}
      onDragStart={(e) => e.preventDefault()}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) event.preventDefault();
      }}
      onDrop={(event) => void handleDeviceImageDrop(event)}
    >
      {isDeviceImageUploading && (
        <div className="pointer-events-none absolute inset-0 z-[70] flex items-center justify-center bg-black/20">
          <div className="rounded-full bg-background/95 px-4 py-2 text-xs font-semibold shadow-lg">
            Uploading image…
          </div>
        </div>
      )}
      <div
        className="absolute inset-0 origin-center transition-transform duration-75 ease-out"
        style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})` }}
      >
        <div
          ref={containerRef}
          onPointerDown={handleFramePointerDown}
          className={`absolute left-1/2 top-1/2 w-[320px] aspect-[27/32] shadow-2xl bg-white transition-shadow ${
            isFrameSelected
              ? "ring-2 ring-brand-400/80 shadow-[0_0_30px_rgba(79,214,190,0.2)]"
              : "ring-0"
          }`}
          style={{
            background: configuration.canvas_background_color,
            transform: `translate(calc(-50% + ${framePos.x}px), calc(-50% + ${framePos.y}px))`,
            border: configuration.artboard_stroke_width
              ? `${configuration.artboard_stroke_width}px solid ${configuration.artboard_stroke_color ?? "#000000"}`
              : "none",
          }}
        >
          <div
            className={`absolute -top-7 left-0 text-sm font-semibold pointer-events-none ${
              isFrameSelected ? "text-brand-400" : "text-foreground/50"
            }`}
          >
            Flyer Artboard
          </div>

          <div className="absolute inset-0 overflow-hidden z-0 pointer-events-none">
            {layers.filter((l) => l.parentId === "main-frame" || l.parentId === undefined).map(renderLayer)}
          </div>

          <div className="absolute inset-0 overflow-visible z-10 pointer-events-none">
            {layers.filter((l) => l.parentId === null).map(renderLayer)}
          </div>

          {vectorEditorMode && (
            <VectorEditor
              key={`${vectorEditorMode}-${vectorEditLayerId ?? "new"}`}
              layerId={vectorEditLayerId}
              mode={vectorEditorMode}
              onCommit={(committedLayerId) => {
                setVectorEditLayerId(null);
                selectLayer(committedLayerId);
                setActiveTool("select");
              }}
              onCancel={() => {
                const originalLayerId = vectorEditLayerId;
                setVectorEditLayerId(null);
                if (originalLayerId) selectLayer(originalLayerId);
                setActiveTool("select");
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function CanvasQrLayer({
  value,
  fill,
  borderRadius,
}: {
  value: string;
  fill?: string;
  borderRadius?: number;
}) {
  const [svg, setSvg] = useState("");

  useEffect(() => {
    let cancelled = false;
    QRCode.toString(value, { type: "svg", width: 240, margin: 1 })
      .then((nextSvg) => {
        if (!cancelled) setSvg(nextSvg);
      })
      .catch(() => {
        if (!cancelled) setSvg("");
      });
    return () => {
      cancelled = true;
    };
  }, [value]);

  return (
    <div
      className="flex h-full w-full items-center justify-center overflow-hidden pointer-events-none"
      style={{ background: fill ?? "#ffffff", borderRadius: `${borderRadius ?? 0}px` }}
    >
      {svg ? (
        <div
          className="h-full w-full [&>svg]:h-full [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : null}
    </div>
  );
}
