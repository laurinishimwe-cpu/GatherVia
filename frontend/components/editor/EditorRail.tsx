"use client";

import {
  ArrowLeft,
  Eye,
  LayoutTemplate,
  Layers3,
  LoaderCircle,
  Palette,
  Save,
  Ticket,
} from "lucide-react";
import type {
  LucideIcon,
} from "lucide-react";
import type {
  EditorMode,
} from "@/components/editor/editor-types";

interface EditorRailProps {
  editorMode: EditorMode;
  layersPanelOpen: boolean;
  canvasSettingsActive: boolean;
  previewDisabled?: boolean;
  saveDisabled?: boolean;
  isSaving?: boolean;
  hasUnsavedChanges?: boolean;
  onBack: () => void;
  onShowDesign: () => void;
  onShowStub: () => void;
  onToggleLayersPanel: () => void;
  onShowCanvasSettings: () => void;
  onPreview: () => void;
  onSave: () => void;
}

interface EditorRailButtonProps {
  label: string;
  Icon: LucideIcon;
  active?: boolean;
  disabled?: boolean;
  showStatusDot?: boolean;
  spinning?: boolean;
  onClick: () => void;
}

function EditorRailButton({
  label,
  Icon,
  active = false,
  disabled = false,
  showStatusDot = false,
  spinning = false,
  onClick,
}: EditorRailButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={
        active || undefined
      }
      disabled={disabled}
      onClick={onClick}
      className={[
        "group relative flex h-11 w-11",
        "items-center justify-center",
        "rounded-2xl border",
        "transition duration-200",
        "focus-visible:outline-none",
        "focus-visible:ring-2",
        "focus-visible:ring-brand-400",
        active
          ? [
              "border-brand-400/30",
              "bg-brand-400/15",
              "text-brand-400",
              "shadow-sm",
            ].join(" ")
          : [
              "border-transparent",
              "text-foreground/55",
              "hover:border-brand-400/15",
              "hover:bg-brand-400/[0.07]",
              "hover:text-foreground",
            ].join(" "),
        "disabled:pointer-events-none",
        "disabled:opacity-30",
      ].join(" ")}
    >
      <Icon
        aria-hidden="true"
        className={[
          "h-[18px] w-[18px]",
          spinning
            ? "animate-spin"
            : "",
        ].join(" ")}
        strokeWidth={1.9}
      />

      {showStatusDot ? (
        <span
          aria-hidden="true"
          className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-background bg-amber-400"
        />
      ) : null}

      <span className="pointer-events-none absolute left-full z-50 ml-3 hidden whitespace-nowrap rounded-lg border border-brand-400/10 bg-background px-2.5 py-1.5 text-[11px] font-medium text-foreground shadow-xl group-hover:block group-focus-visible:block">
        {label}
      </span>
    </button>
  );
}

export function EditorRail({
  editorMode,
  layersPanelOpen,
  canvasSettingsActive,
  previewDisabled = false,
  saveDisabled = false,
  isSaving = false,
  hasUnsavedChanges = false,
  onBack,
  onShowDesign,
  onShowStub,
  onToggleLayersPanel,
  onShowCanvasSettings,
  onPreview,
  onSave,
}: EditorRailProps) {
  return (
    <aside
      aria-label="Editor navigation"
      className="relative z-30 flex h-full w-16 shrink-0 flex-col items-center border-r border-brand-400/10 bg-background px-2 py-3 shadow-sm"
    >
      <EditorRailButton
        label="Back to template library"
        Icon={ArrowLeft}
        onClick={onBack}
      />

      <div className="my-3 h-px w-8 bg-brand-400/10" />

      <nav
        aria-label="Editor panels"
        className="flex flex-col items-center gap-2"
      >
        <EditorRailButton
          label="Main design"
          Icon={LayoutTemplate}
          active={editorMode === "design"}
          onClick={onShowDesign}
        />

        <EditorRailButton
          label="Ticket stub"
          Icon={Ticket}
          active={editorMode === "stub"}
          onClick={onShowStub}
        />

        <div className="my-1 h-px w-8 bg-brand-400/10" />

        <EditorRailButton
          label={
            layersPanelOpen
              ? "Close layers"
              : "Open layers"
          }
          Icon={Layers3}
          active={layersPanelOpen}
          disabled={editorMode !== "design"}
          onClick={
            onToggleLayersPanel
          }
        />

        <EditorRailButton
          label="Canvas settings"
          Icon={Palette}
          active={
            canvasSettingsActive
          }
          disabled={editorMode !== "design"}
          onClick={
            onShowCanvasSettings
          }
        />
      </nav>

      <div className="mt-auto flex flex-col items-center gap-2">
        <EditorRailButton
          label="Preview invitation"
          Icon={Eye}
          disabled={
            previewDisabled ||
            isSaving
          }
          onClick={onPreview}
        />

        <div className="my-1 h-px w-8 bg-brand-400/10" />

        <EditorRailButton
          label={
            isSaving
              ? "Saving template"
              : "Save template"
          }
          Icon={
            isSaving
              ? LoaderCircle
              : Save
          }
          disabled={
            saveDisabled ||
            isSaving
          }
          showStatusDot={
            hasUnsavedChanges &&
            !isSaving
          }
          spinning={isSaving}
          onClick={onSave}
        />
      </div>
    </aside>
  );
}
