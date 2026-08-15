"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

interface QrCodeModalProps {
  open: boolean;
  url: string;
  onClose: () => void;
}

export function QrCodeModal({ open, url, onClose }: QrCodeModalProps) {
  const [qrSvg, setQrSvg] = useState("");
  const [qrPng, setQrPng] = useState("");

  useEffect(() => {
    if (!open || !url) return;

    QRCode.toString(url, { type: "svg", width: 300, margin: 2 })
      .then((svg) => setQrSvg(svg))
      .catch(console.error);

    QRCode.toDataURL(url, { width: 300, margin: 2 })
      .then((dataUrl) => setQrPng(dataUrl))
      .catch(console.error);
  }, [open, url]);

  if (!open) return null;

  const handleDownloadPng = () => {
    const link = document.createElement("a");
    link.href = qrPng;
    link.download = "invitation-qr.png";
    link.click();
  };

  const handleDownloadSvg = () => {
    const blob = new Blob([qrSvg], { type: "image/svg+xml" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "invitation-qr.svg";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Event Invitation", url });
      } catch {}
    } else {
      navigator.clipboard.writeText(url);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-3xl border border-brand-400/10 bg-background p-6 shadow-2xl modal-card-animate">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Invitation QR Code</h3>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full border border-brand-400/20 text-foreground/60 hover:text-foreground transition">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* QR Code */}
        <div className="flex items-center justify-center p-4 bg-white rounded-2xl mb-4">
          {qrSvg ? (
            <div dangerouslySetInnerHTML={{ __html: qrSvg }} />
          ) : (
            <div className="w-[300px] h-[300px] animate-pulse bg-foreground/10 rounded-xl" />
          )}
        </div>

        <p className="text-xs text-center text-foreground/50 mb-4 truncate">{url}</p>

        <div className="flex gap-2">
          <button
            onClick={handleDownloadPng}
            disabled={!qrPng}
            className="flex-1 rounded-full border border-brand-400/20 px-3 py-2 text-xs font-medium hover:bg-brand-400/5 transition"
          >
            PNG
          </button>
          <button
            onClick={handleDownloadSvg}
            disabled={!qrSvg}
            className="flex-1 rounded-full border border-brand-400/20 px-3 py-2 text-xs font-medium hover:bg-brand-400/5 transition"
          >
            SVG
          </button>
          <button
            onClick={handleShare}
            className="flex-1 rounded-full bg-brand-400 px-3 py-2 text-xs font-semibold text-black hover:shadow-[0_4px_12px_rgba(79,214,190,0.3)] transition"
          >
            Share
          </button>
        </div>
      </div>
    </div>
  );
}
