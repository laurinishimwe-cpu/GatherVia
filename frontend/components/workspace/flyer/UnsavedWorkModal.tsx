"use client";

interface UnsavedWorkModalProps {
  open: boolean;
  onStay: () => void;
  onLeave: () => void;
}

export function UnsavedWorkModal({ open, onStay, onLeave }: UnsavedWorkModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onStay} />
      <div className="relative w-full max-w-sm rounded-3xl border border-brand-400/10 bg-background p-6 shadow-2xl modal-card-animate">
        <h2 className="text-lg font-semibold">Leave without saving?</h2>
        <p className="mt-2 text-sm text-foreground/70">
          You have unsaved changes. If you leave now, your recent edits will be lost.
        </p>
        <div className="mt-6 flex gap-3">
          <button onClick={onStay} className="flex-1 rounded-full border border-brand-400/20 px-4 py-2 text-sm hover:bg-brand-400/5 transition">Stay</button>
          <button onClick={onLeave} className="flex-1 rounded-full bg-red-500 py-2 text-sm font-semibold text-white hover:shadow-[0_8px_20px_rgba(239,68,68,0.3)] transition">Leave</button>
        </div>
      </div>
    </div>
  );
}
