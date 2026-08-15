"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import Image from "next/image";
import type { PlanDefinition } from "@/lib/api/plans";
import type { UserTier } from "@/lib/types/auth";

type DevicePlatform = "ios" | "android" | "desktop";

const APP_DOWNLOAD_URL =
  process.env.NEXT_PUBLIC_APP_DOWNLOAD_URL ?? "https://gathervia.app/download";
const APP_STORE_URL =
  process.env.NEXT_PUBLIC_APP_STORE_URL ??
  "https://apps.apple.com/app/gathervia/id0000000000";
const PLAY_STORE_URL =
  process.env.NEXT_PUBLIC_PLAY_STORE_URL ??
  "https://play.google.com/store/apps/details?id=com.laurinishimwe.gathervia";

function detectDevicePlatform(): DevicePlatform {
  const userAgent = navigator.userAgent;
  if (/android/i.test(userAgent)) return "android";
  if (
    /iPad|iPhone|iPod/i.test(userAgent) ||
    (/Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1)
  ) {
    return "ios";
  }
  return "desktop";
}

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  current?: number;
  limit?: number;
  tier?: UserTier;
  targetPlan?: PlanDefinition | null;
}

export function UpgradeModal({
  open,
  onClose,
  title,
  message,
  current,
  limit,
  tier,
  targetPlan,
}: UpgradeModalProps) {
  const [qrSvg, setQrSvg] = useState("");
  const [isLight, setIsLight] = useState(false);
  const [platform, setPlatform] = useState<DevicePlatform>("desktop");

  // Detect theme
  useEffect(() => {
    const html = document.documentElement;
    const frame = window.requestAnimationFrame(() => {
      setIsLight(html.classList.contains("theme-light"));
      setPlatform(detectDevicePlatform());
    });

    const observer = new MutationObserver(() => {
      setIsLight(html.classList.contains("theme-light"));
    });
    observer.observe(html, { attributes: true, attributeFilter: ["class"] });
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  // Generate QR code
  useEffect(() => {
    if (open) {
      QRCode.toString(APP_DOWNLOAD_URL, {
        type: "svg",
        width: 232,
        margin: 2,
      })
        .then(setQrSvg)
        .catch(() => setQrSvg(""));
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  const appStoreBadge = isLight
    ? "/app-store-light.svg.svg"
    : "/app-store-dark.svg.svg";
  const playStoreBadge = isLight
    ? "/google-play-light.svg.svg"
    : "/google-play-dark.svg.svg";
  const showAppStore = platform !== "android";
  const showPlayStore = platform !== "ios";
  const resolvedTitle =
    title ?? (targetPlan ? `Continue with ${targetPlan.name} on mobile` : "Unlock more guests");
  const resolvedMessage =
    message ??
    (limit !== undefined
      ? `Your ${tier ?? "current"} plan includes ${limit} guests per event. Continue in the GatherVia mobile app to increase your capacity.`
      : "Plan purchases are completed securely in the GatherVia mobile app through Apple or Google.");

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-3 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
    >
      <div
        className="absolute inset-0 bg-black/65 backdrop-blur-sm modal-backdrop-animate"
        onClick={onClose}
      />
      <div className="relative max-h-[92svh] w-full max-w-md overflow-y-auto rounded-3xl border border-brand-400/15 bg-background p-5 shadow-2xl modal-card-animate sm:p-6">
        <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-foreground/15 sm:hidden" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-400">
          Upgrade on mobile
        </p>
        <h2 id="upgrade-modal-title" className="mt-2 text-xl font-semibold">
          {resolvedTitle}
        </h2>
        <p className="mt-2 text-sm text-foreground/70">
          {resolvedMessage}
        </p>

        {current !== undefined && limit !== undefined ? (
          <div className="mt-4 flex items-center justify-between rounded-2xl border border-brand-400/10 bg-brand-400/5 px-4 py-3 text-sm">
            <span className="text-foreground/55">Guest capacity used</span>
            <strong>{current} / {limit}</strong>
          </div>
        ) : null}

        {targetPlan ? (
          <div className="mt-4 rounded-2xl border border-brand-400/15 bg-gradient-to-br from-brand-400/10 to-transparent p-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="font-semibold">{targetPlan.name}</p>
                <p className="mt-1 text-xs text-foreground/55">
                  Up to {targetPlan.guestLimit} guests per event
                </p>
              </div>
              <p className="text-lg font-semibold text-brand-400">
                {targetPlan.tier === "free" ? "Free" : "Store price"}
              </p>
            </div>
          </div>
        ) : null}

        {/* QR Code */}
        <div className="mt-5 flex justify-center">
          {qrSvg ? (
            <a
              href={APP_DOWNLOAD_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open the GatherVia mobile app download page"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
              className="overflow-hidden rounded-2xl bg-white p-2 shadow-[0_16px_40px_rgba(0,0,0,0.22)]"
            />
          ) : (
            <div className="h-[232px] w-[232px] animate-pulse rounded-2xl bg-foreground/10" />
          )}
        </div>
        <p className="mt-2 text-center text-xs text-foreground/50">
          Scan with your phone to download
        </p>

        {/* Store badges */}
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          {showAppStore ? <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:-translate-y-0.5"
          >
            <Image
              src={appStoreBadge}
              alt="Download on the App Store"
              width={140}
              height={42}
              className="h-auto w-[132px] sm:w-[140px]"
            />
          </a> : null}
          {showPlayStore ? <a
            href={PLAY_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:-translate-y-0.5"
          >
            <Image
              src={playStoreBadge}
              alt="Get it on Google Play"
              width={140}
              height={42}
              className="h-auto w-[132px] sm:w-[140px]"
            />
          </a> : null}
        </div>

        <button
          onClick={onClose}
          className="mt-5 min-h-11 w-full rounded-full border border-brand-400/20 px-4 py-2 text-sm transition hover:bg-brand-400/5"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
