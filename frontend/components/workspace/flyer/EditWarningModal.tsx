"use client";

interface EditWarningModalProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function EditWarningModal({
  open,
  onConfirm,
  onCancel,
}: EditWarningModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative w-full max-w-sm rounded-3xl border border-brand-400/10 bg-background p-6 shadow-2xl modal-card-animate">
        <h2 className="text-lg font-semibold">Edit locked design?</h2>
        <p className="mt-2 text-sm text-foreground/70">
  This design is currently locked and used for guest invitations. If you
  edit it, all existing guest data, admin links, and QR codes will be
  permanently deleted. The design layers and settings will be kept.
</p>
        <p className="mt-2 text-sm font-medium text-red-400">
          This action cannot be undone.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-full border border-brand-400/20 px-4 py-2 text-sm hover:bg-brand-400/5 transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-full bg-red-500 py-2 text-sm font-semibold text-white hover:shadow-[0_8px_20px_rgba(239,68,68,0.3)] transition"
          >
            Delete & edit
          </button>
        </div>
      </div>
    </div>
  );
}
