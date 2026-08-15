"use client";
import { useEventValidation } from "@/hooks/useEventValidation";
import { useFlyerDraft } from "@/context/FlyerDraftContext";
import { useEventContext } from "@/context/EventContext";
import type { WorkspaceSection } from "./Workspace";

const sections: { key: WorkspaceSection; label: string; icon: React.ReactNode }[] = [
  {
    key: "design",
    label: "Design",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.207H3v-3.5L15.232 5.232z" />
      </svg>
    ),
  },
  {
    key: "settings",
    label: "Settings",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    key: "guests",
    label: "Guests",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    key: "admins",
    label: "Admins",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    key: "analytics",
    label: "Analytics",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
];

interface LeftSidebarProps {
  activeSection: WorkspaceSection;
  onSectionChange: (section: WorkspaceSection) => void;
  collapsed: boolean;
  onToggleLayersPanel: () => void;
  onEditDesign?: () => void;
  onBackToDashboard: () => void;
}

export function WorkspaceLeftSidebar({
  activeSection,
  onSectionChange,
  collapsed,
  onToggleLayersPanel,
  onEditDesign,
  onBackToDashboard,
}: LeftSidebarProps) {
  const { isReady, missingFields } = useEventValidation();
  const { draft } = useFlyerDraft();
  const designLocked = draft.designLocked;
  const { activeEvent } = useEventContext();

  const widthClass = collapsed ? "w-16" : "w-64";

  return (
    <aside
      className={`${widthClass} border-r border-brand-400/10 bg-background flex flex-col overflow-y-auto scrollbar-custom transition-all duration-200`}
    >
      {/* ── Header row: Back + Collapse toggle ── */}
      <div className="flex items-center justify-between p-2 border-b border-brand-400/10">
        <button
          onClick={onBackToDashboard}
          className="inline-flex items-center gap-1 text-xs text-foreground/60 hover:text-foreground transition"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {!collapsed && "Back to dashboard"}
        </button>

        <button
          onClick={onToggleLayersPanel}
          className="flex h-7 w-7 items-center justify-center rounded-md text-foreground/50 hover:bg-brand-400/10 hover:text-foreground transition"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            // Double chevron right (expand)
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          ) : (
            // Double chevron left (collapse)
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7M19 19l-7-7 7-7" />
            </svg>
          )}
        </button>
      </div>

      {/* ── Event header (hidden when collapsed) ── */}
      {!collapsed && (
        <div className="p-4 border-b border-brand-400/10">
          <h2 className="text-sm font-semibold truncate">{activeEvent?.title || "Untitled Event"}</h2>
          <p className="text-xs text-foreground/60">{activeEvent?.event_date || "No date set"}</p>
        </div>
      )}

      {/* ── Navigation ── */}
      <nav className="flex-1 space-y-1 p-2">
        {sections.map((section) => {
          const isDisabled =
            (!isReady || !designLocked) &&
            (section.key === "guests" || section.key === "admins" || section.key === "analytics");
          const hasMissing = section.key === "settings" && missingFields.length > 0;

          return (
            <button
              key={section.key}
              aria-disabled={isDisabled}
              onClick={() => onSectionChange(section.key)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition ${
                activeSection === section.key
                  ? "bg-brand-400/10 text-brand-400"
                  : "text-foreground/70 hover:bg-brand-400/5"
              } ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
              title={collapsed ? section.label : undefined}
            >
              <span className="shrink-0">{section.icon}</span>
              {!collapsed && <span className="flex-1 text-left">{section.label}</span>}
              {!collapsed && hasMissing && <span className="h-2 w-2 rounded-full bg-red-400" />}
              {!collapsed && isDisabled && !hasMissing && (
                <span className="h-2 w-2 rounded-full bg-red-400/50" />
              )}
            </button>
          );
        })}
      </nav>

      {/* ── Footer hint (hidden when collapsed) ── */}
      {!isReady && !collapsed && (
        <div className="p-3 border-t border-brand-400/10 text-xs text-foreground/50">
          Save the event date and convert the design to unlock Guests, Admins, and Analytics.
        </div>
      )}
    </aside>
  );
}
