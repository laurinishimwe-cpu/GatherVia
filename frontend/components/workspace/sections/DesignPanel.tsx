"use client";

import { useRef } from "react";
import { useFlyerDraft } from "@/context/FlyerDraftContext";
import { EditorCanvas } from "@/components/workspace/flyer/EditorCanvas";
import { DesignToolbar } from "@/components/workspace/flyer/DesignToolbar";
import { MobileFinishedView } from "@/components/workspace/flyer/MobileFinishedView";
import { StubEditorCanvas } from "@/components/editor/StubEditorCanvas";
import type { EditorMode } from "@/components/editor/editor-types";
import { useEventContext } from "@/context/EventContext";
import { getEditorViewportBackgroundStyle } from "@/components/editor/editor-viewport";

interface DesignPanelProps {
  editorMode: EditorMode;
}

export function DesignPanel({ editorMode }: DesignPanelProps) {
  const {
    draft,
    previewGuest,
    setStubPreviewMode,
  } = useFlyerDraft();
  const { activeEvent } = useEventContext();
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchMove = (e: React.TouchEvent) => {
    if (containerRef.current && containerRef.current.contains(e.target as Node)) {
      e.preventDefault();
    }
  };

  if (!draft.configuration) {
    return (
      <div
        className="flex h-full items-center justify-center bg-foreground/[0.035] text-xs text-foreground/50"
        style={getEditorViewportBackgroundStyle({ x: 0, y: 0, scale: 1 })}
      >
        Upload or choose a template to get started
      </div>
    );
  }

  if (draft.stubPreviewMode) {
    return (
      <MobileFinishedView
        onReturnToEdit={() => {
          setStubPreviewMode(false);
        }}
      />
    );
  }

  if (editorMode === "stub") {
    return (
      <StubEditorCanvas
        previewData={{
          guestName: previewGuest?.name,
          guestCategory:
            previewGuest?.category ??
            activeEvent?.configuration.invitation_categories?.[0],
          eventDate: activeEvent?.event_date ?? null,
          eventTime: activeEvent?.event_time ?? null,
          eventLocation: activeEvent?.event_location ?? null,
          qrValue:
            previewGuest?.qrHash ??
            `workspace-stub-${activeEvent?.id ?? "draft"}`,
        }}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full touch-none"
      style={{ touchAction: "none" }}
      onTouchMove={handleTouchMove}
    >
      <EditorCanvas />
      <DesignToolbar />
    </div>
  );
}
