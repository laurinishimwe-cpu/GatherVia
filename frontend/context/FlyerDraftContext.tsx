"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
  useRef,
} from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_FLYER_CONFIGURATION, type FlyerConfiguration } from "@/lib/types/flyer";
import { consumePendingTemplate } from "@/lib/session/pending-flyer";
import { buildFlyerTemplateDraft } from "@/lib/flyer/template-preview";
import { normalizeCanvasLayers } from "@/lib/flyer/normalizeLayers";
import { normalizeFlyerFontConfiguration } from "@/lib/flyer/fontRegistry";
import type { CanvasLayer } from "@/lib/types/canvas";
import type { EditorTool } from "@/components/editor/editor-types";
import { handler } from "@/lib/api/api";
import { useEventContext } from "@/context/EventContext";
import { fetchEventById } from "@/lib/api/events";
import { useToast } from "@/components/providers/ToastProvider";
import { uploadFlyer } from "@/lib/api/flyers";
import { useAuth } from "@/context/AuthContext";  // NEW
import { VectorEditProvider } from "@/context/VectorEditContext";

// ------------------------------------------------------------------
//  Helper: generate a simple SVG preview
// ------------------------------------------------------------------
function generatePreviewSvg(bg: string, accent: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920">
    <rect width="100%" height="100%" fill="${bg}" />
    <circle cx="540" cy="960" r="300" fill="${accent}" opacity="0.15" />
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`;
}

// ------------------------------------------------------------------
//  Types
// ------------------------------------------------------------------

interface ViewportState {
  x: number;
  y: number;
  scale: number;
}

export interface PreviewGuest {
  id: string;
  name: string;
  category: string;
  qrHash: string;
}

export interface FlyerDraft {
  configuration: FlyerConfiguration | null;
  templateId?: string | null;
  templateTitle?: string | null;
  layers: CanvasLayer[];
  previewUrl: string | null;
  selectedLayerId: string | null;
  designLocked: boolean;
  zoom: number;
  stubPreviewMode: boolean;
  isFrameSelected: boolean;
  viewport: ViewportState;
  flyerId?: string | null;
}

interface FlyerDraftContextValue {
  draft: FlyerDraft;
  previewGuest: PreviewGuest | null;
  setPreviewGuest: Dispatch<SetStateAction<PreviewGuest | null>>;
  setFlyerDraft: (input: {
    file?: File;
    previewUrl?: string;
    configuration: FlyerConfiguration;
    templateId?: string;
    templateTitle?: string;
    layers?: CanvasLayer[];
    designLocked?: boolean;
  }) => void;
  updateFlyerConfiguration: (patch: Partial<FlyerConfiguration>) => void;
  clearFlyerDraft: () => void;
  addLayer: (layer: Omit<CanvasLayer, "id">) => string;
  addImageFromDevice: (
    file: File,
    position?: { centerX: number; centerY: number },
  ) => Promise<string | null>;
  updateLayer: (id: string, patch: Partial<CanvasLayer>) => void;
  removeLayer: (id: string) => void;
  selectLayer: (id: string | null) => void;
  selectFrame: (selected: boolean) => void;
  moveLayerUp: (id: string) => void;
  moveLayerDown: (id: string) => void;
  moveLayerToIndex: (layerId: string, newIndex: number) => void;
  lockDesign: () => Promise<void>;
  unlockDesign: () => void;
  setStubPreviewMode: (mode: boolean) => void;
  activeTool: EditorTool;
  setActiveTool: (tool: EditorTool) => void;
  copySelectedLayer: () => void;
  cutSelectedLayer: () => void;
  pasteLayer: () => void;
  duplicateSelectedLayer: () => void;
  deleteSelectedLayer: () => void;
  setPenMode: (active: boolean) => void;
  viewport: ViewportState;
  setViewport: Dispatch<SetStateAction<ViewportState>>;
  isFrameSelected: boolean;
  unsavedWork: boolean;
}

// ------------------------------------------------------------------
//  Defaults
// ------------------------------------------------------------------

const EMPTY_DRAFT: FlyerDraft = {
  configuration: null,
  templateId: null,
  templateTitle: null,
  layers: [],
  previewUrl: null,
  selectedLayerId: null,
  designLocked: false,
  zoom: 1,
  stubPreviewMode: false,
  isFrameSelected: false,
  viewport: { x: 0, y: 0, scale: 1 },
  flyerId: null,
};

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function cloneLayer(layer: CanvasLayer, zIndex: number, offset = 2): CanvasLayer {
  const x = Math.min(Math.max(layer.x + offset, -layer.width + 1), 99);
  const y = Math.min(Math.max(layer.y + offset, -layer.height + 1), 99);

  return {
    ...layer,
    id: generateId(),
    x,
    y,
    zIndex,
    shadow: layer.shadow ? { ...layer.shadow } : undefined,
    nodes: layer.nodes?.map((node) => ({
      ...node,
      id: generateId(),
      handleIn: node.handleIn ? { ...node.handleIn } : undefined,
      handleOut: node.handleOut ? { ...node.handleOut } : undefined,
    })),
  };
}

// Richer preview for template loading (kept for compatibility)
function generateTemplatePreview(
  bgColor: string,
  accentColor: string,
  title: string
): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920">
    <rect width="100%" height="100%" fill="${bgColor}" />
    <rect x="80" y="200" width="190" height="20" rx="10" fill="${accentColor}" />
    <text x="80" y="320" fill="#222" font-family="Georgia, serif" font-size="72" font-weight="700">${title}</text>
    <rect x="80" y="380" width="400" height="200" rx="32" fill="${accentColor}" opacity="0.2" />
    <circle cx="900" cy="1700" r="120" fill="${accentColor}" opacity="0.3" />
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`;
}

// ------------------------------------------------------------------
//  Context
// ------------------------------------------------------------------

const FlyerDraftContext = createContext<FlyerDraftContextValue | undefined>(undefined);

interface FlyerDraftProviderProps {
  children: ReactNode;
  scope?: "event" | "template";
}

export function FlyerDraftProvider({
  children,
  scope = "event",
}: FlyerDraftProviderProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { activeEvent, createRealEvent } = useEventContext();
  const { refreshToken } = useAuth(); // NEW

  const [draft, setDraft] = useState<FlyerDraft>(EMPTY_DRAFT);
  const [previewGuest, setPreviewGuest] = useState<PreviewGuest | null>(null);
  const [unsavedWork, setUnsavedWork] = useState(false);
  const [activeTool, setActiveTool] = useState<EditorTool>("select");
  const layerClipboardRef = useRef<CanvasLayer | null>(null);

  // Template editing reuses the canvas components, but it must never hydrate
  // or attach uploads to the event that happens to be active in the session.
  const activeEventId = scope === "event" ? activeEvent?.id : undefined;
  const pendingTemplateLoaded = useRef(false);
  const loadedEventIdRef = useRef<string | null>(null);
  const skipSavedDesignLoadForEventIdRef = useRef<string | null>(null);

  // ── File upload helper ────────────────────────────
  const uploadBaseFlyer = useCallback(async (input: {
    file: File;
    configuration: FlyerConfiguration;
  }) => {
    try {
      const record = await uploadFlyer(
        input.file,
        input.configuration,
        activeEventId && /^[a-f\d]{24}$/i.test(activeEventId)
          ? activeEventId
          : undefined,
      );
      setDraft(prev => ({
        ...prev,
        previewUrl: record.image_url,
        flyerId: record.id ?? record._id,
      }));
    } catch (e) {
      console.error("Failed to upload base flyer", e);
      toast("Failed to upload flyer image", "error");
    }
  }, [activeEventId, toast]);

  // ── Load saved design for the current event ──────
  useEffect(() => {
    if (!activeEventId || !/^[a-f\d]{24}$/i.test(activeEventId)) {
      return;
    }

    if (loadedEventIdRef.current === activeEventId) return;

    if (skipSavedDesignLoadForEventIdRef.current === activeEventId) {
      loadedEventIdRef.current = activeEventId;
      skipSavedDesignLoadForEventIdRef.current = null;
      return;
    }

    const loadSavedDesign = async () => {
      if (pendingTemplateLoaded.current) {
        loadedEventIdRef.current = activeEventId;
        pendingTemplateLoaded.current = false;
        return;
      }
      try {
        const event = await fetchEventById(activeEventId);
        if (event?.design_layers && event.design_layers.length > 0) {
          const configuration = normalizeFlyerFontConfiguration(
            event.design_configuration ?? DEFAULT_FLYER_CONFIGURATION(1080, 1920),
          );
          const layers: CanvasLayer[] = normalizeCanvasLayers(event.design_layers);

          setDraft({
            ...EMPTY_DRAFT,
            configuration,
            layers,
            previewUrl:
              event.flyer_image_url ??
              generatePreviewSvg(configuration.canvas_background_color, "#4fd6be"),
            designLocked: true,
            stubPreviewMode: true,
          });
          loadedEventIdRef.current = activeEventId;
        } else {
          setDraft(EMPTY_DRAFT);
        }
        loadedEventIdRef.current = activeEventId;
      } catch (err) {
        console.warn("Could not load saved design for event", activeEventId, err);
        setDraft(EMPTY_DRAFT);
        loadedEventIdRef.current = activeEventId;
      }
    };

    void loadSavedDesign();
  }, [activeEventId]);

  // ── Rehydrate a pending template ──────────────────
  useEffect(() => {
    try {
      const template = consumePendingTemplate();
      if (template) {
        const built = buildFlyerTemplateDraft(template);
        const previewUrl = generateTemplatePreview(
          template.canvas_background_color,
          template.accent_color,
          template.title
        );
        // The pending template is an external session value being rehydrated once.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDraft({
          ...EMPTY_DRAFT,
          configuration: built.configuration,
          layers: built.layers,
          previewUrl,
          templateId: template.id,
          templateTitle: template.title,
        });
        pendingTemplateLoaded.current = true;
      }
    } catch {
      // ignore
    }
  }, []);

  // ── Flyer basics ──────────────────────────────────

  const setFlyerDraft = useCallback((input: {
    file?: File;
    previewUrl?: string;
    configuration: FlyerConfiguration;
    templateId?: string;
    templateTitle?: string;
    layers?: CanvasLayer[];
    designLocked?: boolean;
  }) => {
    // Generate a preview if none provided
    const previewUrl = input.previewUrl ?? generatePreviewSvg(
      input.configuration.canvas_background_color,
      "#4fd6be" // fallback accent
    );

    setDraft({
      configuration: input.configuration,
      templateId: input.templateId ?? null,
      templateTitle: input.templateTitle ?? null,
      layers: input.layers ?? [],
      previewUrl,
      selectedLayerId: null,
      designLocked: input.designLocked ?? false,
      zoom: 1,
      stubPreviewMode: false,
      isFrameSelected: false,
      viewport: EMPTY_DRAFT.viewport,
      flyerId: null,
    });

    setPreviewGuest(null);
    setActiveTool("select");
    layerClipboardRef.current = null;
    setUnsavedWork(false);

    if (input.file) {
      uploadBaseFlyer({
        file: input.file,
        configuration: input.configuration,
      });
    }
  }, [uploadBaseFlyer]);

  const updateFlyerConfiguration = useCallback(
    (patch: Partial<FlyerConfiguration>) => {
      setDraft((prev) => {
        if (!prev.configuration) return prev;
        return {
          ...prev,
          configuration: { ...prev.configuration, ...patch },
        };
      });
      setUnsavedWork(true);
    },
    [],
  );

  const clearFlyerDraft = () => {
    setDraft(EMPTY_DRAFT);
    setPreviewGuest(null);
    setUnsavedWork(false);
    setActiveTool("select");
    layerClipboardRef.current = null;
  };

  // ── UPDATED lockDesign: refresh token + create real event if needed ──
  const lockDesign = useCallback(async () => {
    if (!draft.configuration) {
      toast("No design to save", "error");
      return;
    }

    // 1. Refresh token before any critical API call
    try {
      await refreshToken();
    } catch {
      toast("Your session has expired. Please log in again.", "error");
      return;
    }

    // 2. Ensure we have a real event ID
    let eventId = activeEventId;

    const isLocalId = !eventId || !/^[a-f\d]{24}$/i.test(eventId);
    if (isLocalId) {
      if (!activeEvent?.title) {
        toast("Event name is missing. Please set an event name.", "error");
        return;
      }
      try {
        eventId = await createRealEvent(activeEvent.title, activeEvent.event_type);
        skipSavedDesignLoadForEventIdRef.current = eventId;
      } catch (e) {
        skipSavedDesignLoadForEventIdRef.current = null;
        toast("Failed to create event. Please try again.", "error");
        console.error("createRealEvent failed", e);
        return;
      }
    }

    // 3. Save the design
    try {
      await handler(`/api/v1/events/${eventId}/design`, {
        method: "PATCH",
        auth: true,
        json: {
          layers: normalizeCanvasLayers(draft.layers),
          configuration: normalizeFlyerFontConfiguration(draft.configuration),
        },
      });
      setDraft((prev) => ({ ...prev, designLocked: true, stubPreviewMode: true }));
      setUnsavedWork(false);
      router.replace(`/dashboard/event/${eventId}`);
      toast("Design saved successfully", "success");
    } catch (e) {
      toast("Failed to save design", "error");
      console.error("Save design failed", e);
    }
  }, [
    draft,
    activeEvent,
    activeEventId,
    createRealEvent,
    router,
    toast,
    refreshToken, // NEW dependency
  ]);

  const unlockDesign = useCallback(() => {
    setDraft((prev) => ({
      ...prev,
      designLocked: false,
      stubPreviewMode: false,
    }));
    setUnsavedWork(false);
  }, []);

  // ── Layer management ──────────────────────────────

  const addLayer = useCallback((layer: Omit<CanvasLayer, "id">) => {
    const newLayer: CanvasLayer = { id: generateId(), ...layer };
    setDraft((prev) => ({
      ...prev,
      layers: [...prev.layers, newLayer],
      selectedLayerId: newLayer.id,
    }));
    setUnsavedWork(true);
    return newLayer.id;
  }, []);

  const addImageFromDevice = useCallback(async (
    file: File,
    position?: { centerX: number; centerY: number },
  ): Promise<string | null> => {
    const configuration = draft.configuration;
    if (!configuration) {
      toast("Open a design before adding an image", "error");
      return null;
    }
    if (!file.type.startsWith("image/")) {
      toast("Please choose an image file", "error");
      return null;
    }

    try {
      const record = await uploadFlyer(
        file,
        configuration,
        activeEventId && /^[a-f\d]{24}$/i.test(activeEventId)
          ? activeEventId
          : undefined,
      );
      const imageUrl = record.image_url;
      const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
        image.onerror = () => reject(new Error("The uploaded image could not be loaded."));
        image.src = imageUrl;
      });

      const canvasWidth = configuration.image_width || 1080;
      const canvasHeight = (configuration.image_height || 1920) * (2 / 3);
      const canvasRatio = canvasWidth / canvasHeight;
      const imageRatio = dimensions.width / dimensions.height;
      const width = 40;
      const height = width * (canvasRatio / imageRatio);
      const centerX = position?.centerX ?? 50;
      const centerY = position?.centerY ?? 50;
      const x = Math.min(Math.max(centerX - width / 2, -width + 1), 99);
      const y = Math.min(Math.max(centerY - height / 2, -height + 1), 99);
      const zIndex = draft.layers.reduce((highest, layer) => Math.max(highest, layer.zIndex), -1) + 1;

      const layerId = addLayer({
        type: "image",
        name: file.name,
        x,
        y,
        width,
        height,
        rotation: 0,
        opacity: 1,
        zIndex,
        visible: true,
        locked: false,
        imageUrl,
      });
      toast("Image uploaded and added to the design", "success");
      return layerId;
    } catch (error) {
      console.error("Design image upload failed", error);
      toast(
        error instanceof Error ? error.message : "Failed to upload design image",
        "error",
      );
      return null;
    }
  }, [activeEventId, addLayer, draft.configuration, draft.layers, toast]);

  const updateLayer = useCallback(
    (id: string, patch: Partial<CanvasLayer>) => {
      setDraft((prev) => ({
        ...prev,
        layers: prev.layers.map((l) =>
          l.id === id ? { ...l, ...patch } : l,
        ),
      }));
      setUnsavedWork(true);
    },
    [],
  );

  const removeLayer = useCallback((id: string) => {
    setDraft((prev) => ({
      ...prev,
      layers: prev.layers.filter((l) => l.id !== id),
      selectedLayerId: prev.selectedLayerId === id ? null : prev.selectedLayerId,
    }));
    setUnsavedWork(true);
  }, []);

  const copySelectedLayer = useCallback(() => {
    const selected = draft.layers.find((layer) => layer.id === draft.selectedLayerId);
    if (!selected || selected.type === "frame") return;
    layerClipboardRef.current = cloneLayer(selected, selected.zIndex, 0);
  }, [draft.layers, draft.selectedLayerId]);

  const deleteSelectedLayer = useCallback(() => {
    setDraft((prev) => {
      const selected = prev.layers.find((layer) => layer.id === prev.selectedLayerId);
      if (!selected || selected.locked || selected.type === "frame") return prev;
      setUnsavedWork(true);
      return {
        ...prev,
        layers: prev.layers.filter((layer) => layer.id !== selected.id),
        selectedLayerId: null,
      };
    });
  }, []);

  const cutSelectedLayer = useCallback(() => {
    const selected = draft.layers.find((layer) => layer.id === draft.selectedLayerId);
    if (!selected || selected.locked || selected.type === "frame") return;
    layerClipboardRef.current = cloneLayer(selected, selected.zIndex, 0);
    removeLayer(selected.id);
  }, [draft.layers, draft.selectedLayerId, removeLayer]);

  const pasteLayer = useCallback(() => {
    const source = layerClipboardRef.current;
    if (!source) return;
    setDraft((prev) => {
      const nextZIndex = prev.layers.reduce((max, layer) => Math.max(max, layer.zIndex), -1) + 1;
      const clone = cloneLayer(source, nextZIndex);
      return {
        ...prev,
        layers: [...prev.layers, clone],
        selectedLayerId: clone.id,
        isFrameSelected: false,
      };
    });
    setUnsavedWork(true);
  }, []);

  const duplicateSelectedLayer = useCallback(() => {
    setDraft((prev) => {
      const selected = prev.layers.find((layer) => layer.id === prev.selectedLayerId);
      if (!selected || selected.type === "frame") return prev;
      const nextZIndex = prev.layers.reduce((max, layer) => Math.max(max, layer.zIndex), -1) + 1;
      const clone = cloneLayer(selected, nextZIndex);
      setUnsavedWork(true);
      return {
        ...prev,
        layers: [...prev.layers, clone],
        selectedLayerId: clone.id,
        isFrameSelected: false,
      };
    });
  }, []);

  const selectLayer = useCallback((id: string | null) => {
    setDraft((prev) => ({ ...prev, selectedLayerId: id, isFrameSelected: false }));
  }, []);

  const selectFrame = useCallback((selected: boolean) => {
    setDraft((prev) => ({
      ...prev,
      isFrameSelected: selected,
      selectedLayerId: null,
    }));
  }, []);

  const moveLayerUp = useCallback((id: string) => {
    setDraft((prev) => {
      const index = prev.layers.findIndex((l) => l.id === id);
      if (index <= 0) return prev;
      const newLayers = [...prev.layers];
      [newLayers[index - 1], newLayers[index]] = [
        newLayers[index],
        newLayers[index - 1],
      ];
      return { ...prev, layers: newLayers };
    });
    setUnsavedWork(true);
  }, []);

  const moveLayerDown = useCallback((id: string) => {
    setDraft((prev) => {
      const index = prev.layers.findIndex((l) => l.id === id);
      if (index === -1 || index >= prev.layers.length - 1) return prev;
      const newLayers = [...prev.layers];
      [newLayers[index], newLayers[index + 1]] = [
        newLayers[index + 1],
        newLayers[index],
      ];
      return { ...prev, layers: newLayers };
    });
    setUnsavedWork(true);
  }, []);

  const moveLayerToIndex = useCallback((id: string, targetIndex: number) => {
    setDraft((prev) => {
      const layers = [...prev.layers];
      const oldIndex = layers.findIndex((l) => l.id === id);
      if (oldIndex === -1 || oldIndex === targetIndex) return prev;

      const [draggedItem] = layers.splice(oldIndex, 1);
      layers.splice(targetIndex, 0, draggedItem);

      const reindexedLayers = layers.map((layer, i) => ({
        ...layer,
        zIndex: i,
      }));

      return { ...prev, layers: reindexedLayers };
    });
    setUnsavedWork(true);
  }, []);

  // ── UI toggles ─────────────────────────────────────

  const setStubPreviewMode = useCallback((mode: boolean) => {
    setDraft((prev) => ({ ...prev, stubPreviewMode: mode }));
  }, []);

  const setPenMode = useCallback((active: boolean) => {
    setActiveTool(active ? "pen" : "select");
  }, []);

  // ── Provider value ────────────────────────────────

  const value: FlyerDraftContextValue = {
    draft,
    previewGuest,
    setPreviewGuest,
    setFlyerDraft,
    updateFlyerConfiguration,
    clearFlyerDraft,
    addLayer,
    addImageFromDevice,
    updateLayer,
    removeLayer,
    selectLayer,
    selectFrame,
    moveLayerUp,
    moveLayerDown,
    moveLayerToIndex,
    lockDesign,
    unlockDesign,
    setStubPreviewMode,
    activeTool,
    setActiveTool,
    copySelectedLayer,
    cutSelectedLayer,
    pasteLayer,
    duplicateSelectedLayer,
    deleteSelectedLayer,
    setPenMode,
    viewport: draft.viewport,
    setViewport: (v: SetStateAction<ViewportState>) =>
      setDraft((prev) => ({
        ...prev,
        viewport: typeof v === "function"
          ? (v as (p: ViewportState) => ViewportState)(prev.viewport)
          : v,
      })),
    isFrameSelected: draft.isFrameSelected,
    unsavedWork,
  };

  return (
    <FlyerDraftContext.Provider value={value}>
      <VectorEditProvider>{children}</VectorEditProvider>
    </FlyerDraftContext.Provider>
  );
}

export function useFlyerDraft() {
  const ctx = useContext(FlyerDraftContext);
  if (!ctx) throw new Error("useFlyerDraft must be used within FlyerDraftProvider");
  return ctx;
}
