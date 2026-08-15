"use client";

import {
  MousePointer2,
  Palette,
  Ticket,
  X,
} from "lucide-react";

import type {
  EditorMode,
  StubEditorRegion,
} from "@/components/editor/editor-types";
import { StubPropertiesPanel } from "@/components/editor/StubPropertiesPanel";
import { FlyerStylePanel } from "@/components/workspace/flyer/FlyerStylePanel";
import { LayerPropertiesPanel } from "@/components/workspace/flyer/LayerPropertiesPanel";
import { VectorPropertiesPanel } from "@/components/editor/VectorPropertiesPanel";
import { useFlyerDraft } from "@/context/FlyerDraftContext";
import { useVectorEdit } from "@/context/VectorEditContext";

interface EditorInspectorProps {
  editorMode: EditorMode;
  selectedStubRegion: StubEditorRegion;
  onSelectStubRegion: (region: StubEditorRegion) => void;
}

function getLayerDisplayName(
  layer: {
    name?: string | null;
    type: string;
    text?: string | null;
  },
): string {
  const explicitName =
    layer.name?.trim();

  if (explicitName) {
    return explicitName;
  }

  if (
    layer.type === "text" &&
    layer.text?.trim()
  ) {
    return layer.text.trim();
  }

  return layer.type;
}

export function EditorInspector({
  editorMode,
  selectedStubRegion,
  onSelectStubRegion,
}: EditorInspectorProps) {
  const {
    draft,
    selectLayer,
  } = useFlyerDraft();
  const { session: vectorSession } = useVectorEdit();

  const selectedLayer =
    draft.layers.find(
      (layer) =>
        layer.id ===
        draft.selectedLayerId,
      ) ?? null;

  if (editorMode === "stub") {
    const stubTitle =
      selectedStubRegion === "guest"
        ? "Guest name"
        : selectedStubRegion === "badge"
          ? "Category badge"
          : selectedStubRegion === "event-details"
            ? "Event details"
            : selectedStubRegion === "qr"
              ? "QR code"
              : "Ticket stub";

    return (
      <aside className="flex h-full w-80 shrink-0 flex-col border-l border-brand-400/10 bg-background shadow-[-8px_0_30px_rgba(0,0,0,0.025)]">
        <header className="flex min-h-16 shrink-0 items-center gap-3 border-b border-brand-400/10 px-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-400/10 text-brand-400">
            <Ticket
              aria-hidden="true"
              className="h-4 w-4"
              strokeWidth={2}
            />
          </span>

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {stubTitle}
            </p>

            <p className="mt-0.5 text-[11px] text-foreground/45">
              Structured settings
            </p>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 scrollbar-custom">
          <StubPropertiesPanel
            selectedRegion={selectedStubRegion}
            onSelectRegion={onSelectStubRegion}
          />
        </div>
      </aside>
    );
  }

  const title = vectorSession
    ? "Vector path"
    : selectedLayer
    ? getLayerDisplayName(
        selectedLayer,
      )
    : "Canvas";

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l border-brand-400/10 bg-background shadow-[-8px_0_30px_rgba(0,0,0,0.025)]">
      <header className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-brand-400/10 px-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-400/10 text-brand-400">
            {selectedLayer || vectorSession ? (
              <MousePointer2
                aria-hidden="true"
                className="h-4 w-4"
                strokeWidth={2}
              />
            ) : (
              <Palette
                aria-hidden="true"
                className="h-4 w-4"
                strokeWidth={2}
              />
            )}
          </span>

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold capitalize">
              {title}
            </p>

            <p className="mt-0.5 text-[11px] text-foreground/45">
              {vectorSession
                ? "Vector editing"
                : selectedLayer
                ? "Layer properties"
                : "Design settings"}
            </p>
          </div>
        </div>

        {selectedLayer && !vectorSession ? (
          <button
            type="button"
            title="Deselect layer"
            aria-label="Deselect layer"
            onClick={() => {
              selectLayer(null);
            }}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-foreground/45 transition hover:bg-brand-400/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            <X
              aria-hidden="true"
              className="h-4 w-4"
              strokeWidth={2}
            />
          </button>
        ) : null}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 scrollbar-custom">
        {vectorSession ? (
          <VectorPropertiesPanel />
        ) : selectedLayer ? (
          <LayerPropertiesPanel />
        ) : (
          <FlyerStylePanel />
        )}
      </div>
    </aside>
  );
}
