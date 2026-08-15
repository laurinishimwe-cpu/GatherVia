"use client";

/* eslint-disable react-hooks/refs -- Pointer-capture refs are accessed only from pointer event callbacks. */

import { useCallback, useEffect, useRef, useState } from "react";
import { useFlyerDraft } from "@/context/FlyerDraftContext";
import { useVectorEdit, type VectorEditorMode } from "@/context/VectorEditContext";
import type { VectorNode } from "@/lib/types/canvas";
import {
  MIN_VECTOR_LAYER_SIZE,
  cloneVectorNodes,
  compileVectorPath,
  constrainVectorHandle,
  isValidVectorPoint,
  localVectorNodesToGlobal,
  moveVectorNode,
  roundVectorValue,
  toggleVectorNodeKind,
  type VectorHandleType,
  type VectorPoint,
} from "@/lib/flyer/vectorGeometry";
import { isCssGradient } from "@/lib/flyer/paint";

interface VectorEditorProps {
  layerId?: string | null;
  mode: VectorEditorMode;
  onCommit: (layerId: string) => void;
  onCancel: () => void;
}

type DragType = "anchor" | VectorHandleType;
interface DragTarget {
  index: number;
  type: DragType;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  moved: boolean;
  createdNode: boolean;
}

const DRAG_THRESHOLD_PX = 4;

export function VectorEditor({ layerId, mode, onCommit, onCancel }: VectorEditorProps) {
  const { draft, updateLayer, addLayer } = useFlyerDraft();
  const vector = useVectorEdit();
  const { session } = vector;
  const rootRef = useRef<HTMLDivElement>(null);
  const captureTargetRef = useRef<HTMLElement | SVGElement | null>(null);
  const initializedRef = useRef(false);
  const endSessionRef = useRef(vector.endSession);
  const mountedRef = useRef(false);
  endSessionRef.current = vector.endSession;
  const [draggingTarget, setDraggingTarget] = useState<DragTarget | null>(null);
  const [pointerPosition, setPointerPosition] = useState<VectorPoint | null>(null);
  const existingLayer = mode === "edit" && layerId
    ? draft.layers.find((layer) => layer.id === layerId && layer.type === "path")
    : null;

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    if (mode === "edit" && !existingLayer) {
      onCancel();
      return;
    }
    const nodes = existingLayer?.nodes
      ? localVectorNodesToGlobal(existingLayer.nodes, existingLayer)
      : [];
    vector.startSession({
      mode,
      layerId: layerId ?? null,
      workingNodes: nodes,
      activeNodeIndex: nodes.length ? nodes.length - 1 : null,
      closed: existingLayer?.closed ?? false,
      validationMessage: null,
      lastManipulatedHandle: null,
      appearance: {
        stroke: existingLayer?.stroke ?? "#18A0FB",
        strokeWidth: existingLayer?.strokeWidth ?? 2,
        fill: existingLayer?.fill ?? "none",
        opacity: existingLayer?.opacity ?? 1,
      },
    });
  }, [existingLayer, layerId, mode, onCancel, vector]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      queueMicrotask(() => {
        if (!mountedRef.current) endSessionRef.current();
      });
    };
  }, []);

  const pointFromEvent = useCallback((event: React.PointerEvent): VectorPoint | null => {
    const root = rootRef.current;
    if (!root) return null;
    const rect = root.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return { x: ((event.clientX - rect.left) / rect.width) * 100, y: ((event.clientY - rect.top) / rect.height) * 100 };
  }, []);

  const releasePointer = useCallback((pointerId: number) => {
    const target = captureTargetRef.current;
    if (target?.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId);
    captureTargetRef.current = null;
  }, []);

  const beginDrag = useCallback((
    event: React.PointerEvent<HTMLElement | SVGElement>,
    index: number,
    type: DragType,
    createdNode = false,
  ) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    captureTargetRef.current = event.currentTarget;
    vector.setActiveNodeIndex(index);
    setDraggingTarget({ index, type, pointerId: event.pointerId, startClientX: event.clientX, startClientY: event.clientY, moved: false, createdNode });
  }, [vector]);

  const commitVectorEditing = useCallback((closedOverride?: boolean) => {
    if (!session) return;
    const committedClosed = closedOverride ?? session.closed;
    const validNodes = session.workingNodes.filter((node) => (
      Number.isFinite(node.x) && Number.isFinite(node.y)
      && (!node.handleIn || isValidVectorPoint(node.handleIn))
      && (!node.handleOut || isValidVectorPoint(node.handleOut))
    ));
    if (validNodes.length < 2) {
      vector.setValidationMessage("A path needs at least two points.");
      return;
    }
    const points = validNodes.flatMap((node) => [node, ...(node.handleIn ? [node.handleIn] : []), ...(node.handleOut ? [node.handleOut] : [])]);
    const minX = Math.min(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    const width = Math.max(Math.max(...points.map((point) => point.x)) - minX, MIN_VECTOR_LAYER_SIZE);
    const height = Math.max(Math.max(...points.map((point) => point.y)) - minY, MIN_VECTOR_LAYER_SIZE);
    if (![minX, minY, width, height].every(Number.isFinite)) {
      vector.setValidationMessage("The path contains invalid geometry.");
      return;
    }
    const localNodes = validNodes.map((node) => ({
      ...node,
      x: roundVectorValue(((node.x - minX) / width) * 100),
      y: roundVectorValue(((node.y - minY) / height) * 100),
      handleIn: node.handleIn ? { x: roundVectorValue(((node.handleIn.x - minX) / width) * 100), y: roundVectorValue(((node.handleIn.y - minY) / height) * 100) } : undefined,
      handleOut: node.handleOut ? { x: roundVectorValue(((node.handleOut.x - minX) / width) * 100), y: roundVectorValue(((node.handleOut.y - minY) / height) * 100) } : undefined,
    }));
    const geometry = {
      nodes: localNodes,
      pathData: compileVectorPath(localNodes, committedClosed),
      closed: committedClosed,
      x: roundVectorValue(minX), y: roundVectorValue(minY), width: roundVectorValue(width), height: roundVectorValue(height),
    };
    if (session.mode === "edit") {
      if (!session.layerId || !existingLayer) { vector.endSession(); onCancel(); return; }
      updateLayer(session.layerId, geometry);
      const committedId = session.layerId;
      vector.endSession();
      onCommit(committedId);
      return;
    }
    const createdId = addLayer({
      type: "path", name: "Path", ...geometry,
      fill: session.appearance.fill,
      stroke: session.appearance.stroke,
      strokeWidth: session.appearance.strokeWidth,
      rotation: 0, opacity: session.appearance.opacity,
      zIndex: draft.layers.reduce((max, layer) => Math.max(max, layer.zIndex), -1) + 1,
      visible: true, locked: false, parentId: "main-frame",
    });
    vector.endSession();
    onCommit(createdId);
  }, [addLayer, draft.layers, existingLayer, onCancel, onCommit, session, updateLayer, vector]);

  const cancelVectorEditing = useCallback(() => {
    if (draggingTarget) releasePointer(draggingTarget.pointerId);
    setDraggingTarget(null);
    vector.endSession();
    onCancel();
  }, [draggingTarget, onCancel, releasePointer, vector]);

  useEffect(() => {
    vector.registerActions({ commit: () => commitVectorEditing(), cancel: cancelVectorEditing });
    return () => vector.registerActions(null);
  }, [cancelVectorEditing, commitVectorEditing, vector]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); vector.cancel(); }
      else if (event.key === "Enter") { event.preventDefault(); event.stopImmediatePropagation(); vector.commit(); }
      else if (event.key === "Backspace" || event.key === "Delete") { event.preventDefault(); event.stopImmediatePropagation(); vector.deleteActiveNode(); }
      else if (event.key === "Tab") { event.preventDefault(); event.stopImmediatePropagation(); vector.cycleActiveNode(event.shiftKey ? -1 : 1); }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [vector]);

  if (!session) return null;

  const handleSurfacePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (draggingTarget) return;
    if (session.mode === "edit") { vector.setActiveNodeIndex(null); return; }
    if (event.detail >= 2) { vector.commit(); return; }
    const point = pointFromEvent(event);
    if (!point) return;
    const node: VectorNode = { id: crypto.randomUUID(), x: point.x, y: point.y, mirror: "mirrored" };
    const index = session.workingNodes.length;
    vector.setWorkingNodes((nodes) => [...nodes, node]);
    vector.setValidationMessage(null);
    beginDrag(event, index, "handleOut", true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const point = pointFromEvent(event);
    if (!point) return;
    setPointerPosition(point);
    if (!draggingTarget || event.pointerId !== draggingTarget.pointerId) return;
    const moved = draggingTarget.moved || Math.hypot(event.clientX - draggingTarget.startClientX, event.clientY - draggingTarget.startClientY) >= DRAG_THRESHOLD_PX;
    if (!moved) return;
    if (!draggingTarget.moved) setDraggingTarget((current) => current ? { ...current, moved: true } : null);
    const node = session.workingNodes[draggingTarget.index];
    if (!node) return;
    if (draggingTarget.type === "anchor") {
      vector.setWorkingNodes((nodes) => nodes.map((item, index) => index === draggingTarget.index ? moveVectorNode(item, point.x, point.y) : item));
    } else {
      const handlePoint = event.shiftKey ? constrainVectorHandle(node, point) : point;
      vector.updateActiveHandle(draggingTarget.type, handlePoint.x, handlePoint.y, event.altKey);
    }
  };

  const endPointerInteraction = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingTarget || event.pointerId !== draggingTarget.pointerId) return;
    releasePointer(event.pointerId);
    if (draggingTarget.createdNode && !draggingTarget.moved) vector.setWorkingNodes((nodes) => {
      const next = cloneVectorNodes(nodes);
      const node = next[draggingTarget.index];
      if (node) { node.handleIn = undefined; node.handleOut = undefined; }
      return next;
    });
    setDraggingTarget(null);
  };

  const cancelPointerInteraction = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingTarget || event.pointerId !== draggingTarget.pointerId) return;
    releasePointer(event.pointerId);
    setDraggingTarget(null);
  };

  const handleAnchorPointerDown = (event: React.PointerEvent<HTMLButtonElement>, index: number) => {
    event.stopPropagation();
    vector.setActiveNodeIndex(index);
    if (session.mode === "create" && index === 0 && session.workingNodes.length >= 3) { vector.setClosed(true); commitVectorEditing(true); return; }
    if (event.altKey) { vector.setWorkingNodes((nodes) => nodes.map((node, nodeIndex) => nodeIndex === index ? toggleVectorNodeKind(node) : node)); return; }
    beginDrag(event, index, "anchor");
  };

  const compiledPath = compileVectorPath(session.workingNodes, session.closed);
  const activeNodeIndex = session.activeNodeIndex;
  const activeNode = activeNodeIndex === null ? null : session.workingNodes[activeNodeIndex] ?? null;
  const previewPath = session.mode === "create" && session.workingNodes.length && pointerPosition && !draggingTarget
    ? compileVectorPath([session.workingNodes[session.workingNodes.length - 1], { id: "preview", x: pointerPosition.x, y: pointerPosition.y, mirror: "mirrored" }])
    : "";
  const previewFill = session.closed && session.appearance.fill !== "none" && !isCssGradient(session.appearance.fill) ? session.appearance.fill : "none";

  return (
    <div ref={rootRef} className="absolute inset-0 z-50 touch-none" style={{ cursor: session.mode === "create" ? "crosshair" : "default" }}
      onPointerDown={handleSurfacePointerDown} onPointerMove={handlePointerMove} onPointerUp={endPointerInteraction}
      onPointerCancel={cancelPointerInteraction} onLostPointerCapture={cancelPointerInteraction}>
      {session.validationMessage && <div className="absolute bottom-4 left-1/2 z-[60] -translate-x-1/2 rounded-md bg-background/95 px-3 py-1.5 text-xs text-red-500 shadow-lg">{session.validationMessage}</div>}
      <div className="absolute top-4 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-1 rounded-lg border border-brand-400/20 bg-background p-1.5 shadow-lg" onPointerDown={(event) => event.stopPropagation()}>
          {(["mirrored", "asymmetric", "disconnected"] as const).map((mirror) => (
            <button key={mirror} type="button" aria-label={`${mirror} handles`} aria-pressed={activeNode?.mirror === mirror} disabled={!activeNode}
              title={`${mirror[0].toUpperCase()}${mirror.slice(1)} handles`} onClick={() => vector.setActiveNodeMirror(mirror)}
              className={`rounded px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-35 ${activeNode?.mirror === mirror ? "bg-brand-400/20 text-brand-400" : "text-foreground/50 hover:bg-brand-400/10"}`}>
              {mirror[0].toUpperCase()}
            </button>
          ))}
          <button type="button" disabled={!session.closed && session.workingNodes.length < 3} onClick={() => vector.setClosed(!session.closed)} className="rounded px-2 py-1 text-xs text-foreground/60 disabled:opacity-35">{session.closed ? "Open" : "Close"}</button>
          <button type="button" onClick={vector.cancel} className="rounded px-2 py-1 text-xs text-foreground/60">Cancel</button>
          <button type="button" disabled={session.workingNodes.length < 2} onClick={vector.commit} className="rounded bg-brand-400 px-2 py-1 text-xs font-semibold text-black disabled:opacity-35">Done</button>
      </div>
      <svg className="absolute inset-0 h-full w-full overflow-visible pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d={compiledPath} fill={previewFill} stroke={session.appearance.stroke} strokeWidth={session.appearance.strokeWidth} opacity={session.appearance.opacity} vectorEffect="non-scaling-stroke" />
        {previewPath && <path d={previewPath} fill="none" stroke="#F24E1E" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />}
      </svg>
      <svg className="absolute inset-0 h-full w-full overflow-visible pointer-events-none">
        {session.workingNodes.map((node, index) => {
          const active = index === session.activeNodeIndex;
          return <g key={node.id}>
            {active && (["handleIn", "handleOut"] as const).map((type) => {
              const handle = node[type];
              return handle ? <line key={type} x1={`${node.x}%`} y1={`${node.y}%`} x2={`${handle.x}%`} y2={`${handle.y}%`} stroke="#888" strokeWidth={1} /> : null;
            })}
          </g>;
        })}
      </svg>
      {session.workingNodes.map((node, index) => {
        const active = index === session.activeNodeIndex;
        const smooth = Boolean(node.handleIn || node.handleOut);
        const closeable = session.mode === "create" && index === 0 && session.workingNodes.length >= 3;
        return <button
          key={node.id}
          type="button"
          aria-label={closeable ? "Close path at first point" : `Select point ${index + 1}`}
          title={closeable ? "Click to close path" : `Point ${index + 1}`}
          style={{ left: `${node.x}%`, top: `${node.y}%` }}
          className={`absolute z-[54] flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 touch-none items-center justify-center rounded-full ${closeable ? "cursor-pointer ring-2 ring-[#F24E1E]/80" : "cursor-move"}`}
          onPointerDown={(event) => handleAnchorPointerDown(event, index)}
        >
          <span className={`block h-3 w-3 border-2 border-[#18A0FB] ${smooth ? "rounded-full" : "rounded-[1px]"} ${active ? "bg-[#18A0FB]" : "bg-white"}`} />
        </button>;
      })}
      {activeNode && activeNodeIndex !== null && (["handleIn", "handleOut"] as const).map((type) => {
        const handle = activeNode[type];
        return handle ? <button
          key={type}
          type="button"
          aria-label={type === "handleIn" ? "Drag incoming handle" : "Drag outgoing handle"}
          title={type === "handleIn" ? "Handle in" : "Handle out"}
          style={{ left: `${handle.x}%`, top: `${handle.y}%` }}
          className="absolute z-[55] h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 touch-none cursor-crosshair border-2 border-[#18A0FB] bg-white transition-transform hover:scale-125"
          onPointerDown={(event) => beginDrag(event, activeNodeIndex, type)}
        /> : null;
      })}
    </div>
  );
}
