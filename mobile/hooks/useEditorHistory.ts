import { useCallback, useState } from "react";
import type { CanvasLayer } from "@/lib/types/canvas";
import type { StubRegion } from "@/context/FlyerDraftContext";
import type { FlyerConfiguration } from "@/lib/types/flyer";

interface EditorSnapshot {
  layers: CanvasLayer[];
  configuration: FlyerConfiguration;
  selectedLayerId: string | null;
  selectedStubRegion: StubRegion;
}

interface UseEditorHistoryOptions {
  layers: CanvasLayer[];
  configuration: FlyerConfiguration;
  selectedLayerId: string | null;
  selectedStubRegion: StubRegion;
  setLayers: (layers: CanvasLayer[]) => void;
  setConfiguration: (configuration: FlyerConfiguration) => void;
  selectLayer: (id: string | null) => void;
  setSelectedStubRegion: (region: StubRegion) => void;
}

interface EditorMutation {
  layers?: CanvasLayer[];
  configuration?: FlyerConfiguration;
  selectedLayerId?: string | null;
  selectedStubRegion?: StubRegion;
}

const HISTORY_LIMIT = 25;

export function cloneCanvasLayers(layers: CanvasLayer[]): CanvasLayer[] {
  return layers.map((layer) => ({
    ...layer,
    shadow: layer.shadow ? { ...layer.shadow } : undefined,
    nodes: layer.nodes?.map((node) => ({
      ...node,
      handleIn: node.handleIn ? { ...node.handleIn } : undefined,
      handleOut: node.handleOut ? { ...node.handleOut } : undefined,
    })),
  }));
}

export function cloneFlyerConfiguration(configuration: FlyerConfiguration): FlyerConfiguration {
  return { ...configuration, qr_bounds: { ...configuration.qr_bounds } };
}

function patchChangesLayer(layer: CanvasLayer, patch: Partial<CanvasLayer>) {
  return Object.entries(patch).some(([key, value]) => {
    const current = layer[key as keyof CanvasLayer];
    if (typeof current === "number" && typeof value === "number") {
      return Math.abs(current - value) > 0.00005;
    }
    return current !== value;
  });
}

export function useEditorHistory({
  layers,
  configuration,
  selectedLayerId,
  selectedStubRegion,
  setLayers,
  setConfiguration,
  selectLayer,
  setSelectedStubRegion,
}: UseEditorHistoryOptions) {
  const [undoStack, setUndoStack] = useState<EditorSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<EditorSnapshot[]>([]);

  const currentSnapshot = useCallback((): EditorSnapshot => ({
    layers: cloneCanvasLayers(layers),
    configuration: cloneFlyerConfiguration(configuration),
    selectedLayerId,
    selectedStubRegion,
  }), [configuration, layers, selectedLayerId, selectedStubRegion]);

  const recordSnapshot = useCallback(() => {
    const snapshot = currentSnapshot();
    setUndoStack((history) => [...history.slice(-(HISTORY_LIMIT - 1)), snapshot]);
    setRedoStack([]);
  }, [currentSnapshot]);

  const commitEditorMutation = useCallback((mutation: EditorMutation) => {
    recordSnapshot();
    const committedLayers = mutation.layers ? cloneCanvasLayers(mutation.layers) : null;
    if (committedLayers) setLayers(committedLayers);
    if (mutation.configuration) setConfiguration(cloneFlyerConfiguration(mutation.configuration));
    if (mutation.selectedStubRegion) setSelectedStubRegion(mutation.selectedStubRegion);
    if (mutation.selectedLayerId !== undefined || committedLayers) {
      const nextSelectedLayerId = mutation.selectedLayerId === undefined ? selectedLayerId : mutation.selectedLayerId;
      const selectionLayers = committedLayers ?? layers;
      selectLayer(nextSelectedLayerId && selectionLayers.some((layer) => layer.id === nextSelectedLayerId) ? nextSelectedLayerId : null);
    }
    return true;
  }, [layers, recordSnapshot, selectLayer, selectedLayerId, setConfiguration, setLayers, setSelectedStubRegion]);

  const commitLayerPatch = useCallback((id: string, patch: Partial<CanvasLayer>) => {
    const layer = layers.find((candidate) => candidate.id === id);
    if (!layer || !patchChangesLayer(layer, patch)) return false;
    return commitEditorMutation({
      layers: layers.map((candidate) => candidate.id === id ? { ...candidate, ...patch, id: candidate.id } : candidate),
    });
  }, [commitEditorMutation, layers]);

  const commitConfigurationPatch = useCallback((patch: Partial<FlyerConfiguration>) => {
    const changed = Object.entries(patch).some(([key, value]) => {
      const current = configuration[key as keyof FlyerConfiguration];
      if (typeof current === "number" && typeof value === "number") return Math.abs(current - value) > 0.00005;
      return current !== value;
    });
    if (!changed) return false;
    return commitEditorMutation({ configuration: { ...configuration, ...patch } });
  }, [commitEditorMutation, configuration]);

  const commitLayers = useCallback((nextLayers: CanvasLayer[], nextSelectedLayerId = selectedLayerId) => {
    commitEditorMutation({ layers: nextLayers, selectedLayerId: nextSelectedLayerId });
  }, [commitEditorMutation, selectedLayerId]);

  const restoreSnapshot = useCallback((snapshot: EditorSnapshot) => {
    const restoredLayers = cloneCanvasLayers(snapshot.layers);
    setLayers(restoredLayers);
    setConfiguration(cloneFlyerConfiguration(snapshot.configuration));
    setSelectedStubRegion(snapshot.selectedStubRegion);
    selectLayer(
      snapshot.selectedLayerId && restoredLayers.some((layer) => layer.id === snapshot.selectedLayerId)
        ? snapshot.selectedLayerId
        : null,
    );
  }, [selectLayer, setConfiguration, setLayers, setSelectedStubRegion]);

  const undo = useCallback(() => {
    const previous = undoStack.at(-1);
    if (!previous) return;
    setRedoStack((history) => [...history.slice(-(HISTORY_LIMIT - 1)), currentSnapshot()]);
    setUndoStack((history) => history.slice(0, -1));
    restoreSnapshot(previous);
  }, [currentSnapshot, restoreSnapshot, undoStack]);

  const redo = useCallback(() => {
    const next = redoStack.at(-1);
    if (!next) return;
    setUndoStack((history) => [...history.slice(-(HISTORY_LIMIT - 1)), currentSnapshot()]);
    setRedoStack((history) => history.slice(0, -1));
    restoreSnapshot(next);
  }, [currentSnapshot, redoStack, restoreSnapshot]);

  return {
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    recordSnapshot,
    commitLayerPatch,
    commitConfigurationPatch,
    commitLayers,
    undo,
    redo,
  };
}
