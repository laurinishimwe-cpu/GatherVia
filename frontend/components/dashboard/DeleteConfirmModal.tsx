"use client";

interface DeleteConfirmModalProps {
  open: boolean;
  eventTitle: string;
  itemLabel?: string;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirmModal({
  open,
  eventTitle,
  itemLabel = "event",
  isDeleting,
  onConfirm,
  onCancel,
}: DeleteConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" aria-busy={isDeleting}>
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => {
          if (!isDeleting) onCancel();
        }}
      />
      <div className="relative w-full max-w-sm rounded-3xl border border-brand-400/10 bg-background p-6 shadow-2xl modal-card-animate">
        <h2 className="text-lg font-semibold">Delete {itemLabel}?</h2>
        <p className="mt-2 text-sm text-foreground/70">
          Are you sure you want to delete <strong>{eventTitle}</strong>? This
          action cannot be undone.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 rounded-full border border-brand-400/20 px-4 py-2 text-sm transition hover:bg-brand-400/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-red-500 py-2 text-sm font-semibold text-white transition hover:shadow-[0_8px_20px_rgba(239,68,68,0.3)] disabled:cursor-wait disabled:opacity-75"
          >
            {isDeleting && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" aria-hidden="true" />
            )}
            {isDeleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
