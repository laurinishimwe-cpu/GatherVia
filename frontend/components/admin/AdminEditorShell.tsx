"use client";

import { useState } from "react";

import type {
  EditorMode,
  StubEditorRegion,
} from "@/components/editor/editor-types";
import {
  EditorRail,
} from "@/components/editor/EditorRail";
import { EditorInspector } from "@/components/editor/EditorInspector";
import { WorkspaceSecondaryLeftSidebar } from "@/components/workspace/WorkspaceSecondaryLeftSidebar";
import { DesignToolbar } from "@/components/workspace/flyer/DesignToolbar";
import { EditorCanvas } from "@/components/workspace/flyer/EditorCanvas";
import { MobileFinishedView } from "@/components/workspace/flyer/MobileFinishedView";
import { StubEditorCanvas } from "@/components/editor/StubEditorCanvas";
import { useFlyerDraft } from "@/context/FlyerDraftContext";

interface AdminEditorShellProps {
  templateTitle: string;
  categoryLabel: string;
  isSaving: boolean;
  saveDisabled: boolean;
  hasUnsavedChanges: boolean;
  onBack: () => void;
  onSave: () => void;
}

export function AdminEditorShell({
  templateTitle,
  categoryLabel,
  isSaving,
  saveDisabled,
  hasUnsavedChanges,
  onBack,
  onSave,
}: AdminEditorShellProps) {
  const {
    draft,
    selectLayer,
    setStubPreviewMode,
  } = useFlyerDraft();

  const [
    layersPanelOpen,
    setLayersPanelOpen,
  ] = useState(true);

  const [
    editorMode,
    setEditorMode,
  ] = useState<EditorMode>("design");

  const [
    selectedStubRegion,
    setSelectedStubRegion,
  ] = useState<StubEditorRegion>(
    "background",
  );

  if (draft.stubPreviewMode) {
    return (
      <MobileFinishedView
        onReturnToEdit={() => {
          setStubPreviewMode(false);
        }}
        onSave={onSave}
        isSaving={isSaving}
        saveDisabled={saveDisabled}
      />
    );
  }

  const showCanvasSettings = () => {
    selectLayer(null);
    setLayersPanelOpen(false);
  };

  const showDesignMode = () => {
    setEditorMode("design");
  };

  const showStubMode = () => {
    selectLayer(null);
    setEditorMode("stub");
  };

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-foreground/[0.025]">
      <EditorRail
        editorMode={editorMode}
        layersPanelOpen={
          layersPanelOpen
        }
        canvasSettingsActive={
          !layersPanelOpen &&
          draft.selectedLayerId ===
            null
        }
        previewDisabled={
          !draft.configuration
        }
        saveDisabled={
          saveDisabled
        }
        isSaving={isSaving}
        hasUnsavedChanges={
          hasUnsavedChanges
        }
        onBack={onBack}
        onShowDesign={showDesignMode}
        onShowStub={showStubMode}
        onToggleLayersPanel={() => {
          setLayersPanelOpen(
            (current) => !current,
          );
        }}
        onShowCanvasSettings={
          showCanvasSettings
        }
        onPreview={() => {
          setStubPreviewMode(true);
        }}
        onSave={onSave}
      />

      {editorMode === "design" &&
      layersPanelOpen ? (
        <WorkspaceSecondaryLeftSidebar
          onClose={() => {
            setLayersPanelOpen(false);
          }}
        />
      ) : null}

      <main className="relative min-w-0 flex-1 overflow-hidden bg-foreground/[0.035]">
        <div className="pointer-events-none absolute left-4 top-4 z-20 max-w-[min(320px,calc(100%-2rem))] rounded-2xl border border-brand-400/10 bg-background/90 px-3.5 py-2.5 shadow-lg backdrop-blur-md">
          <p
            title={templateTitle}
            className="truncate text-xs font-semibold"
          >
            {templateTitle}
          </p>

          <div className="mt-1 flex items-center gap-2">
            <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-brand-400">
              {categoryLabel}
            </span>

            <span
              aria-hidden="true"
              className="h-1 w-1 rounded-full bg-foreground/25"
            />

            <span className="text-[10px] text-foreground/45">
              {isSaving
                ? "Saving…"
                : hasUnsavedChanges
                  ? "Unsaved changes"
                  : "Ready"}
            </span>
          </div>
        </div>

        {editorMode === "design" ? (
          <>
            <EditorCanvas />
            <DesignToolbar />
          </>
        ) : (
          <StubEditorCanvas />
        )}
      </main>

      <EditorInspector
        editorMode={editorMode}
        selectedStubRegion={selectedStubRegion}
        onSelectStubRegion={setSelectedStubRegion}
      />
    </div>
  );
}
