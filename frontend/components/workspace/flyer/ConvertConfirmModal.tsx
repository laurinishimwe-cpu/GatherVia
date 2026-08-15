"use client";

interface ConvertConfirmModalProps {
  open: boolean;
  isConverting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConvertConfirmModal({
  open,
  isConverting,
  onConfirm,
  onCancel,
}: ConvertConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" aria-busy={isConverting}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => {
          if (!isConverting) onCancel();
        }}
      />
      {/* Card */}
      <div className="relative w-full max-w-sm rounded-3xl border border-brand-400/10 bg-background p-6 shadow-2xl modal-card-animate">
        <h2 className="text-lg font-semibold">Lock invitation design?</h2>
        <p className="mt-2 text-sm text-foreground/70">
          Once you convert, the current design will be locked and used for all
          guest invitations. You’ll be able to manage guests, admins, and view
          analytics.
        </p>
        <p className="mt-2 text-sm font-medium text-red-400">
          If you edit the design later, all existing guest data and admin links
          will be permanently deleted.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={onCancel}
            disabled={isConverting}
            className="flex-1 rounded-full border border-brand-400/20 px-4 py-2 text-sm transition hover:bg-brand-400/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isConverting}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-brand-400 py-2 text-sm font-semibold text-black transition hover:shadow-[0_8px_20px_rgba(79,214,190,0.3)] disabled:cursor-wait disabled:opacity-75"
          >
            {isConverting && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" aria-hidden="true" />
            )}
            {isConverting ? "Converting…" : "Convert & lock"}
          </button>
        </div>
      </div>
    </div>
  );
}
