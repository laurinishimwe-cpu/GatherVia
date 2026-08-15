"use client";

import { SettingsPanel } from "./sections/SettingsPanel";
import { DesignPanel } from "./sections/DesignPanel";
import { GuestsPanel } from "./sections/GuestsPanel";
import { AdminsPanel } from "./sections/AdminsPanel";
import { AnalyticsPanel } from "./sections/AnalyticsPanel";
import type { WorkspaceSection } from "./Workspace";
import type { EditorMode } from "@/components/editor/editor-types";

interface CenterCanvasProps {
  activeSection: WorkspaceSection;
  editorMode: EditorMode;
}

export function CenterCanvas({
  activeSection,
  editorMode,
}: CenterCanvasProps) {
  const isDesignSection = activeSection === "design";

  return (
    <div
      className={`min-h-0 min-w-0 flex-1 ${
        isDesignSection
          ? "canvas-area overflow-hidden"
          : "overflow-y-auto p-6 scrollbar-custom"
      }`}
    >
      {isDesignSection && <DesignPanel editorMode={editorMode} />}
      {activeSection === "settings" && <SettingsPanel />}
      {activeSection === "guests" && <GuestsPanel />}
      {activeSection === "admins" && <AdminsPanel />}
      {activeSection === "analytics" && <AnalyticsPanel />}
    </div>
  );
}
