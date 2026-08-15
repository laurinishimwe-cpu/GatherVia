"use client";

import { Minus, Plus, RotateCcw } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import QRCode from "qrcode";

import {
  clampViewportScale,
  getEditorViewportBackgroundStyle,
  getWheelDeltaInPixels,
  MAX_VIEWPORT_SCALE,
  MIN_VIEWPORT_SCALE,
  TRACKPAD_ZOOM_SENSITIVITY,
} from "@/components/editor/editor-viewport";
import { useFlyerDraft } from "@/context/FlyerDraftContext";
import { OriginalFlyer } from "@/components/workspace/flyer/OriginalFlyer";
import {
  SECURE_QR_BACKGROUND_COLOR,
  SECURE_QR_FOREGROUND_COLOR,
} from "@/lib/invitation/originalFlyerLayout";

const SAMPLE_GUEST_NAME = "Alex Morgan";
const SAMPLE_GUEST_CATEGORY = "VIP Guest";
const SAMPLE_EVENT_DATE = "2026-12-18";
const SAMPLE_EVENT_TIME = "18:30";
const SAMPLE_EVENT_LOCATION = "GatherVia Grand Hall";
const SAMPLE_QR_VALUE = "gathervia-template-preview";

export interface StubEditorPreviewData {
  guestName?: string;
  guestCategory?: string;
  eventDate?: string | null;
  eventTime?: string | null;
  eventLocation?: string | null;
  qrValue?: string;
}

interface StubEditorCanvasProps {
  previewData?: StubEditorPreviewData;
}

export function StubEditorCanvas({
  previewData,
}: StubEditorCanvasProps = {}) {
  const {
    draft,
    setViewport,
  } = useFlyerDraft();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [qrSvg, setQrSvg] = useState("");
  const [isPanning, setIsPanning] = useState(false);
  const configuration = draft.configuration;
  const viewport = draft.viewport;
  const guestName =
    previewData?.guestName?.trim() || SAMPLE_GUEST_NAME;
  const guestCategory =
    previewData?.guestCategory?.trim() || SAMPLE_GUEST_CATEGORY;
  const eventDate = previewData
    ? previewData.eventDate
    : SAMPLE_EVENT_DATE;
  const eventTime = previewData
    ? previewData.eventTime
    : SAMPLE_EVENT_TIME;
  const eventLocation = previewData
    ? previewData.eventLocation
    : SAMPLE_EVENT_LOCATION;
  const qrValue =
    previewData?.qrValue?.trim() || SAMPLE_QR_VALUE;
  useEffect(() => {
    let cancelled = false;

    QRCode.toString(qrValue, {
      type: "svg",
      width: 240,
      margin: 1,
      color: {
        dark: SECURE_QR_FOREGROUND_COLOR,
        light: SECURE_QR_BACKGROUND_COLOR,
      },
    })
      .then((svg) => {
        if (!cancelled) {
          setQrSvg(svg);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrSvg("");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [qrValue]);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;

    const handleWheel = (event: WheelEvent) => {
      if (event.cancelable) event.preventDefault();
      event.stopPropagation();

      const bounds = surface.getBoundingClientRect();
      const delta = getWheelDeltaInPixels(event, bounds.height);

      if (event.ctrlKey || event.metaKey) {
        const pointerX = event.clientX - bounds.left - bounds.width / 2;
        const pointerY = event.clientY - bounds.top - bounds.height / 2;

        setViewport((previous) => {
          const nextScale = clampViewportScale(
            previous.scale *
              Math.exp(-delta.y * TRACKPAD_ZOOM_SENSITIVITY),
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

    surface.addEventListener("wheel", handleWheel, { passive: false });
    return () => surface.removeEventListener("wheel", handleWheel);
  }, [setViewport]);

  const handlePointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (
      event.button !== 0 &&
      event.button !== 1
    ) {
      return;
    }

    if (
      (event.target as HTMLElement).closest("[data-viewport-controls]")
    ) {
      return;
    }

    event.preventDefault();
    setIsPanning(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (!isPanning) return;

    setViewport((previous) => ({
      ...previous,
      x: previous.x + event.movementX,
      y: previous.y + event.movementY,
    }));
  };

  const handlePointerEnd = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (!isPanning) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsPanning(false);
  };

  if (!configuration) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center p-6 text-center">
        <div className="max-w-sm rounded-2xl border border-brand-400/15 bg-background/80 p-6 shadow-lg">
          <p className="text-sm font-semibold">
            Ticket stub unavailable
          </p>

          <p className="mt-2 text-xs leading-5 text-foreground/55">
            Load a flyer configuration before editing the ticket stub.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={surfaceRef}
      className={`relative h-full min-h-0 w-full touch-none select-none overflow-hidden overscroll-none bg-foreground/[0.035] ${
        isPanning ? "cursor-grabbing" : "cursor-grab"
      }`}
      style={{
        ...getEditorViewportBackgroundStyle(viewport),
        touchAction: "none",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      <div
        className="pointer-events-none absolute inset-0 flex origin-center items-center justify-center"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
        }}
      >
        <div className="relative h-[min(76vh,800px)] max-h-[calc(100%-8rem)] w-auto max-w-[calc(100%-8rem)] shrink-0 aspect-[9/16] shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
          <OriginalFlyer
            configuration={configuration}
            layers={draft.layers}
            guestName={guestName}
            guestCategory={guestCategory}
            qrSvg={qrSvg}
            eventDate={eventDate}
            eventTime={eventTime}
            eventLocation={eventLocation}
          />
        </div>
      </div>

      <div
        data-viewport-controls
        className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full border border-brand-400/20 bg-background/92 p-1.5 shadow-lg backdrop-blur-xl"
      >
        <button
          type="button"
          title="Zoom out"
          aria-label="Zoom out"
          onClick={() => setViewport((previous) => ({
            ...previous,
            scale: Math.max(
              MIN_VIEWPORT_SCALE,
              previous.scale - 0.2,
            ),
          }))}
          className="flex size-8 items-center justify-center rounded-full text-foreground/65 transition hover:bg-brand-400/10 hover:text-brand-400"
        >
          <Minus aria-hidden="true" className="size-4" />
        </button>

        <span className="w-12 text-center font-mono text-[11px] text-foreground/70">
          {Math.round(viewport.scale * 100)}%
        </span>

        <button
          type="button"
          title="Zoom in"
          aria-label="Zoom in"
          onClick={() => setViewport((previous) => ({
            ...previous,
            scale: Math.min(
              MAX_VIEWPORT_SCALE,
              previous.scale + 0.2,
            ),
          }))}
          className="flex size-8 items-center justify-center rounded-full text-foreground/65 transition hover:bg-brand-400/10 hover:text-brand-400"
        >
          <Plus aria-hidden="true" className="size-4" />
        </button>

        <span aria-hidden="true" className="mx-1 h-5 w-px bg-brand-400/15" />

        <button
          type="button"
          title="Reset view"
          aria-label="Reset view"
          onClick={() => setViewport({ x: 0, y: 0, scale: 1 })}
          className="flex size-8 items-center justify-center rounded-full text-foreground/65 transition hover:bg-brand-400/10 hover:text-brand-400"
        >
          <RotateCcw aria-hidden="true" className="size-4" />
        </button>
      </div>
    </div>
  );
}
