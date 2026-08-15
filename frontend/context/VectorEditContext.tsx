"use client";

import { createContext, useCallback, useContext, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { MirrorMode, VectorNode } from "@/lib/types/canvas";
import {
  applyVectorMirrorMode,
  cloneVectorNodes,
  moveVectorHandle,
  moveVectorNode,
  vectorNodeToCorner,
  vectorNodeToSmooth,
  type VectorHandleType,
} from "@/lib/flyer/vectorGeometry";

export type VectorEditorMode = "create" | "edit";

export interface VectorAppearance {
  stroke: string;
  strokeWidth: number;
  fill: string;
  opacity: number;
}

export interface VectorEditSessionState {
  mode: VectorEditorMode;
  layerId: string | null;
  workingNodes: VectorNode[];
  activeNodeIndex: number | null;
  closed: boolean;
  validationMessage: string | null;
  lastManipulatedHandle: VectorHandleType | null;
  appearance: VectorAppearance;
}

interface VectorActions { commit: () => void; cancel: () => void }

interface VectorEditContextValue {
  session: VectorEditSessionState | null;
  startSession: (session: VectorEditSessionState) => void;
  endSession: () => void;
  setWorkingNodes: Dispatch<SetStateAction<VectorNode[]>>;
  setValidationMessage: (message: string | null) => void;
  setActiveNodeIndex: (index: number | null) => void;
  setClosed: (closed: boolean) => void;
  setAppearance: (patch: Partial<VectorAppearance>) => void;
  updateActiveNodePosition: (x: number, y: number) => void;
  updateActiveHandle: (type: VectorHandleType, x: number, y: number, temporarilyDisconnected?: boolean) => void;
  setActiveNodeMirror: (mirror: MirrorMode) => void;
  convertActiveNodeToCorner: () => void;
  convertActiveNodeToSmooth: () => void;
  deleteActiveNode: () => void;
  cycleActiveNode: (direction: 1 | -1) => void;
  registerActions: (actions: VectorActions | null) => void;
  commit: () => void;
  cancel: () => void;
}

const VectorEditContext = createContext<VectorEditContextValue | undefined>(undefined);

export function VectorEditProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<VectorEditSessionState | null>(null);
  const actionsRef = useRef<VectorActions | null>(null);

  const updateNodes = useCallback((updater: (nodes: VectorNode[], session: VectorEditSessionState) => VectorNode[]) => {
    setSession((current) => current ? { ...current, workingNodes: updater(cloneVectorNodes(current.workingNodes), current) } : current);
  }, []);

  const value: VectorEditContextValue = {
    session,
    startSession: (next) => setSession({ ...next, workingNodes: cloneVectorNodes(next.workingNodes) }),
    endSession: () => setSession(null),
    setWorkingNodes: (next) => setSession((current) => current ? {
      ...current,
      workingNodes: typeof next === "function" ? next(current.workingNodes) : next,
    } : current),
    setValidationMessage: (validationMessage) => setSession((current) => current ? { ...current, validationMessage } : current),
    setActiveNodeIndex: (activeNodeIndex) => setSession((current) => current ? { ...current, activeNodeIndex } : current),
    setClosed: (closed) => setSession((current) => current ? { ...current, closed } : current),
    setAppearance: (patch) => setSession((current) => current ? { ...current, appearance: { ...current.appearance, ...patch } } : current),
    updateActiveNodePosition: (x, y) => updateNodes((nodes, current) => {
      if (current.activeNodeIndex !== null && nodes[current.activeNodeIndex]) nodes[current.activeNodeIndex] = moveVectorNode(nodes[current.activeNodeIndex], x, y);
      return nodes;
    }),
    updateActiveHandle: (type, x, y, temporarilyDisconnected = false) => {
      updateNodes((nodes, current) => {
        if (current.activeNodeIndex !== null && nodes[current.activeNodeIndex]) nodes[current.activeNodeIndex] = moveVectorHandle(nodes[current.activeNodeIndex], type, { x, y }, temporarilyDisconnected);
        return nodes;
      });
      setSession((current) => current ? { ...current, lastManipulatedHandle: type } : current);
    },
    setActiveNodeMirror: (mirror) => updateNodes((nodes, current) => {
      if (current.activeNodeIndex !== null && nodes[current.activeNodeIndex]) {
        const activeNode = nodes[current.activeNodeIndex];
        const nodeWithHandles = activeNode.handleIn || activeNode.handleOut
          ? activeNode
          : vectorNodeToSmooth(activeNode);
        nodes[current.activeNodeIndex] = applyVectorMirrorMode(nodeWithHandles, mirror, current.lastManipulatedHandle ?? undefined);
      }
      return nodes;
    }),
    convertActiveNodeToCorner: () => updateNodes((nodes, current) => {
      if (current.activeNodeIndex !== null && nodes[current.activeNodeIndex]) nodes[current.activeNodeIndex] = vectorNodeToCorner(nodes[current.activeNodeIndex]);
      return nodes;
    }),
    convertActiveNodeToSmooth: () => updateNodes((nodes, current) => {
      if (current.activeNodeIndex !== null && nodes[current.activeNodeIndex]) nodes[current.activeNodeIndex] = vectorNodeToSmooth(nodes[current.activeNodeIndex]);
      return nodes;
    }),
    deleteActiveNode: () => setSession((current) => {
      if (!current || current.activeNodeIndex === null) return current;
      const nodes = current.workingNodes.filter((_, index) => index !== current.activeNodeIndex);
      return { ...current, workingNodes: nodes, activeNodeIndex: nodes.length ? Math.min(current.activeNodeIndex, nodes.length - 1) : null, validationMessage: null };
    }),
    cycleActiveNode: (direction) => setSession((current) => {
      if (!current || current.workingNodes.length === 0) return current;
      const index = current.activeNodeIndex === null
        ? direction === 1 ? 0 : current.workingNodes.length - 1
        : (current.activeNodeIndex + direction + current.workingNodes.length) % current.workingNodes.length;
      return { ...current, activeNodeIndex: index };
    }),
    registerActions: (actions) => { actionsRef.current = actions; },
    commit: () => actionsRef.current?.commit(),
    cancel: () => actionsRef.current?.cancel(),
  };

  return <VectorEditContext.Provider value={value}>{children}</VectorEditContext.Provider>;
}

export function useVectorEdit() {
  const context = useContext(VectorEditContext);
  if (!context) throw new Error("useVectorEdit must be used within VectorEditProvider");
  return context;
}
