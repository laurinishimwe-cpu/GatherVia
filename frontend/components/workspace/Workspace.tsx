"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { WorkspaceLeftSidebar } from "./WorkspaceLeftSidebar";
import { WorkspaceSecondaryLeftSidebar } from "./WorkspaceSecondaryLeftSidebar";
import { CenterCanvas } from "./CenterCanvas";
import { WorkspaceRightSidebar } from "./WorkspaceRightSidebar";
import { ConvertConfirmModal } from "./flyer/ConvertConfirmModal";
import { EditWarningModal } from "./flyer/EditWarningModal";
import { UnsavedWorkModal } from "./flyer/UnsavedWorkModal";
import { useFlyerDraft } from "@/context/FlyerDraftContext";
import { useEventContext } from "@/context/EventContext";         
import { handler } from "@/lib/api/api";
import { useToast } from "@/components/providers/ToastProvider";
import { prefetchEventGuests } from "@/lib/api/guests";
import { prefetchWorkspacePlanData } from "@/lib/api/plans";
import type {
  EditorMode,
  StubEditorRegion,
} from "@/components/editor/editor-types";

export type WorkspaceSection = "design" | "settings" | "guests" | "admins" | "analytics";

export function Workspace() {
  const router = useRouter();
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState<WorkspaceSection>("design");
  const [layersPanelOpen, setLayersPanelOpen] = useState(true);
  const [editorMode, setEditorMode] = useState<EditorMode>("design");
  const [selectedStubRegion, setSelectedStubRegion] =
    useState<StubEditorRegion>("background");
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [showEditWarningModal, setShowEditWarningModal] = useState(false);

  const {
    draft,
    lockDesign,
    selectLayer,
    unlockDesign,
    unsavedWork,
  } = useFlyerDraft();
  const { activeEvent } = useEventContext();                       
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const pendingNavigation = useRef<string | WorkspaceSection | null>(null);

  const designLocked = draft.designLocked;
  const stubPreviewMode = draft.stubPreviewMode;
  const selectedLayerId = draft.selectedLayerId;

  useEffect(() => {
    if (!activeEvent?.id || !/^[a-f\d]{24}$/i.test(activeEvent.id)) return;
    const canLoadGuestData = designLocked;
    prefetchWorkspacePlanData(activeEvent.id, canLoadGuestData);
    if (canLoadGuestData) prefetchEventGuests(activeEvent.id);
  }, [activeEvent?.id, designLocked]);

  // ── Prevent browser zoom outside the canvas / mobile preview ──
  const workspaceRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = workspaceRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        const target = e.target as HTMLElement;
        if (!target.closest(".canvas-area") && !target.closest(".mobile-preview")) {
          e.preventDefault();
        }
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, []);

  // ── Section change handler (Internal navigation - no unsaved check) ──
  const handleSectionChange = (section: WorkspaceSection) => {
    const requiresCompletedSetup = section === "guests" || section === "admins" || section === "analytics";
    if (requiresCompletedSetup && !activeEvent?.event_date) {
      toast("Complete and save the event settings first. An event date is required.", "info");
      setActiveSection("settings");
      return;
    }
    if (requiresCompletedSetup && !designLocked) {
      toast("Convert and save the invitation design before opening this panel.", "info");
      setActiveSection("design");
      return;
    }
    if (section !== activeSection) {
      setLayersPanelOpen(section === "design");
      setActiveSection(section);
    }
  };

  // ── Back to dashboard handler (External navigation - check for unsaved work) ──
  const handleBackToDashboard = () => {
    if (unsavedWork) {
      pendingNavigation.current = "/dashboard";
      setShowUnsavedModal(true);
    } else {
      router.push("/dashboard");
    }
  };

  // ── Confirm leave (discard unsaved changes and go to dashboard) ──
  const confirmLeave = () => {
    setShowUnsavedModal(false);
    
    if (pendingNavigation.current === "/dashboard") {
      router.push("/dashboard");
    }
    
    pendingNavigation.current = null;
  };

  // ── Cancel leave (stay in workspace) ──
  const cancelLeave = () => {
    setShowUnsavedModal(false);
    pendingNavigation.current = null;
  };

  // ── Helpers ──
  const handleConvertConfirm = async () => {
    if (isConverting) return;
    setIsConverting(true);
    try {
      await lockDesign();
      setShowConvertModal(false);
    } finally {
      setIsConverting(false);
    }
  };

  const showDesignMode = () => {
    setEditorMode("design");
  };

  const showStubMode = () => {
    if (!draft.configuration) return;
    selectLayer(null);
    setEditorMode("stub");
  };
  
  // UPDATED: calls reset-guest-data endpoint before unlocking
  const handleEditConfirm = async () => {
    if (!activeEvent?.id) return;

    try {
      await handler(`/api/v1/events/${activeEvent.id}/reset-guest-data`, {
        method: "POST",
      });
    } catch (err) {
      console.error("Failed to reset guest data", err);
    }

    unlockDesign();
    setLayersPanelOpen(true);
    setActiveSection("design");
    setShowEditWarningModal(false);
  };

  const effectiveLayersPanelOpen =
    layersPanelOpen || Boolean(selectedLayerId);
  const leftCollapsed =
    activeSection === "design" && !designLocked
      ? effectiveLayersPanelOpen
      : false;
  const showSecondary =
    activeSection === "design" &&
    !designLocked &&
    !stubPreviewMode &&
    editorMode === "design" &&
    effectiveLayersPanelOpen;
  const showRight =
    activeSection === "design" &&
    !designLocked &&
    !stubPreviewMode;

  return (
    <div ref={workspaceRef} className="flex h-full overflow-hidden">
      <WorkspaceLeftSidebar
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        collapsed={leftCollapsed}
        onToggleLayersPanel={() => {
          if (effectiveLayersPanelOpen) {
            selectLayer(null);
            setLayersPanelOpen(false);
            return;
          }
          setLayersPanelOpen(true);
        }}
        onEditDesign={() => setShowEditWarningModal(true)}
        onBackToDashboard={handleBackToDashboard}
      />

      {showSecondary && (
        <WorkspaceSecondaryLeftSidebar
          onClose={() => {
            selectLayer(null);
            setLayersPanelOpen(false);
          }}
        />
      )}

      <CenterCanvas
        activeSection={activeSection}
        editorMode={editorMode}
      />

      {showRight && (
        <WorkspaceRightSidebar
          editorMode={editorMode}
          selectedStubRegion={selectedStubRegion}
          onSelectStubRegion={setSelectedStubRegion}
          onShowDesign={showDesignMode}
          onShowStub={showStubMode}
        />
      )}

      {/* ── Modals ── */}
      <ConvertConfirmModal
        open={showConvertModal}
        isConverting={isConverting}
        onConfirm={handleConvertConfirm}
        onCancel={() => {
          if (!isConverting) setShowConvertModal(false);
        }}
      />
      <EditWarningModal
        open={showEditWarningModal}
        onConfirm={handleEditConfirm}
        onCancel={() => setShowEditWarningModal(false)}
      />
      <UnsavedWorkModal
        open={showUnsavedModal}
        onStay={cancelLeave}
        onLeave={confirmLeave}
      />
    </div>
  );
}
