"use client";

import { LayoutTemplate, Ticket } from "lucide-react";

import type { EditorMode } from "@/components/editor/editor-types";

interface EditorModeSwitcherProps {
  mode: EditorMode;
  onChange: (mode: EditorMode) => void;
  stubDisabled?: boolean;
  stubDisabledReason?: string;
}

const MODE_OPTIONS = [
  {
    mode: "design",
    label: "Design",
    icon: LayoutTemplate,
  },
  {
    mode: "stub",
    label: "Ticket stub",
    icon: Ticket,
  },
] as const;

export function EditorModeSwitcher({
  mode,
  onChange,
  stubDisabled = false,
  stubDisabledReason = "Choose or upload a flyer first.",
}: EditorModeSwitcherProps) {
  return (
    <div
      role="group"
      aria-label="Invitation editor mode"
      className="grid grid-cols-2 gap-1 rounded-lg border border-brand-400/10 bg-brand-400/[0.04] p-1"
    >
      {MODE_OPTIONS.map((option) => {
        const Icon = option.icon;
        const selected = mode === option.mode;
        const disabled = option.mode === "stub" && stubDisabled;

        return (
          <button
            key={option.mode}
            type="button"
            disabled={disabled}
            title={disabled ? stubDisabledReason : option.label}
            aria-pressed={selected}
            aria-label={
              disabled
                ? `${option.label}. ${stubDisabledReason}`
                : option.label
            }
            onClick={() => onChange(option.mode)}
            className={`flex min-h-9 items-center justify-center gap-1.5 rounded-md px-2 text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
              selected
                ? "bg-brand-400/20 text-brand-400"
                : "text-foreground/55 hover:bg-brand-400/10 hover:text-foreground"
            } disabled:cursor-not-allowed disabled:opacity-35`}
          >
            <Icon aria-hidden="true" className="size-3.5" />
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
