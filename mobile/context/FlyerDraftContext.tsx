import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { CanvasLayer } from "@/lib/types/canvas";
import { DEFAULT_FLYER_CONFIGURATION, type FlyerConfiguration } from "@/lib/types/flyer";
import { normalizeCanvasLayer, normalizeCanvasLayers } from "@/lib/flyer/normalizeLayers";
import { normalizeFlyerFontConfiguration } from "@/lib/flyer/fontRegistry";

export type EditorMode = "design" | "stub";
export type StubRegion = "background" | "guest" | "event-details" | "qr";

export interface EditorViewport {
  x: number;
  y: number;
  scale: number;
}

interface FlyerDraftContextValue {
  layers: CanvasLayer[];
  configuration: FlyerConfiguration;
  setLayers: (layers: CanvasLayer[]) => void;
  setConfiguration: (configuration: FlyerConfiguration) => void;
  selectedLayerId: string | null;
  selectLayer: (id: string | null) => void;
  editorMode: EditorMode;
  setEditorMode: (mode: EditorMode) => void;
  selectedStubRegion: StubRegion;
  setSelectedStubRegion: (region: StubRegion) => void;
  designViewport: EditorViewport;
  setDesignViewport: Dispatch<SetStateAction<EditorViewport>>;
  stubViewport: EditorViewport;
  setStubViewport: Dispatch<SetStateAction<EditorViewport>>;
  updateLayer: (id: string, patch: Partial<CanvasLayer>) => void;
  addLayer: (layer: Omit<CanvasLayer, "id">) => string;
  removeLayer: (id: string) => void;
  hasUnsavedChanges: boolean;
  markSaved: () => void;
  resetDraft: () => void;
}

const INITIAL_VIEWPORT: EditorViewport = { x: 0, y: 0, scale: 1 };
const FlyerDraftContext = createContext<FlyerDraftContextValue | null>(null);

function createLayerId() {
  return `mobile-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function FlyerDraftProvider({ children }: { children: ReactNode }) {
  const [layersState, setLayersState] = useState<CanvasLayer[]>([]);
  const [configurationState, setConfigurationState] = useState(DEFAULT_FLYER_CONFIGURATION());
  const [selectedLayerId, selectLayer] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>("design");
  const [selectedStubRegion, setSelectedStubRegion] = useState<StubRegion>("background");
  const [designViewport, setDesignViewport] = useState<EditorViewport>(INITIAL_VIEWPORT);
  const [stubViewport, setStubViewport] = useState<EditorViewport>(INITIAL_VIEWPORT);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const setLayers = useCallback((layers: CanvasLayer[]) => {
    setLayersState(normalizeCanvasLayers(layers));
    setHasUnsavedChanges(true);
  }, []);

  const setConfiguration = useCallback((configuration: FlyerConfiguration) => {
    setConfigurationState(normalizeFlyerFontConfiguration(configuration));
    setHasUnsavedChanges(true);
  }, []);

  const updateLayer = useCallback((id: string, patch: Partial<CanvasLayer>) => {
    setLayersState((current) => current.map((layer, index) =>
      layer.id === id
        ? normalizeCanvasLayer({ ...layer, ...patch, id: layer.id }, index)
        : layer,
    ));
    setHasUnsavedChanges(true);
  }, []);

  const addLayer = useCallback((layer: Omit<CanvasLayer, "id">) => {
    const id = createLayerId();
    setLayersState((current) => [
      ...current,
      normalizeCanvasLayer({ ...layer, id }, current.length),
    ]);
    selectLayer(id);
    setHasUnsavedChanges(true);
    return id;
  }, []);

  const removeLayer = useCallback((id: string) => {
    setLayersState((current) => current.filter((layer) => layer.id !== id));
    selectLayer((current) => current === id ? null : current);
    setHasUnsavedChanges(true);
  }, []);

  const markSaved = useCallback(() => setHasUnsavedChanges(false), []);

  const resetDraft = useCallback(() => {
    setLayersState([]);
    setConfigurationState(DEFAULT_FLYER_CONFIGURATION());
    selectLayer(null);
    setEditorMode("design");
    setSelectedStubRegion("background");
    setDesignViewport(INITIAL_VIEWPORT);
    setStubViewport(INITIAL_VIEWPORT);
    setHasUnsavedChanges(false);
  }, []);

  const value = useMemo<FlyerDraftContextValue>(() => ({
    layers: layersState,
    configuration: configurationState,
    setLayers,
    setConfiguration,
    selectedLayerId,
    selectLayer,
    editorMode,
    setEditorMode,
    selectedStubRegion,
    setSelectedStubRegion,
    designViewport,
    setDesignViewport,
    stubViewport,
    setStubViewport,
    updateLayer,
    addLayer,
    removeLayer,
    hasUnsavedChanges,
    markSaved,
    resetDraft,
  }), [
    addLayer, configurationState, editorMode, hasUnsavedChanges, layersState, markSaved,
    removeLayer, resetDraft, selectedLayerId, selectedStubRegion, setConfiguration,
    designViewport, setLayers, stubViewport, updateLayer,
  ]);

  return <FlyerDraftContext.Provider value={value}>{children}</FlyerDraftContext.Provider>;
}

export function useFlyerDraft() {
  const context = useContext(FlyerDraftContext);
  if (!context) throw new Error("useFlyerDraft must be used inside FlyerDraftProvider");
  return context;
}
