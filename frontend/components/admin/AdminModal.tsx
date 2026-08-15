"use client";

import { X } from "lucide-react";
import {
  useEffect,
  useId,
  type ReactNode,
} from "react";

interface AdminModalProps {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  closeDisabled?: boolean;
}

export function AdminModal({
  open,
  title,
  description,
  children,
  footer,
  onClose,
  closeDisabled = false,
}: AdminModalProps) {
  const modalId = useId();
  const titleId = `${modalId}-title`;
  const descriptionId = `${modalId}-description`;

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (
        event.key === "Escape" &&
        !closeDisabled
      ) {
        onClose();
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [
    closeDisabled,
    onClose,
    open,
  ]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto px-4 py-8"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Close modal"
        disabled={closeDisabled}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/55 backdrop-blur-sm disabled:pointer-events-none"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={
          description ? descriptionId : undefined
        }
        className="relative z-10 flex max-h-[calc(100vh-4rem)] w-full max-w-lg flex-col overflow-hidden rounded-[28px] border border-brand-400/15 bg-background shadow-[0_30px_100px_rgba(0,0,0,0.35)]"
      >
        <div className="flex shrink-0 items-start justify-between gap-6 border-b border-brand-400/10 px-6 py-5">
          <div>
            <h2
              id={titleId}
              className="text-xl font-semibold tracking-tight"
            >
              {title}
            </h2>

            {description ? (
              <p
                id={descriptionId}
                className="mt-1.5 text-sm leading-6 text-foreground/50"
              >
                {description}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            aria-label="Close"
            disabled={closeDisabled}
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-brand-400/10 text-foreground/50 transition hover:border-brand-400/30 hover:bg-brand-400/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:pointer-events-none disabled:opacity-50"
          >
            <X
              aria-hidden="true"
              className="h-4 w-4"
              strokeWidth={2}
            />
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto px-6 py-6">
          {children}
        </div>

        {footer ? (
          <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-brand-400/10 bg-brand-400/[0.025] px-6 py-4 sm:flex-row sm:justify-end">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
