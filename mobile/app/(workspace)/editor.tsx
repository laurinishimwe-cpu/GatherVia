import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CopyPlus,
  Eye,
  ImageIcon,
  Info,
  Lock,
  Maximize2,
  RotateCcw,
  Save,
  Trash2,
  Type,
  Unlock,
} from "lucide-react-native";
import { useIsFocused } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EditorActionSheet } from "@/components/editor/EditorActionSheet";
import {
  AlignmentControls,
  ColourControls,
  NumberControls,
  ShapeControls,
  SheetButton,
  SheetFooter,
  TextEditControls,
  TypographyControls,
} from "@/components/editor/LayerPropertyControls";
import {
  MobileEditorBottomBar,
  type MobileEditorAction,
} from "@/components/editor/MobileEditorBottomBar";
import { SelectedLayerBubble } from "@/components/editor/SelectedLayerBubble";
import { MobileEditorCanvas } from "@/components/editor/MobileEditorCanvas";
import { MobileStubEditor } from "@/components/editor/MobileStubEditor";
import {
  type LayerGeometry,
  type TemporaryLayerOverride,
} from "@/components/editor/MobileFlyerRenderer";
import { MobileInvitationPreview } from "@/components/editor/MobileInvitationPreview";
import { MobileTicketStubRenderer } from "@/components/editor/MobileTicketStubRenderer";
import { ActionConfirmModal } from "@/components/common/ActionConfirmModal";
import {
  StubPropertyControls,
  initialStubPropertyPatch,
  type StubPropertySheetKind,
} from "@/components/editor/StubPropertyControls";
import { useEvent } from "@/context/EventContext";
import { useFlyerDraft, type StubRegion } from "@/context/FlyerDraftContext";
import { useThemeMode } from "@/context/ThemeContext";
import { useToast } from "@/context/ToastContext";
import { useWorkspaceChrome } from "@/context/WorkspaceChromeContext";
import { useEditorHistory, cloneCanvasLayers, cloneFlyerConfiguration } from "@/hooks/useEditorHistory";
import { useEditorOrientation } from "@/hooks/useEditorOrientation";
import { publishEventDesign, returnEventToEditor } from "@/lib/api/events";
import { uploadFlyer } from "@/lib/api/flyers";
import type { CanvasLayer } from "@/lib/types/canvas";
import type { FlyerConfiguration } from "@/lib/types/flyer";

type PropertySheetKind =
  | "text"
  | "colour"
  | "size"
  | "alignment"
  | "typography"
  | "shape"
  | "stroke"
  | "corners"
  | "opacity";

type SheetKind = PropertySheetKind | StubPropertySheetKind | "inspect" | "more" | "stub-more";
type OrderDirection = "forward" | "backward" | "front" | "back";

interface PropertySession {
  layerId: string;
  sheet: PropertySheetKind;
  originalLayer: CanvasLayer;
  workingPatch: Partial<CanvasLayer>;
  revision: number;
}

interface StubPropertySession {
  region: StubRegion;
  sheet: StubPropertySheetKind;
  originalConfiguration: FlyerConfiguration;
  workingPatch: Partial<FlyerConfiguration>;
  revision: number;
}

export default function EditorScreen() {
  const { activeEvent, markEventDraft, markEventPublished, setActiveEvent } = useEvent();
  const { leaveWorkspace } = useWorkspaceChrome();
  const editorWindow = useEditorOrientation();
  const { isLandscape } = editorWindow;
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const {
    layers,
    configuration,
    setLayers,
    setConfiguration,
    selectedLayerId,
    selectLayer,
    editorMode,
    setEditorMode,
    selectedStubRegion,
    setSelectedStubRegion,
    addLayer,
    removeLayer,
    hasUnsavedChanges,
    markSaved,
    designViewport,
    setDesignViewport,
    stubViewport,
    setStubViewport,
  } = useFlyerDraft();
  const { resolvedMode } = useThemeMode();
  const { showToast } = useToast();
  const light = resolvedMode === "light";
  const colors = light
    ? { background: "#eef3f1", panel: "#ffffff", border: "#cfe0dc", text: "#10211d", muted: "#657772" }
    : { background: "#07110f", panel: "#10221e", border: "#24483f", text: "#f5f8f7", muted: "#78918b" };
  const [saving, setSaving] = useState(false);
  const [replacingImage, setReplacingImage] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [returnConfirmOpen, setReturnConfirmOpen] = useState(false);
  const [returningToEditor, setReturningToEditor] = useState(false);
  const [returnError, setReturnError] = useState("");
  const [sheet, setSheet] = useState<SheetKind | null>(null);
  const [propertySession, setPropertySession] = useState<PropertySession | null>(null);
  const [stubPropertySession, setStubPropertySession] = useState<StubPropertySession | null>(null);
  const [propertyValid, setPropertyValid] = useState(true);
  const [gestureActive, setGestureActive] = useState(false);

  const {
    canUndo,
    canRedo,
    recordSnapshot,
    commitLayerPatch,
    commitConfigurationPatch,
    commitLayers,
    undo,
    redo,
  } = useEditorHistory({
    layers,
    configuration,
    selectedLayerId,
    selectedStubRegion,
    setLayers,
    setConfiguration,
    selectLayer,
    setSelectedStubRegion,
  });

  const selectedLayer = useMemo(
    () => layers.find((layer) => layer.id === selectedLayerId) ?? null,
    [layers, selectedLayerId],
  );
  const uploadedFlyerLayer = useMemo(
    () => layers.find((layer) => layer.type === "image" && layer.name === "Uploaded flyer") ?? null,
    [layers],
  );
  const workingLayer = useMemo(() => {
    if (!propertySession) return selectedLayer;
    return {
      ...propertySession.originalLayer,
      ...propertySession.workingPatch,
      id: propertySession.originalLayer.id,
    };
  }, [propertySession, selectedLayer]);
  const temporaryLayerOverride = useMemo<TemporaryLayerOverride | null>(() => propertySession ? ({
    layerId: propertySession.layerId,
    patch: propertySession.workingPatch,
  }) : null, [propertySession]);
  const temporaryConfigurationPatch = useMemo(() => stubPropertySession?.workingPatch ?? null, [stubPropertySession]);
  const workingConfiguration = useMemo(() => stubPropertySession
    ? { ...stubPropertySession.originalConfiguration, ...stubPropertySession.workingPatch }
    : configuration, [configuration, stubPropertySession]);
  const canvasOverlayInsets = useMemo(() => isLandscape ? ({
    top: Math.max(insets.top, 6) + 58,
    right: Math.max(insets.right, 6),
    bottom: Math.max(insets.bottom, 7) + 110,
    left: Math.max(insets.left, 6),
  }) : undefined, [insets.bottom, insets.left, insets.right, insets.top, isLandscape]);

  useEffect(() => {
    if (!isFocused) return;
    StatusBar.setHidden(isLandscape, "fade");
    return () => StatusBar.setHidden(false, "fade");
  }, [isFocused, isLandscape]);

  useEffect(() => {
    if (selectedLayerId && !selectedLayer) selectLayer(null);
  }, [selectLayer, selectedLayer, selectedLayerId]);

  useEffect(() => {
    if (!propertySession) return;
    if (!layers.some((layer) => layer.id === propertySession.layerId)) {
      setPropertySession(null);
      setSheet(null);
    }
  }, [layers, propertySession]);

  const addText = () => {
    recordSnapshot();
    addLayer({
      type: "text", parentId: "main-frame", name: "Text", x: 14, y: 24, width: 72, height: 12,
      rotation: 0, opacity: 1, zIndex: nextZIndex(layers, "main-frame"), visible: true, locked: false,
      text: "Your text", fontFamily: "Inter", fontSize: 48, fontWeight: "bold",
      fontStyle: "normal", textAlign: "center", color: "#10211d",
    });
  };

  const addShape = () => {
    recordSnapshot();
    addLayer({
      type: "rect", parentId: "main-frame", name: "Rectangle", x: 23, y: 52, width: 54, height: 12,
      rotation: 0, opacity: 1, zIndex: nextZIndex(layers, "main-frame"), visible: true, locked: false,
      fill: "#4fd6be", stroke: "transparent", strokeWidth: 0, borderRadius: 8,
    });
  };

  const closeSheetWithoutCommit = useCallback(() => {
    setPropertySession(null);
    setStubPropertySession(null);
    setPropertyValid(true);
    setSheet(null);
  }, []);

  const applyPropertySession = useCallback(() => {
    if (!propertySession && !stubPropertySession) {
      setSheet(null);
      return;
    }
    if (!propertyValid) {
      showToast("Fix the highlighted value before applying.", { tone: "error" });
      return;
    }
    if (propertySession) commitLayerPatch(propertySession.layerId, propertySession.workingPatch);
    if (stubPropertySession) commitConfigurationPatch(stubPropertySession.workingPatch);
    setPropertySession(null);
    setStubPropertySession(null);
    setPropertyValid(true);
    setSheet(null);
  }, [commitConfigurationPatch, commitLayerPatch, propertySession, propertyValid, showToast, stubPropertySession]);

  const closeSheet = useCallback(() => {
    if (propertySession || stubPropertySession) applyPropertySession();
    else setSheet(null);
  }, [applyPropertySession, propertySession, stubPropertySession]);

  const openPropertySheet = useCallback((kind: PropertySheetKind, layer: CanvasLayer) => {
    if (layer.locked) return;
    const originalLayer = cloneCanvasLayers([layer])[0];
    setPropertySession({
      layerId: layer.id,
      sheet: kind,
      originalLayer,
      workingPatch: initialPropertyPatch(kind, originalLayer),
      revision: 0,
    });
    setPropertyValid(true);
    setSheet(kind);
  }, []);

  const updatePropertyPatch = useCallback((patch: Partial<CanvasLayer>) => {
    setPropertySession((current) => current ? ({
      ...current,
      workingPatch: { ...current.workingPatch, ...patch },
    }) : current);
  }, []);

  const openStubPropertySheet = useCallback((kind: StubPropertySheetKind) => {
    const originalConfiguration = cloneFlyerConfiguration(configuration);
    setPropertySession(null);
    setStubPropertySession({
      region: selectedStubRegion,
      sheet: kind,
      originalConfiguration,
      workingPatch: initialStubPropertyPatch(kind, originalConfiguration),
      revision: 0,
    });
    setPropertyValid(true);
    setSheet(kind);
  }, [configuration, selectedStubRegion]);

  const updateStubPropertyPatch = useCallback((patch: Partial<FlyerConfiguration>) => {
    setStubPropertySession((current) => current ? ({ ...current, workingPatch: { ...current.workingPatch, ...patch } }) : current);
  }, []);

  const resetPropertySession = useCallback(() => {
    setPropertySession((current) => current ? ({
      ...current,
      workingPatch: initialPropertyPatch(current.sheet, current.originalLayer),
      revision: current.revision + 1,
    }) : current);
    setPropertyValid(true);
  }, []);

  const resetStubPropertySession = useCallback(() => {
    setStubPropertySession((current) => current ? ({
      ...current,
      workingPatch: initialStubPropertyPatch(current.sheet, current.originalConfiguration),
      revision: current.revision + 1,
    }) : current);
    setPropertyValid(true);
  }, []);

  const moveSelected = useCallback((direction: OrderDirection) => {
    if (!selectedLayer || selectedLayer.locked) return;
    const next = reorderLayers(layers, selectedLayer.id, direction);
    if (next) commitLayers(next, selectedLayer.id);
  }, [commitLayers, layers, selectedLayer]);

  const duplicateSelected = useCallback(() => {
    if (!selectedLayer || selectedLayer.locked) return;
    const duplicate = duplicateLayer(selectedLayer);
    const scope = layerScope(selectedLayer);
    const scoped = layers
      .map((layer, index) => ({ layer, index }))
      .filter(({ layer }) => layerScope(layer) === scope)
      .sort(compareScopedLayers);
    const normalized = new Map(scoped.map(({ layer }, index) => [layer.id, index]));
    duplicate.zIndex = scoped.length;
    const next = layers.map((layer) => {
      const zIndex = normalized.get(layer.id);
      return zIndex === undefined || layer.zIndex === zIndex ? layer : { ...layer, zIndex };
    });
    next.push(duplicate);
    commitLayers(next, duplicate.id);
    setSheet(null);
  }, [commitLayers, layers, selectedLayer]);

  const deleteSelected = useCallback(() => {
    if (!selectedLayer || selectedLayer.locked) return;
    recordSnapshot();
    removeLayer(selectedLayer.id);
    setPropertySession(null);
    setSheet(null);
  }, [recordSnapshot, removeLayer, selectedLayer]);

  const toggleSelectedLock = useCallback(() => {
    if (!selectedLayer) return;
    commitLayerPatch(selectedLayer.id, { locked: !selectedLayer.locked });
    setSheet(null);
  }, [commitLayerPatch, selectedLayer]);

  const replaceImage = async () => {
    if (!selectedLayer || selectedLayer.type !== "image" || selectedLayer.locked || replacingImage) return;
    setReplacingImage(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: false,
        quality: 1,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const extension = asset.uri.split(".").pop()?.split("?")[0] || "jpg";
      const record = await uploadFlyer(
        {
          uri: asset.uri,
          name: asset.fileName ?? `replacement-${Date.now()}.${extension}`,
          type: asset.mimeType ?? `image/${extension === "jpg" ? "jpeg" : extension}`,
        },
        configuration,
        activeEvent?.id && /^[a-f\d]{24}$/i.test(activeEvent.id) ? activeEvent.id : undefined,
      );
      commitLayerPatch(selectedLayer.id, { imageUrl: record.image_url });
      showToast("Image replaced in this layer.", { tone: "success" });
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not replace the image.", { tone: "error" });
    } finally {
      setReplacingImage(false);
    }
  };

  const save = async () => {
    if (!activeEvent) return;
    if (!activeEvent.event_date) {
      showToast("Save an event date in Settings before converting the design into an invitation.", { tone: "error", duration: 4200 });
      return;
    }
    if (!layers.some((layer) => layer.visible)) {
      showToast("Add at least one visible design element before converting the invitation.", { tone: "error", duration: 4200 });
      return;
    }
    setSaving(true);
    try {
      const published = await publishEventDesign(activeEvent.id, layers, configuration);
      setActiveEvent(published);
      await markEventPublished(activeEvent.id);
      markSaved();
      showToast("Invitation converted and locked. Guests, Admins, and Analytics are now available.", { tone: "success", duration: 4400 });
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Invitation could not be converted. Check the event date and design, then try again.", { tone: "error", duration: 4400 });
    } finally {
      setSaving(false);
    }
  };

  const confirmReturnToEditor = async () => {
    if (!activeEvent) return;
    setReturningToEditor(true);
    setReturnError("");
    try {
      const draft = await returnEventToEditor(activeEvent.id);
      setActiveEvent(draft);
      await markEventDraft(draft.id);
      setReturnConfirmOpen(false);
      showToast("Editor unlocked. Guests, event admins, and scan history were deleted.", { tone: "success", duration: 4400 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not return this invitation to editor mode. Please try again.";
      setReturnError(message);
      showToast(message, { tone: "error", duration: 4400 });
    } finally {
      setReturningToEditor(false);
    }
  };

  const openAuxiliarySheet = (kind: "inspect" | "more") => {
    setPropertySession(null);
    setStubPropertySession(null);
    setPropertyValid(true);
    setSheet(kind);
  };

  const handleAction = (action: MobileEditorAction) => {
    if (gestureActive || saving || replacingImage) return;
    if (action === "text") return addText();
    if (action === "shape") return addShape();
    if (action === "undo") return undo();
    if (action === "redo") return redo();
    if (action === "preview") {
      closeSheetWithoutCommit();
      setPreviewOpen(true);
      return;
    }
    if (editorMode === "stub") {
      const stubSheets: Partial<Record<MobileEditorAction, StubPropertySheetKind>> = {
        "stub-background": "stub-background",
        "stub-text": "stub-text",
        "stub-accent": "stub-accent",
        "stub-shadow": "stub-shadow",
        "stub-name": "stub-name",
        "stub-font": "stub-font",
        "stub-name-size": "stub-name-size",
        "stub-category": "stub-category",
        "stub-visibility": "stub-details-visibility",
        "stub-icon": "stub-details-icon",
        "stub-frame": "stub-qr-frame",
        "stub-qr-size": "stub-qr-size",
        "stub-position": selectedStubRegion === "guest" ? "stub-guest-position" : selectedStubRegion === "event-details" ? "stub-details-position" : "stub-qr-position",
      };
      if (action === "stub-more") {
        setPropertySession(null);
        setStubPropertySession(null);
        setSheet("stub-more");
        return;
      }
      const nextStubSheet = stubSheets[action];
      if (nextStubSheet) openStubPropertySheet(nextStubSheet);
      return;
    }
    if (action === "replace") return void replaceImage();
    if (action === "forward" || action === "backward") return moveSelected(action);
    if (action === "unlock" && selectedLayer) {
      commitLayerPatch(selectedLayer.id, { locked: false });
      return;
    }
    if (action === "inspect" || action === "more") return openAuxiliarySheet(action);
    if (!selectedLayer || selectedLayer.locked) return;
    const propertySheets: Partial<Record<MobileEditorAction, PropertySheetKind>> = {
      edit: "text",
      colour: "colour",
      size: "size",
      align: "alignment",
      stroke: "stroke",
      "stroke-width": "stroke",
      "shape-properties": "shape",
      corners: "corners",
      opacity: "opacity",
    };
    const nextSheet = propertySheets[action];
    if (nextSheet) openPropertySheet(nextSheet, selectedLayer);
  };

  const fitViewport = () => {
    if (gestureActive || saving || replacingImage) return;
    if (editorMode === "stub") setStubViewport({ x: 0, y: 0, scale: 1 });
    else setDesignViewport({ x: 0, y: 0, scale: 1 });
  };

  const commitGestureGeometry = useCallback((id: string, geometry: LayerGeometry) => {
    const layer = layers.find((candidate) => candidate.id === id);
    if (!layer || layer.locked || ![geometry.x, geometry.y, geometry.width, geometry.height].every(Number.isFinite)) return;
    const patch: Partial<CanvasLayer> = {};
    if (Math.abs(layer.x - geometry.x) > 0.00005) patch.x = geometry.x;
    if (Math.abs(layer.y - geometry.y) > 0.00005) patch.y = geometry.y;
    if (Math.abs(layer.width - geometry.width) > 0.00005) patch.width = geometry.width;
    if (Math.abs(layer.height - geometry.height) > 0.00005) patch.height = geometry.height;
    commitLayerPatch(id, patch);
  }, [commitLayerPatch, layers]);

  const commitStubPosition = useCallback((region: "guest" | "event-details" | "qr", patch: Partial<FlyerConfiguration>) => {
    setSelectedStubRegion(region);
    commitConfigurationPatch(patch);
  }, [commitConfigurationPatch, setSelectedStubRegion]);

  if (activeEvent?.design_status === "published") {
    const availableHeight = Math.max(editorWindow.height - (isLandscape ? 92 : 210), 220);
    const previewWidth = Math.min(editorWindow.width * (isLandscape ? 0.55 : 0.88), availableHeight * 9 / 16, 430);
    return (
      <View style={[styles.staticScreen, { backgroundColor: colors.background }]}>
        <View style={styles.staticCopy}>
          <Text style={[styles.staticTitle, { color: colors.text }]}>Published invitation</Text>
          <Text style={[styles.staticHint, { color: colors.muted }]}>This design is locked and ready for guests.</Text>
        </View>
        <View style={styles.staticPreviewArea}>
          <View style={[styles.staticInvitation, { width: previewWidth }]}>
            <MobileTicketStubRenderer
              layers={layers}
              configuration={configuration}
              event={activeEvent}
              mode="preview"
            />
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setReturnError("");
            setReturnConfirmOpen(true);
          }}
          style={({ pressed }) => [styles.returnButton, pressed && styles.returnButtonPressed]}
        >
          <RotateCcw color="#07110f" size={17} />
          <Text style={styles.returnButtonText}>Return to editor</Text>
        </Pressable>
        <ActionConfirmModal
          visible={returnConfirmOpen}
          title="Return to editor?"
          description={returnError || "This permanently deletes every guest, all event-admin access links, and scan history for this event. The invitation will return to draft mode."}
          confirmLabel="Delete data and edit"
          destructive
          loading={returningToEditor}
          onCancel={() => {
            if (!returningToEditor) setReturnConfirmOpen(false);
          }}
          onConfirm={confirmReturnToEditor}
        />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {!isLandscape ? <View style={[styles.editorHeader, { backgroundColor: colors.panel, borderBottomColor: colors.border }]}>
        <View style={styles.headerCopy}>
          <View style={styles.titleRow}>
            <Text style={[styles.heading, { color: colors.text }]}>{editorMode === "stub" ? "Ticket Stub" : "Design"}</Text>
            {hasUnsavedChanges ? <View style={styles.unsavedDot} /> : null}
          </View>
          <Text style={[styles.hint, { color: colors.muted }]}>{editorMode === "stub" ? "Tap a Stub region, then drag or adjust it" : `${layers.length} layers · tap an element to select`}</Text>
        </View>
        <Pressable style={styles.saveButton} onPress={save} disabled={saving || !activeEvent || gestureActive}>
          {saving ? <ActivityIndicator size="small" color="#07110f" /> : <Save color="#07110f" size={17} />}
          <Text style={styles.saveText}>Convert</Text>
        </Pressable>
      </View> : null}

      {!isLandscape && editorMode === "stub" && uploadedFlyerLayer ? (
        <View style={[styles.flyerReadyBar, { backgroundColor: colors.panel, borderBottomColor: colors.border }]}>
          <View style={styles.flyerReadyCopy}>
            <ImageIcon color="#4fd6be" size={17} />
            <View style={styles.flyerReadyTextWrap}>
              <Text style={[styles.flyerReadyTitle, { color: colors.text }]}>Flyer ready</Text>
              <Text style={[styles.flyerReadyHint, { color: colors.muted }]} numberOfLines={1}>Continue with the ticket stub</Text>
            </View>
          </View>
          <Pressable
            style={[styles.editFlyerButton, { borderColor: colors.border }]}
            onPress={() => {
              selectLayer(uploadedFlyerLayer.id);
              setEditorMode("design");
            }}
          >
            <Text style={styles.editFlyerText}>Edit flyer</Text>
          </Pressable>
        </View>
      ) : null}

      {editorMode === "design" ? <MobileEditorCanvas
        layers={layers}
        configuration={configuration}
        selectedLayerId={selectedLayerId}
        onSelectLayer={selectLayer}
        viewport={designViewport}
        onViewportChange={setDesignViewport}
        onLayerGeometryCommit={commitGestureGeometry}
        onLayerGestureActiveChange={setGestureActive}
        temporaryLayerOverride={temporaryLayerOverride}
        overlayInsets={canvasOverlayInsets}
        showFitButton={!isLandscape}
        interactionBlocked={sheet !== null || previewOpen || saving || replacingImage}
        renderSelectionOverlay={(anchor) => editorMode === "design" && selectedLayer && anchor ? (
          <SelectedLayerBubble
            layer={selectedLayer}
            anchor={anchor}
            light={light}
            disabled={gestureActive || saving || replacingImage || sheet !== null || previewOpen}
            replacingImage={replacingImage}
            onDuplicate={duplicateSelected}
            onDelete={deleteSelected}
            onReplace={() => void replaceImage()}
            onMore={() => openAuxiliarySheet("more")}
          />
        ) : null}
      /> : <MobileStubEditor
        layers={layers}
        configuration={configuration}
        temporaryConfigurationPatch={temporaryConfigurationPatch}
        event={activeEvent}
        selectedRegion={selectedStubRegion}
        onSelectRegion={setSelectedStubRegion}
        viewport={stubViewport}
        onViewportChange={setStubViewport}
        onRegionPositionCommit={commitStubPosition}
        onGestureActiveChange={setGestureActive}
        overlayInsets={canvasOverlayInsets}
        showFitButton={!isLandscape}
        interactionBlocked={sheet !== null || previewOpen || saving || replacingImage}
      />}

      {isLandscape ? (
        <LandscapeTopBar
          eventTitle={activeEvent?.title ?? "Event workspace"}
          dirty={hasUnsavedChanges}
          saving={saving}
          disabled={gestureActive || replacingImage}
          canSave={Boolean(activeEvent)}
          safeTop={insets.top}
          safeLeft={insets.left}
          safeRight={insets.right}
          onBack={leaveWorkspace}
          onFit={fitViewport}
          onPreview={() => setPreviewOpen(true)}
          onSave={() => void save()}
        />
      ) : null}

      <MobileEditorBottomBar
        selectedLayer={selectedLayer}
        onAction={handleAction}
        canUndo={canUndo}
        canRedo={canRedo}
        replacingImage={replacingImage}
        mutationDisabled={gestureActive || saving || replacingImage}
        landscape={isLandscape}
        editorMode={editorMode}
        selectedStubRegion={selectedStubRegion}
        onModeChange={setEditorMode}
      />

      <EditorActionSheet
        visible={sheet !== null}
        title={sheetTitle(sheet)}
        onClose={closeSheet}
        keyboardAware={sheet === "text"}
        landscape={isLandscape}
        onFit={fitViewport}
      >
        {stubPropertySession ? (
          <View key={`${stubPropertySession.region}-${stubPropertySession.sheet}-${stubPropertySession.revision}`}>
            <StubPropertyControls
              kind={stubPropertySession.sheet}
              configuration={workingConfiguration}
              onPatch={updateStubPropertyPatch}
              onValidityChange={setPropertyValid}
            />
            <SheetFooter applyDisabled={!propertyValid} onReset={resetStubPropertySession} onCancel={closeSheetWithoutCommit} onApply={applyPropertySession} />
          </View>
        ) : propertySession && workingLayer ? (
          <View key={`${propertySession.layerId}-${propertySession.sheet}-${propertySession.revision}`}>
            <PropertySessionContent
              kind={propertySession.sheet}
              layer={workingLayer}
              configuration={configuration}
              onPatch={updatePropertyPatch}
              onValidityChange={setPropertyValid}
            />
            <SheetFooter
              applyDisabled={!propertyValid}
              onReset={resetPropertySession}
              onCancel={closeSheetWithoutCommit}
              onApply={applyPropertySession}
            />
          </View>
        ) : (
          sheet === "stub-more" ? <StubMoreSheet
            region={selectedStubRegion}
            onSelectRegion={(region) => { setSelectedStubRegion(region); setSheet(null); }}
            onPreview={() => { setSheet(null); setPreviewOpen(true); }}
          /> : <AuxiliarySheetContent
            kind={sheet}
            layer={selectedLayer}
            onTypography={() => selectedLayer && openPropertySheet("typography", selectedLayer)}
            onDuplicate={duplicateSelected}
            onMove={moveSelected}
            onDelete={deleteSelected}
            onToggleLock={toggleSelectedLock}
            onInspect={() => openAuxiliarySheet("inspect")}
          />
        )}
      </EditorActionSheet>

      <MobileInvitationPreview
        visible={previewOpen}
        onClose={() => setPreviewOpen(false)}
        layers={layers}
        configuration={configuration}
        event={activeEvent}
      />
    </View>
  );
}

function LandscapeTopBar({
  eventTitle,
  dirty,
  saving,
  disabled,
  canSave,
  safeTop,
  safeLeft,
  safeRight,
  onBack,
  onFit,
  onPreview,
  onSave,
}: {
  eventTitle: string;
  dirty: boolean;
  saving: boolean;
  disabled: boolean;
  canSave: boolean;
  safeTop: number;
  safeLeft: number;
  safeRight: number;
  onBack: () => void;
  onFit: () => void;
  onPreview: () => void;
  onSave: () => void;
}) {
  return (
    <View
      onStartShouldSetResponder={() => true}
      style={[
        styles.landscapeTop,
        {
          top: Math.max(safeTop, 6),
          left: Math.max(safeLeft, 8),
          right: Math.max(safeRight, 8),
        },
      ]}
    >
      <LandscapeTopAction label="Back" Icon={ArrowLeft} onPress={onBack} />
      <View style={styles.landscapeTitleWrap}>
        <Text numberOfLines={1} style={styles.landscapeTitle}>{eventTitle}</Text>
        {dirty ? <View accessibilityLabel="Unsaved changes" style={styles.landscapeDirtyDot} /> : null}
      </View>
      <LandscapeTopAction label="Fit" Icon={Maximize2} onPress={onFit} disabled={disabled || saving} />
      <LandscapeTopAction label="Preview" Icon={Eye} onPress={onPreview} disabled={disabled || saving} />
      <LandscapeTopAction
        label={saving ? "Converting" : "Convert"}
        Icon={Save}
        onPress={onSave}
        disabled={disabled || saving || !canSave}
        accent
        loading={saving}
      />
    </View>
  );
}

function LandscapeTopAction({
  label,
  Icon,
  onPress,
  disabled = false,
  accent = false,
  loading = false,
}: {
  label: string;
  Icon: typeof Save;
  onPress: () => void;
  disabled?: boolean;
  accent?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.landscapeTopAction,
        accent && styles.landscapeTopActionAccent,
        pressed && styles.landscapePressed,
        disabled && styles.landscapeDisabled,
      ]}
    >
      {loading
        ? <ActivityIndicator size="small" color="#07110f" />
        : <Icon color={accent ? "#07110f" : "#dce8e5"} size={17} />}
      <Text style={[styles.landscapeTopActionText, accent && styles.landscapeTopActionTextAccent]}>{label}</Text>
    </Pressable>
  );
}

function PropertySessionContent({
  kind,
  layer,
  configuration,
  onPatch,
  onValidityChange,
}: {
  kind: PropertySheetKind;
  layer: CanvasLayer;
  configuration: FlyerConfiguration;
  onPatch: (patch: Partial<CanvasLayer>) => void;
  onValidityChange: (valid: boolean) => void;
}) {
  const [colourValid, setColourValid] = useState(true);
  const [numberValid, setNumberValid] = useState(true);

  useEffect(() => {
    onValidityChange(colourValid && numberValid);
  }, [colourValid, numberValid, onValidityChange]);

  if (kind === "text") {
    return <TextEditControls value={layer.text ?? ""} onChange={(text) => onPatch({ text })} />;
  }
  if (kind === "colour") {
    const property = layer.type === "text" ? "color" : "fill";
    return (
      <ColourControls
        label={layer.type === "text" ? "Text colour" : "Fill colour"}
        value={layer[property]}
        allowTransparent={property === "fill"}
        onChange={(colour) => onPatch({ [property]: colour })}
        onValidityChange={setColourValid}
      />
    );
  }
  if (kind === "size" && layer.type === "text") {
    return (
      <NumberControls
        label="Text size"
        value={layer.fontSize ?? 24}
        minimum={6}
        maximum={240}
        step={2}
        unit="px"
        presets={[12, 18, 24, 36, 48, 72]}
        onChange={(fontSize) => onPatch({ fontSize })}
        onValidityChange={setNumberValid}
      />
    );
  }
  if (kind === "size" && layer.type === "qr") {
    const ratio = configuration.image_width / Math.max(configuration.image_height, 1);
    return (
      <NumberControls
        label="QR size"
        value={layer.width}
        minimum={8}
        maximum={80}
        step={2}
        unit="%"
        presets={[12, 18, 24, 32, 40]}
        onChange={(width) => onPatch({ width, height: width * ratio })}
        onValidityChange={setNumberValid}
      />
    );
  }
  if (kind === "alignment") {
    return <AlignmentControls value={layer.textAlign ?? "center"} onChange={(textAlign) => onPatch({ textAlign })} />;
  }
  if (kind === "typography") {
    return (
      <View style={styles.controlSections}>
        <TypographyControls layer={layer} onChange={onPatch} />
        <NumberControls
          label="Opacity"
          value={(layer.opacity ?? 1) * 100}
          minimum={0}
          maximum={100}
          step={5}
          unit="%"
          presets={[25, 50, 75, 100]}
          onChange={(opacity) => onPatch({ opacity: opacity / 100 })}
          onValidityChange={setNumberValid}
        />
      </View>
    );
  }
  if (kind === "shape" && (layer.type === "rect" || layer.type === "ellipse")) {
    return <ShapeControls value={layer.type} onChange={(type) => onPatch({ type })} />;
  }
  if (kind === "stroke") {
    return (
      <View style={styles.controlSections}>
        <ColourControls
          label="Stroke colour"
          value={layer.stroke}
          allowTransparent
          onChange={(stroke) => onPatch({ stroke })}
          onValidityChange={setColourValid}
        />
        <NumberControls
          label="Stroke width"
          value={layer.strokeWidth ?? 0}
          minimum={0}
          maximum={40}
          step={1}
          unit="px"
          presets={[0, 1, 2, 4, 8]}
          onChange={(strokeWidth) => onPatch({ strokeWidth })}
          onValidityChange={setNumberValid}
        />
      </View>
    );
  }
  if (kind === "corners") {
    return (
      <NumberControls
        label="Corner radius"
        value={layer.borderRadius ?? 0}
        minimum={0}
        maximum={100}
        step={2}
        unit="px"
        presets={[0, 8, 16, 28, 50, 100]}
        onChange={(borderRadius) => onPatch({ borderRadius })}
        onValidityChange={setNumberValid}
      />
    );
  }
  if (kind === "opacity") {
    return (
      <NumberControls
        label="Opacity"
        value={(layer.opacity ?? 1) * 100}
        minimum={0}
        maximum={100}
        step={5}
        unit="%"
        presets={[0, 25, 50, 75, 100]}
        onChange={(opacity) => onPatch({ opacity: opacity / 100 })}
        onValidityChange={setNumberValid}
      />
    );
  }
  return <Text style={styles.sheetHint}>This property is not available for the selected layer.</Text>;
}

function AuxiliarySheetContent({
  kind,
  layer,
  onTypography,
  onDuplicate,
  onMove,
  onDelete,
  onToggleLock,
  onInspect,
}: {
  kind: SheetKind | null;
  layer: CanvasLayer | null;
  onTypography: () => void;
  onDuplicate: () => void;
  onMove: (direction: OrderDirection) => void;
  onDelete: () => void;
  onToggleLock: () => void;
  onInspect: () => void;
}) {
  const { resolvedMode } = useThemeMode();
  const light = resolvedMode === "light";
  const palette = light
    ? { text: "#10211d", muted: "#657772", border: "#cfe0dc", surface: "#f4f8f6", dangerSurface: "#fff0f1", dangerBorder: "#efc1c5" }
    : { text: "#f5f8f7", muted: "#9bb0aa", border: "#24483f", surface: "#17332c", dangerSurface: "#39191c", dangerBorder: "#8d353b" };
  if (!kind || !layer) return <Text style={[styles.sheetHint, { color: palette.muted }]}>Select a layer to inspect its properties.</Text>;
  if (kind === "inspect") {
    return (
      <View style={styles.inspector}>
        <Text style={[styles.inspectorTitle, { color: palette.text }]}>{layer.name ?? `${layer.type} layer`}</Text>
        <Text style={[styles.sheetHint, { color: palette.muted }]}>Type: {layer.type}{layer.type === "path" ? layer.closed ? " (closed)" : " (open)" : ""}</Text>
        <Text style={[styles.sheetHint, { color: palette.muted }]}>Bounds: {layer.x.toFixed(1)}%, {layer.y.toFixed(1)}% · {layer.width.toFixed(1)}% × {layer.height.toFixed(1)}%</Text>
        <Text style={[styles.sheetHint, { color: palette.muted }]}>Rotation: {layer.rotation ?? 0}° · Opacity: {Math.round((layer.opacity ?? 1) * 100)}%</Text>
        <Text style={[styles.sheetHint, { color: palette.muted }]}>Order: {layer.zIndex} · {layer.locked ? "Locked" : "Unlocked"}</Text>
      </View>
    );
  }
  if (kind !== "more") return null;
  if (layer.locked) {
    return (
      <View style={styles.actionSheetContent}>
        <View style={styles.iconActionGrid}>
          <LayerActionIcon label="Unlock layer" Icon={Unlock} onPress={onToggleLock} palette={palette} />
          <LayerActionIcon label="Inspect layer" Icon={Info} onPress={onInspect} palette={palette} />
        </View>
        <Text style={[styles.sheetHint, { color: palette.muted }]}>Unlock this layer to edit, reorder, duplicate, or delete it.</Text>
      </View>
    );
  }
  return (
    <View style={styles.actionSheetContent}>
      <View style={styles.iconActionGrid}>
        {layer.type === "text" ? <LayerActionIcon label="Typography and opacity" Icon={Type} onPress={onTypography} palette={palette} /> : null}
        <LayerActionIcon label="Duplicate layer" Icon={CopyPlus} onPress={onDuplicate} palette={palette} />
        <LayerActionIcon label="Bring layer forward" Icon={ArrowUp} onPress={() => onMove("forward")} palette={palette} />
        <LayerActionIcon label="Send layer backward" Icon={ArrowDown} onPress={() => onMove("backward")} palette={palette} />
        <LayerActionIcon label="Bring layer to front" Icon={ArrowUp} onPress={() => onMove("front")} palette={palette} />
        <LayerActionIcon label="Send layer to back" Icon={ArrowDown} onPress={() => onMove("back")} palette={palette} />
        <LayerActionIcon label="Lock layer" Icon={Lock} onPress={onToggleLock} palette={palette} />
        <LayerActionIcon label="Inspect layer" Icon={Info} onPress={onInspect} palette={palette} />
        <LayerActionIcon label="Delete layer" Icon={Trash2} onPress={onDelete} palette={palette} danger />
      </View>
    </View>
  );
}

function LayerActionIcon({
  label,
  Icon,
  onPress,
  palette,
  danger = false,
}: {
  label: string;
  Icon: typeof ArrowLeft;
  onPress: () => void;
  palette: { text: string; muted: string; border: string; surface: string; dangerSurface: string; dangerBorder: string };
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Layer action"
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconAction,
        { backgroundColor: danger ? palette.dangerSurface : palette.surface, borderColor: danger ? palette.dangerBorder : palette.border },
        pressed && styles.iconActionPressed,
      ]}
    >
      <Icon color={danger ? "#d95962" : palette.text} size={21} strokeWidth={2.1} />
    </Pressable>
  );
}

function StubMoreSheet({
  region,
  onSelectRegion,
  onPreview,
}: {
  region: StubRegion;
  onSelectRegion: (region: StubRegion) => void;
  onPreview: () => void;
}) {
  return (
    <View style={styles.buttonColumn}>
      <Text style={styles.sheetHint}>Selected region: {region === "event-details" ? "Event details" : region === "qr" ? "Secure QR" : region === "guest" ? "Guest" : "Background"}</Text>
      <SheetButton label="Background controls" onPress={() => onSelectRegion("background")} />
      <SheetButton label="Guest controls" onPress={() => onSelectRegion("guest")} />
      <SheetButton label="Event-detail controls" onPress={() => onSelectRegion("event-details")} />
      <SheetButton label="Secure QR controls" onPress={() => onSelectRegion("qr")} />
      <SheetButton label="Open read-only Preview" onPress={onPreview} primary />
      <Text style={styles.sheetHint}>Ticket Stub content remains structured FlyerConfiguration data. It is never converted into design layers.</Text>
    </View>
  );
}

function initialPropertyPatch(kind: PropertySheetKind, layer: CanvasLayer): Partial<CanvasLayer> {
  if (kind === "text") return { text: layer.text };
  if (kind === "colour") return layer.type === "text" ? { color: layer.color } : { fill: layer.fill };
  if (kind === "size") return layer.type === "text"
    ? { fontSize: layer.fontSize }
    : { width: layer.width, height: layer.height };
  if (kind === "alignment") return { textAlign: layer.textAlign };
  if (kind === "typography") return {
    fontFamily: layer.fontFamily,
    fontWeight: layer.fontWeight,
    fontStyle: layer.fontStyle,
    opacity: layer.opacity,
  };
  if (kind === "shape") return { type: layer.type };
  if (kind === "stroke") return { stroke: layer.stroke, strokeWidth: layer.strokeWidth };
  if (kind === "corners") return { borderRadius: layer.borderRadius };
  return { opacity: layer.opacity };
}

function reorderLayers(layers: CanvasLayer[], selectedId: string, direction: OrderDirection) {
  const selected = layers.find((layer) => layer.id === selectedId);
  if (!selected) return null;
  const scope = layerScope(selected);
  const scoped = layers
    .map((layer, index) => ({ layer, index }))
    .filter(({ layer }) => layerScope(layer) === scope)
    .sort(compareScopedLayers);
  const currentIndex = scoped.findIndex(({ layer }) => layer.id === selectedId);
  if (currentIndex < 0) return null;
  const targetIndex = direction === "front"
    ? scoped.length - 1
    : direction === "back"
      ? 0
      : currentIndex + (direction === "forward" ? 1 : -1);
  if (targetIndex < 0 || targetIndex >= scoped.length || targetIndex === currentIndex) return null;
  const reordered = [...scoped];
  const [moving] = reordered.splice(currentIndex, 1);
  reordered.splice(targetIndex, 0, moving);
  const normalized = new Map(reordered.map(({ layer }, index) => [layer.id, index]));
  return layers.map((layer) => {
    const zIndex = normalized.get(layer.id);
    return zIndex === undefined || layer.zIndex === zIndex ? layer : { ...layer, zIndex };
  });
}

function compareScopedLayers(
  first: { layer: CanvasLayer; index: number },
  second: { layer: CanvasLayer; index: number },
) {
  return first.layer.zIndex - second.layer.zIndex || first.index - second.index;
}

function layerScope(layer: CanvasLayer) {
  return !layer.parentId || layer.parentId === "main-frame" ? "main-frame" : layer.parentId;
}

function duplicateLayer(layer: CanvasLayer): CanvasLayer {
  const id = createEditorId("layer");
  return {
    ...cloneCanvasLayers([layer])[0],
    id,
    x: Math.min(layer.x + 2, 99),
    y: Math.min(layer.y + 2, 99),
    name: layer.name ? `${layer.name} copy` : undefined,
    nodes: layer.nodes?.map((node) => ({
      ...node,
      id: createEditorId("node"),
      handleIn: node.handleIn ? { ...node.handleIn } : undefined,
      handleOut: node.handleOut ? { ...node.handleOut } : undefined,
    })),
  };
}

function createEditorId(prefix: "layer" | "node") {
  return `mobile-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function nextZIndex(layers: CanvasLayer[], parentId: string | null | undefined) {
  const scope = !parentId || parentId === "main-frame" ? "main-frame" : parentId;
  return Math.max(...layers.filter((layer) => layerScope(layer) === scope).map((layer) => layer.zIndex), -1) + 1;
}

function sheetTitle(sheet: SheetKind | null) {
  const titles: Record<SheetKind, string> = {
    text: "Edit text",
    colour: "Colour",
    size: "Size",
    alignment: "Alignment",
    typography: "Typography",
    shape: "Shape",
    stroke: "Stroke",
    corners: "Corners",
    opacity: "Opacity",
    inspect: "Layer details",
    more: "Layer actions",
    "stub-more": "Ticket Stub regions",
    "stub-background": "Stub background",
    "stub-text": "Stub text colour",
    "stub-accent": "Stub accent colour",
    "stub-shadow": "Curve shadow",
    "stub-name": "Guest name",
    "stub-font": "Guest typography",
    "stub-name-size": "Guest-name size",
    "stub-guest-position": "Guest position",
    "stub-category": "Guest category",
    "stub-details-visibility": "Event details",
    "stub-details-icon": "Detail icons",
    "stub-details-position": "Details position",
    "stub-qr-frame": "Secure QR frame",
    "stub-qr-size": "Secure QR size",
    "stub-qr-position": "Secure QR position",
  };
  return sheet ? titles[sheet] : "Layer actions";
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  staticScreen: { flex: 1, alignItems: "center", paddingHorizontal: 18, paddingTop: 14, paddingBottom: 16 },
  staticCopy: { alignItems: "center" },
  staticTitle: { fontSize: 18, fontWeight: "800" },
  staticHint: { marginTop: 4, fontSize: 11 },
  staticPreviewArea: { flex: 1, width: "100%", alignItems: "center", justifyContent: "center", paddingVertical: 10 },
  staticInvitation: { aspectRatio: 9 / 16, overflow: "hidden", backgroundColor: "#ffffff", elevation: 10, shadowColor: "#000000", shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  returnButton: { minWidth: 190, minHeight: 46, paddingHorizontal: 20, borderRadius: 23, backgroundColor: "#4fd6be", flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  returnButtonPressed: { opacity: 0.72 },
  returnButtonText: { color: "#07110f", fontSize: 12, fontWeight: "800" },
  editorHeader: { minHeight: 58, paddingHorizontal: 15, borderBottomWidth: 1, flexDirection: "row", alignItems: "center" },
  headerCopy: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  heading: { fontSize: 18, fontWeight: "800" },
  hint: { marginTop: 2, fontSize: 10 },
  unsavedDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#f59e0b" },
  saveButton: { minWidth: 78, height: 42, paddingHorizontal: 13, borderRadius: 21, backgroundColor: "#4fd6be", flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center" },
  saveText: { color: "#07110f", fontSize: 11, fontWeight: "800" },
  flyerReadyBar: { minHeight: 52, paddingHorizontal: 15, borderBottomWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  flyerReadyCopy: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 9 },
  flyerReadyTextWrap: { flex: 1, minWidth: 0 },
  flyerReadyTitle: { fontSize: 11, fontWeight: "800" },
  flyerReadyHint: { marginTop: 1, fontSize: 9 },
  editFlyerButton: { minHeight: 34, paddingHorizontal: 13, borderRadius: 17, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  editFlyerText: { color: "#4fd6be", fontSize: 10, fontWeight: "800" },
  sheetHint: { color: "#9bb0aa", fontSize: 12, lineHeight: 18 },
  controlSections: { gap: 22 },
  buttonColumn: { gap: 9 },
  actionSheetContent: { gap: 16 },
  iconActionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  iconAction: { width: 54, height: 54, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  iconActionPressed: { opacity: 0.68, transform: [{ scale: 0.96 }] },
  inspector: { gap: 7 },
  inspectorTitle: { color: "#f5f8f7", fontSize: 15, fontWeight: "800" },
  dangerZone: { marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#4b292c" },
  landscapeTop: { position: "absolute", minHeight: 50, paddingHorizontal: 4, borderRadius: 17, borderWidth: 1, borderColor: "#285046", backgroundColor: "rgba(8,21,18,0.96)", flexDirection: "row", alignItems: "center", zIndex: 3000, elevation: 12, overflow: "hidden" },
  landscapeTitleWrap: { flex: 1, minWidth: 72, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", gap: 7 },
  landscapeTitle: { flexShrink: 1, color: "#f5f8f7", fontSize: 12, fontWeight: "800" },
  landscapeDirtyDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#f59e0b" },
  landscapeTopAction: { minWidth: 52, minHeight: 44, paddingHorizontal: 7, borderRadius: 13, flexDirection: "row", gap: 4, alignItems: "center", justifyContent: "center" },
  landscapeTopActionAccent: { backgroundColor: "#4fd6be" },
  landscapeTopActionText: { color: "#dce8e5", fontSize: 9, fontWeight: "800" },
  landscapeTopActionTextAccent: { color: "#07110f" },
  landscapePressed: { opacity: 0.66 },
  landscapeDisabled: { opacity: 0.38 },
});
