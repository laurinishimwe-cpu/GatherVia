"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useEventContext } from "@/context/EventContext";

// Map UI labels to backend enum values
const EVENT_TYPE_MAP: Record<string, string> = {
  Wedding: "marriage",
  Corporate: "corporate",
  Birthday: "private",
  Party: "private",
  Conference: "conference",
  Other: "other",
};

function FolderIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2 6a2 2 0 012-2h5l2 2h9a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
    </svg>
  );
}
function CanvasIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M3 12h18" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

interface CreateEventModalProps {
  open: boolean;
  onClose: () => void;
  onSelectTemplates: () => void;
  template?: { category: string; title: string } | null;
}

export function CreateEventModal({
  open,
  onClose,
  onSelectTemplates,
  template,
}: CreateEventModalProps) {
  const router = useRouter();
  const { createDraftEvent } = useEventContext();

  // All hooks before early return
  const [step, setStep] = useState<"method" | "details">(template ? "details" : "method");
  const [eventName, setEventName] = useState(template?.title ?? "");
  const [eventType, setEventType] = useState(template?.category ?? "");
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  if (!open) return null;

  const eventTypes = [
    "Wedding",
    "Corporate",
    "Birthday",
    "Party",
    "Conference",
    "Other",
  ];

  const handleCreate = async () => {
    if (!eventName.trim()) {
      setError("Please enter an event name.");
      return;
    }
    if (!eventType) {
      setError("Please select an event type.");
      return;
    }

    // Convert UI label to backend enum value
    const backendEventType = EVENT_TYPE_MAP[eventType] ?? "other";

    setError("");
    setIsCreating(true);
    try {
      const id = await createDraftEvent(eventName.trim(), backendEventType);
      router.push(`/dashboard/event/${id}`);
      onClose();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not create event.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm modal-backdrop-animate" onClick={onClose} />

      <div className="relative w-full max-w-lg h-[540px] rounded-3xl border border-brand-400/10 bg-background shadow-2xl flex flex-col modal-card-animate">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-2">
          <div className="text-xs font-medium text-foreground/50">
            <span className={step === "method" ? "text-brand-400 font-semibold" : ""}>1</span>
            <span className="mx-1">/</span>
            <span className={step === "details" ? "text-brand-400 font-semibold" : ""}>2</span>
            <span className="ml-2">Step {step === "method" ? "1" : "2"} of 2</span>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full border border-brand-400/20 bg-background/80 text-foreground/60 hover:bg-brand-400/10 hover:text-foreground transition" aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 scrollbar-thin">
          {step === "method" && (
            <>
              <h2 className="text-xl font-semibold mb-2">Create new event</h2>
              <p className="text-sm text-foreground/60 mb-5">Choose how you’d like to start your invitation.</p>
              <div className="flex flex-col gap-3">
                <button onClick={() => setStep("details")} className="flex items-center gap-4 rounded-2xl border border-brand-400/20 bg-brand-400/5 p-4 text-left hover:border-brand-400/40 transition">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-400/10 text-brand-400"><FolderIcon /></span>
                  <div>
                    <span className="font-medium">Upload your own flyer</span>
                    <p className="text-sm text-foreground/60 mt-0.5">Start with a blank canvas or upload an image</p>
                  </div>
                </button>
                <button onClick={onSelectTemplates} className="flex items-center gap-4 rounded-2xl border border-brand-400/20 bg-brand-400/5 p-4 text-left hover:border-brand-400/40 transition">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-400/10 text-brand-400"><CanvasIcon /></span>
                  <div>
                    <span className="font-medium">Use a template</span>
                    <p className="text-sm text-foreground/60 mt-0.5">Pick a professionally designed invitation</p>
                  </div>
                </button>
              </div>
            </>
          )}

          {step === "details" && (
            <>
              <h2 className="text-xl font-semibold mb-1">{template ? "Customise your template" : "Event details"}</h2>
              <p className="text-sm text-foreground/60 mb-5">Set a name and event type before entering the workspace.</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Event name</label>
                  <input type="text" value={eventName} onChange={(e) => setEventName(e.target.value)} className="w-full rounded-xl border border-brand-400/20 bg-background px-3 py-2.5 text-sm outline-none focus:border-brand-400/50" placeholder="e.g. Amara & Kofi Wedding" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Event type</label>
                  <div className="flex flex-wrap gap-2">
                    {eventTypes.map((type) => (
                      <button
                        key={type}
                        onClick={() => setEventType(type)}
                        className={`rounded-full px-4 py-1.5 text-xs font-medium border transition ${
                          eventType === type ? "border-brand-400 bg-brand-400/10 text-brand-400" : "border-brand-400/20 bg-brand-400/5 text-foreground/70 hover:border-brand-400/40"
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                  {template && <p className="mt-1 text-xs text-foreground/50">Pre‑filled from template – you can change it</p>}
                </div>
                {error && <p className="text-sm text-red-400">{error}</p>}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-brand-400/10 px-6 py-4">
          {step === "method" && (
            <button onClick={onClose} className="w-full py-2 text-sm font-medium text-foreground/60 hover:text-foreground transition">
              Cancel
            </button>
          )}

          {step === "details" && (
            <div className="flex gap-3">
              <button onClick={() => { setStep("method"); setError(""); }} className="flex-1 rounded-full border border-brand-400/20 px-4 py-2.5 text-sm font-medium hover:bg-brand-400/5 transition">
                Back
              </button>
              <button
                onClick={handleCreate}
                disabled={isCreating}
                className="flex-1 rounded-full bg-brand-400 py-2.5 text-sm font-semibold text-black hover:shadow-[0_8px_20px_rgba(79,214,190,0.3)] transition disabled:opacity-50"
              >
                {isCreating ? "Creating…" : "Create event"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
