"use client";

import { useCallback, useRef, useState } from "react";
import { useFlyerDraft } from "@/context/FlyerDraftContext";
import { uploadFlyer } from "@/lib/api/flyers";               
import { DEFAULT_FLYER_CONFIGURATION } from "@/lib/types/flyer";
import { useEventContext } from "@/context/EventContext";

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function FlyerUploadZone() {
  const { setFlyerDraft } = useFlyerDraft();
  const { activeEvent } = useEventContext();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);      

  const processFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) return;

      setIsUploading(true);
      try {
        // 1. Upload the file to Supabase (via backend)
        const configuration = DEFAULT_FLYER_CONFIGURATION(
          1080,
          1920
        );
        const eventId = activeEvent?.id;
        const record = await uploadFlyer(
          file,
          configuration,
          eventId && /^[a-f\d]{24}$/i.test(eventId) ? eventId : undefined,
        );
        const permanentUrl = record.image_url;   // public Supabase URL

        // 2. Build the image layer with the permanent URL
        const imageLayer = {
          id: generateId(),
          type: "image" as const,
          imageUrl: permanentUrl,
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          opacity: 1,
          rotation: 0,
          zIndex: 0,
          visible: true,
          locked: false,
          parentId: "main-frame",
          borderRadius: 0,
        };

        // 3. Store the draft (unlocked, with a preview and a layer)
        setFlyerDraft({
          previewUrl: permanentUrl,
          configuration: {
            ...configuration,
            // Add any stub‑related defaults if needed
          },
          layers: [imageLayer],
          designLocked: false,    // <-- start unlocked, the user can edit
        });
      } catch (error) {
        console.error("Flyer upload failed", error);
        // Optionally show a toast here
      } finally {
        setIsUploading(false);
      }
    },
    [activeEvent?.id, setFlyerDraft]
  );

  return (
    <div
      className={`relative rounded-3xl border-2 border-dashed p-8 text-center transition ${
        isDragging
          ? "border-brand-400/50 bg-brand-400/10"
          : "border-brand-400/20 hover:border-brand-400/40"
      }`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) processFile(file);
      }}
    >
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-400/10 text-brand-400">
        <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0l-4 4m4-4l4 4M4 20h16" />
        </svg>
      </div>
      <h3 className="mt-4 text-lg font-semibold">Upload your flyer</h3>
      <p className="mt-2 text-sm text-foreground/60">
        Drag & drop a PNG or JPG, or click to browse.
      </p>

      {isUploading ? (
        <p className="mt-5 text-sm text-foreground/60">Uploading…</p>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand-400 px-5 py-2.5 text-sm font-semibold text-black transition hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(79,214,190,0.3)]"
        >
          Browse files
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) processFile(file);
        }}
      />
    </div>
  );
}
