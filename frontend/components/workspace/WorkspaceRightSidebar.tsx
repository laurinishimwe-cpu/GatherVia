"use client";

import { useState } from "react";
import { FlyerUploadZone } from "@/components/workspace/flyer/FlyerUploadZone";
import { FlyerTemplatePicker } from "@/components/workspace/flyer/FlyerTemplatePicker";
import { FlyerStylePanel } from "@/components/workspace/flyer/FlyerStylePanel";
import { LayerPropertiesPanel } from "@/components/workspace/flyer/LayerPropertiesPanel";
import { VectorPropertiesPanel } from "@/components/editor/VectorPropertiesPanel";
import { EditorModeSwitcher } from "@/components/editor/EditorModeSwitcher";
import { StubPropertiesPanel } from "@/components/editor/StubPropertiesPanel";
import { UnsavedWorkModal } from "./flyer/UnsavedWorkModal";
import { useEventContext } from "@/context/EventContext";
import { useFlyerDraft } from "@/context/FlyerDraftContext";
import type { EventType } from "@/lib/types/event";
import type {
  EditorMode,
  StubEditorRegion,
} from "@/components/editor/editor-types";
import { useVectorEdit } from "@/context/VectorEditContext";

interface WorkspaceRightSidebarProps {
  editorMode: EditorMode;
  selectedStubRegion: StubEditorRegion;
  onSelectStubRegion: (region: StubEditorRegion) => void;
  onShowDesign: () => void;
  onShowStub: () => void;
}

export function WorkspaceRightSidebar({
  editorMode,
  selectedStubRegion,
  onSelectStubRegion,
  onShowDesign,
  onShowStub,
}: WorkspaceRightSidebarProps) {
  const { activeEvent } = useEventContext();
  const { draft, clearFlyerDraft, setStubPreviewMode } = useFlyerDraft();
  const { session: vectorSession } = useVectorEdit();
  
  // ── State for the confirmation modal ──
  const [showChangeModal, setShowChangeModal] = useState(false);

  const eventType = (activeEvent?.event_type ?? "other") as EventType;
  const hasLayerSelected = draft.selectedLayerId !== null;
  const isStubMode = editorMode === "stub";

  // ── Handler to clear flyer and close modal ──
  const handleConfirmChange = () => {
    clearFlyerDraft();
    onShowDesign();
    setShowChangeModal(false);
  };

  return (
    <aside className="w-80 border-l border-brand-400/10 bg-background flex flex-col h-full">
      {/* ---- Header ---- */}
      <div className="shrink-0 space-y-3 border-b border-brand-400/10 px-4 pb-3 pt-4">
        <EditorModeSwitcher
          mode={editorMode}
          stubDisabled={!draft.configuration}
          onChange={(mode) => {
            if (mode === "stub") {
              onShowStub();
              return;
            }
            onShowDesign();
          }}
        />

        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">
            {isStubMode
              ? "Ticket stub"
              : vectorSession
              ? "Vector path"
              : hasLayerSelected
              ? "Properties"
              : "Design tools"}
          </h3>

          {draft.configuration && !hasLayerSelected && !isStubMode && (
            <button
              onClick={() => setShowChangeModal(true)}
              className="text-xs text-foreground/60 hover:text-foreground transition"
            >
              Change flyer
            </button>
          )}
          {hasLayerSelected && !vectorSession && !isStubMode && (
            <span className="text-xs text-foreground/50">Layer selected</span>
          )}
        </div>
      </div>

      {/* ---- Scrollable content ---- */}
      <div className="flex-1 overflow-y-auto scrollbar-custom p-4 space-y-5">
        {isStubMode && draft.configuration ? (
          <StubPropertiesPanel
            selectedRegion={selectedStubRegion}
            onSelectRegion={onSelectStubRegion}
          />
        ) : vectorSession ? (
          <VectorPropertiesPanel />
        ) : hasLayerSelected ? (
          <LayerPropertiesPanel />
        ) : !draft.configuration ? (
          <>
            <FlyerUploadZone />
            <FlyerTemplatePicker eventType={eventType} />
          </>
        ) : (
          <FlyerStylePanel />
        )}
      </div>

      {draft.configuration && !vectorSession && (isStubMode || !hasLayerSelected) && (
        <div className="shrink-0 border-t border-brand-400/10 p-4">
          <button
            onClick={() => setStubPreviewMode(true)}
            className="w-full rounded-full bg-brand-400 py-2.5 text-sm font-semibold text-black transition hover:shadow-[0_8px_20px_rgba(79,214,190,0.3)]"
          >
            Preview invitation
          </button>
        </div>
      )}

      {/* ---- Modals ---- */}
      <UnsavedWorkModal
        open={showChangeModal}
        onStay={() => setShowChangeModal(false)}
        onLeave={handleConfirmChange}
      />
    </aside>
  );
}
