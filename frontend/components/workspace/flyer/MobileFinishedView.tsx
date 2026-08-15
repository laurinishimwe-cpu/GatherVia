"use client";

import { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import { useFlyerDraft } from "@/context/FlyerDraftContext";
import { useEventContext } from "@/context/EventContext";
import { ConvertConfirmModal } from "./ConvertConfirmModal";
import { EditWarningModal } from "./EditWarningModal";
import { MobileFrame } from "./MobileFrame";
import { OriginalFlyer } from "./OriginalFlyer";
import {
  clampViewportScale,
  getEditorViewportBackgroundStyle,
  getWheelDeltaInPixels,
  TRACKPAD_ZOOM_SENSITIVITY,
} from "@/components/editor/editor-viewport";
import {
  SECURE_QR_BACKGROUND_COLOR,
  SECURE_QR_FOREGROUND_COLOR,
} from "@/lib/invitation/originalFlyerLayout";

interface MobileFinishedViewProps {
  onReturnToEdit: () => void;
  onSave?: () => void;
  isSaving?: boolean;
  saveDisabled?: boolean;
  guestName?: string;
  guestCategory?: string;
  qrHash?: string;
}

export function MobileFinishedView({
  onReturnToEdit,
  onSave,
  isSaving = false,
  saveDisabled = false,
  guestName,
  guestCategory,
  qrHash,
}: MobileFinishedViewProps) {
  const { draft, previewGuest, lockDesign, unlockDesign } = useFlyerDraft();
  const { activeEvent, wording } = useEventContext();
  const { configuration, layers } = draft;
  const hasConfiguration = Boolean(configuration);
  const isLocked = draft.designLocked;

  const [showConvertModal, setShowConvertModal] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [showEditWarning, setShowEditWarning] = useState(false);
  const [qrSvg, setQrSvg] = useState("");

  const surfaceRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);

  const [toolbarPos, setToolbarPos] = useState({ x: 0, y: 0 });
  const [isDraggingToolbar, setIsDraggingToolbar] = useState(false);
  const dragToolbarStart = useRef({ x: 0, y: 0 });
  const displayGuestName =
    previewGuest?.name ??
    guestName ??
    `${wording.guest_label_singular.toLowerCase()}'s_name`;
  const displayGuestCategory =
    previewGuest?.category ??
    guestCategory ??
    activeEvent?.configuration.invitation_categories?.[0] ??
    "General";
  const displayQrHash = previewGuest?.qrHash ?? qrHash ?? "guest-invitation-preview";

  // ── Keyboard panning ──────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") setIsSpacePressed(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setIsSpacePressed(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    QRCode.toString(displayQrHash, {
      type: "svg",
      width: 240,
      margin: 1,
      color: {
        dark: SECURE_QR_FOREGROUND_COLOR,
        light: SECURE_QR_BACKGROUND_COLOR,
      },
    })
      .then((svg) => {
        if (!cancelled) setQrSvg(svg);
      })
      .catch(() => {
        if (!cancelled) setQrSvg("");
      });

    return () => {
      cancelled = true;
    };
  }, [displayQrHash]);

  // ── Trackpad pinch zoom and two-finger pan ─────────
  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;

    const handleWheel = (event: WheelEvent) => {
      if (event.cancelable) event.preventDefault();
      event.stopPropagation();

      const rect = surface.getBoundingClientRect();
      const delta = getWheelDeltaInPixels(event, rect.height);

      if (event.ctrlKey || event.metaKey) {
        const pointerX = event.clientX - rect.left - rect.width / 2;
        const pointerY = event.clientY - rect.top - rect.height / 2;

        setViewport((previous) => {
          const nextScale = clampViewportScale(
            previous.scale * Math.exp(-delta.y * TRACKPAD_ZOOM_SENSITIVITY),
          );

          if (nextScale === previous.scale) return previous;

          const scaleRatio = nextScale / previous.scale;

          return {
            scale: nextScale,
            x: pointerX - (pointerX - previous.x) * scaleRatio,
            y: pointerY - (pointerY - previous.y) * scaleRatio,
          };
        });
        return;
      }

      setViewport((previous) => ({
        ...previous,
        x: previous.x - delta.x,
        y: previous.y - delta.y,
      }));
    };

    const preventTouchGesture = (event: TouchEvent) => {
      if (event.cancelable) event.preventDefault();
    };

    surface.addEventListener("wheel", handleWheel, { passive: false });
    surface.addEventListener("touchmove", preventTouchGesture, { passive: false });

    return () => {
      surface.removeEventListener("wheel", handleWheel);
      surface.removeEventListener("touchmove", preventTouchGesture);
    };
  }, [hasConfiguration]);

  // ── Panning with pointer ──────────────────────────
  const handlePointerDown = (e: React.PointerEvent) => {
    if (isSpacePressed || e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
    }
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (isPanning) {
      setViewport((prev) => ({
        ...prev,
        x: prev.x + e.movementX,
        y: prev.y + e.movementY,
      }));
    }
  };
  const handlePointerUp = () => setIsPanning(false);

  // ── Toolbar drag ──────────────────────────────────
  const handleToolbarPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.stopPropagation();
    setIsDraggingToolbar(true);
    dragToolbarStart.current = {
      x: e.clientX - toolbarPos.x,
      y: e.clientY - toolbarPos.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const handleToolbarPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingToolbar) return;
    e.stopPropagation();
    setToolbarPos({
      x: e.clientX - dragToolbarStart.current.x,
      y: e.clientY - dragToolbarStart.current.y,
    });
  };
  const handleToolbarPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingToolbar) return;
    e.stopPropagation();
    setIsDraggingToolbar(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  if (!configuration) return null;

  const handleEditClick = () => {
    if (isLocked) {
      setShowEditWarning(true);
    } else {
      onReturnToEdit();
    }
  };

  const handlePrimaryAction = () => {
    if (onSave) {
      onSave();
      return;
    }
    setShowConvertModal(true);
  };
  const usesSaveAction = Boolean(onSave);
  const primaryActionDisabled = usesSaveAction
    ? saveDisabled || isSaving
    : isLocked;
  const primaryActionTitle = usesSaveAction
    ? isSaving
      ? "Saving template"
      : "Save template"
    : isLocked
      ? "Design already locked"
      : "Convert to invitation";
  const primaryActionLabel = usesSaveAction
    ? isSaving
      ? "Saving..."
      : "Save"
    : isLocked
      ? "Locked"
      : "Convert to invitation";

  return (
    <div
      ref={surfaceRef}
      className="mobile-preview relative flex h-full w-full touch-none select-none items-center justify-center overflow-hidden overscroll-none bg-foreground/[0.035] font-sans"
      style={{
        ...getEditorViewportBackgroundStyle(viewport),
        touchAction: "none",
        overscrollBehavior: "none",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onDragStart={(e) => e.preventDefault()}
    >
      <div
        className="absolute inset-0 origin-center transition-transform duration-75 ease-out flex items-center justify-center"
        style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})` }}
      >
        <MobileFrame>
          <OriginalFlyer
            configuration={configuration}
            layers={layers}
            guestName={displayGuestName}
            guestCategory={displayGuestCategory}
            qrSvg={qrSvg}
            eventDate={activeEvent?.event_date}
            eventTime={activeEvent?.event_time}
            eventLocation={activeEvent?.event_location}
          />
        </MobileFrame>
      </div>

      {/* ---------- TOOLBAR ---------- */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-3">
        {/* Draggable toolbar */}
        <div
          onPointerDown={handleToolbarPointerDown}
          onPointerMove={handleToolbarPointerMove}
          onPointerUp={handleToolbarPointerUp}
          className={`flex items-center gap-2 bg-background/90 backdrop-blur-xl border border-brand-400/20 rounded-full pl-2 pr-3 py-2 shadow-lg touch-none ${
            isDraggingToolbar ? "cursor-grabbing" : "cursor-grab"
          }`}
          style={{ transform: `translate(${toolbarPos.x}px, ${toolbarPos.y}px)` }}
        >
          {/* Drag handle */}
          <div className="flex flex-col gap-[3px] px-2 text-foreground/30 hover:text-foreground/50 transition">
            <div className="w-1 h-1 rounded-full bg-current" />
            <div className="w-1 h-1 rounded-full bg-current" />
            <div className="w-1 h-1 rounded-full bg-current" />
          </div>

          <div className="w-[1px] h-6 bg-brand-400/20 mx-1" />

          {/* Zoom controls */}
          <button
            onClick={() => setViewport((p) => ({ ...p, scale: Math.max(0.1, p.scale - 0.2) }))}
            className="p-2 rounded-full hover:bg-brand-400/10 text-foreground/70 hover:text-brand-400 transition text-sm font-medium"
            title="Zoom out"
          >
            −
          </button>
          <span className="text-xs font-mono w-10 text-center select-none">
            {Math.round(viewport.scale * 100)}%
          </span>
          <button
            onClick={() => setViewport((p) => ({ ...p, scale: Math.min(4, p.scale + 0.2) }))}
            className="p-2 rounded-full hover:bg-brand-400/10 text-foreground/70 hover:text-brand-400 transition text-sm font-medium"
            title="Zoom in"
          >
            +
          </button>

          <div className="w-[1px] h-6 bg-brand-400/20 mx-1" />

          <button
            onClick={() => {
              setViewport({ x: 0, y: 0, scale: 1 });
              setToolbarPos({ x: 0, y: 0 });
            }}
            className="text-xs font-medium px-2 py-1.5 rounded-lg hover:bg-brand-400/10 text-foreground/70 hover:text-brand-400 transition"
            title="Reset View"
          >
            Reset
          </button>

          <div className="w-[1px] h-6 bg-brand-400/20 mx-1" />

          <button
            onClick={handleEditClick}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition bg-brand-400 text-black hover:shadow-[0_8px_20px_rgba(79,214,190,0.3)]"
            title="Return to editor"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Edit Design
          </button>

          <div className="w-[1px] h-6 bg-brand-400/20 mx-1" />
          <button
            onClick={handlePrimaryAction}
            disabled={primaryActionDisabled}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition ${
              primaryActionDisabled
                ? "bg-foreground/10 text-foreground/50 cursor-not-allowed"
                : "bg-brand-400 text-black hover:shadow-[0_8px_20px_rgba(79,214,190,0.3)]"
            }`}
            title={primaryActionTitle}
          >
            {primaryActionLabel}
          </button>
        </div>
      </div>

      {!usesSaveAction && (
        <ConvertConfirmModal
          open={showConvertModal}
          isConverting={isConverting}
          onConfirm={async () => {
            if (isConverting) return;
            setIsConverting(true);
            try {
              await lockDesign();
              setShowConvertModal(false);
            } finally {
              setIsConverting(false);
            }
          }}
          onCancel={() => {
            if (!isConverting) setShowConvertModal(false);
          }}
        />
      )}

      <EditWarningModal
        open={showEditWarning}
        onConfirm={() => {
          unlockDesign();
          setShowEditWarning(false);
          onReturnToEdit();
        }}
        onCancel={() => setShowEditWarning(false)}
      />
    </div>
  );
}
