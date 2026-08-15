// frontend/components/workspace/flyer/FlyerTemplatePicker.tsx
"use client";

import { useEffect, useState } from "react";
import { fetchFlyerTemplates } from "@/lib/api/flyers";
import type { EventType } from "@/lib/types/event";
import type { FlyerTemplate } from "@/lib/types/flyer";
import { buildFlyerTemplateDraft } from "@/lib/flyer/template-preview";
import { useFlyerDraft } from "@/context/FlyerDraftContext";

function eventTypeLabel(type: EventType): string {
  const labels: Record<EventType, string> = {
    marriage: "Marriage",
    corporate: "Corporate",
    private: "Private",
    conference: "Conference",
    gala: "Gala",
    other: "Other",
  };
  return labels[type] || type;
}

interface FlyerTemplatePickerProps {
  eventType: EventType;
}

export function FlyerTemplatePicker({ eventType }: FlyerTemplatePickerProps) {
  const { setFlyerDraft } = useFlyerDraft();
  const [templates, setTemplates] = useState<FlyerTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const items = await fetchFlyerTemplates({ eventType });
        if (!cancelled) setTemplates(items.slice(0, 4));
      } catch {
        console.error("Failed to fetch flyer templates");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [eventType]);

  if (isLoading) {
    return (
      <div className="text-xs text-foreground/60 animate-pulse py-2">
        Loading templates…
      </div>
    );
  }

  if (templates.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Start from a template</h3>
      <div className="grid grid-cols-2 gap-2">
        {templates.map((template) => (
          <button
            key={template.id}
            onClick={() => {
              const draft = buildFlyerTemplateDraft(template);
              if (!draft.configuration) return;
              setFlyerDraft({
                configuration: draft.configuration,
                layers: draft.layers,
                templateId: template.id,
                templateTitle: template.title,
                designLocked: false,
              });
            }}
            className="rounded-xl border border-brand-400/10 p-3 text-left hover:border-brand-400/30 transition flex flex-col gap-1"
            style={{ backgroundColor: template.canvas_background_color + "10" }}
          >
            <span className="text-[10px] uppercase font-semibold text-brand-400">
              {eventTypeLabel(template.event_type)}
            </span>
            <span className="text-xs font-medium leading-tight">
              {template.title}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
