"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";

import {
  fetchStaffScannerContext,
  resolveGuestScan,
  resolveGuestScanByName,
} from "@/lib/api/guests";
import type {
  GuestActivityLog,
  GuestScanMode,
  GuestScanResponse,
  GuestScannerContextResponse,
} from "@/lib/types/guest";

function parseQrHash(payload: string): string | null {
  const trimmed = payload.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("gathervia://") || trimmed.startsWith("gatekeep://")) {
    const segments = trimmed.split("/").filter(Boolean);
    return segments.at(-1) ?? null;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.searchParams.get("qr_hash")?.trim() || trimmed;
  } catch {
    return trimmed.length >= 16 ? trimmed : null;
  }
}

function formatFieldLabel(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function fieldValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "Not set";
  return String(value);
}

function getPresence(logs: GuestActivityLog[] = []) {
  if (logs.length === 0) return "Not arrived";
  const movementStatuses = new Set(["Checked In", "Left Building", "Returned"]);
  const latestLog = [...logs]
    .filter((log) => movementStatuses.has(log.status))
    .sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )[0];
  if (!latestLog) return "Not arrived";
  if (latestLog.status === "Left Building") return "Currently out";
  return "Currently inside";
}

function CheckMark({ mode }: { mode: GuestScanMode }) {
  const isOut = mode === "out";
  return (
    <div
      className={`mx-auto flex h-24 w-24 items-center justify-center rounded-full ring-8 ${
        isOut
          ? "bg-sky-500/15 ring-sky-500/10"
          : "bg-emerald-500/15 ring-emerald-500/10"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        className={`h-12 w-12 ${isOut ? "text-sky-500" : "text-emerald-500"}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
      >
        {isOut ? (
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 6l6 6-6 6M21 12H4" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        )}
      </svg>
    </div>
  );
}

function DeniedMark() {
  return (
    <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-red-500/15 text-red-600 ring-8 ring-red-500/10 dark:text-red-300">
      <svg
        viewBox="0 0 24 24"
        className="h-12 w-12"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
      </svg>
    </div>
  );
}

export default function StaffScannerPage() {
  const params = useParams<{ token?: string | string[] }>();
  const routeToken = useMemo(() => {
    const value = params?.token;
    return Array.isArray(value) ? value[0] ?? "" : value ?? "";
  }, [params]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<{
    detect: (input: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>;
  } | null>(null);
  const scanIntervalRef = useRef<number | null>(null);
  const submittingRef = useRef(false);

  const [scannerContext, setScannerContext] =
    useState<GuestScannerContextResponse | null>(null);
  const [result, setResult] = useState<GuestScanResponse | null>(null);
  const [cameraState, setCameraState] = useState<
    "idle" | "starting" | "live" | "stopped"
  >("idle");
  const [statusText, setStatusText] = useState("Opening scanner...");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState("");
  const [fullNameInput, setFullNameInput] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scanMode, setScanMode] = useState<GuestScanMode>("in");
  const scanModeRef = useRef<GuestScanMode>("in");
  const [lookupMode, setLookupMode] = useState<"qr" | "name">("qr");
  const [pinInput, setPinInput] = useState("");
  const [pinCode, setPinCode] = useState("");

  const eventTitle =
    result?.event_title ?? scannerContext?.event_title ?? "Event scanner";
  const adminLabel =
    result?.admin_label ?? scannerContext?.admin_label ?? "Admin";
  const successfulScan = Boolean(result?.found && result.accepted !== false && result.guest);
  const deniedScan = Boolean(result && result.accepted === false);
  const pinLocked = Boolean(scannerContext?.pin_required && !pinCode.trim());

  const updateScanMode = useCallback((mode: GuestScanMode) => {
    scanModeRef.current = mode;
    setScanMode(mode);
  }, []);

  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current !== null) {
      window.clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraState((current) => (current === "idle" ? current : "stopped"));
  }, []);

  const submitScan = useCallback(
    async (payload: string) => {
      if (!routeToken || submittingRef.current) return;

      const qrHash = parseQrHash(payload);
      if (!qrHash) {
        setErrorText("This QR code could not be read.");
        return;
      }

      submittingRef.current = true;
      setIsSubmitting(true);
      setErrorText(null);
      setStatusText("Checking guest...");

      try {
        const response = await resolveGuestScan({
          share_token: routeToken,
          qr_hash: qrHash,
          mode: scanModeRef.current,
          pin_code: pinCode || null,
        });
        setResult(response);
        setStatusText(response.message);
        if (response.found || response.accepted === false) stopCamera();
      } catch (error) {
        setErrorText(
          error instanceof Error
            ? error.message
            : "This scan could not be verified.",
        );
        setStatusText("Scan failed.");
      } finally {
        submittingRef.current = false;
        setIsSubmitting(false);
      }
    },
    [pinCode, routeToken, stopCamera],
  );

  const submitNameScan = useCallback(async () => {
    const fullName = fullNameInput.trim();
    if (!routeToken || submittingRef.current || !fullName) return;

    submittingRef.current = true;
    setIsSubmitting(true);
    setErrorText(null);
    setStatusText("Checking guest by name...");

    try {
      const response = await resolveGuestScanByName({
        share_token: routeToken,
        full_name: fullName,
        mode: scanModeRef.current,
        pin_code: pinCode || null,
      });
      setResult(response);
      setStatusText(response.message);
      if (response.found || response.accepted === false) stopCamera();
    } catch (error) {
      setErrorText(
        error instanceof Error
          ? error.message
          : "This name could not be verified.",
      );
      setStatusText("Name lookup failed.");
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [fullNameInput, pinCode, routeToken, stopCamera]);

  const startCamera = useCallback(async () => {
    stopCamera();
    setErrorText(null);
    setStatusText("Starting camera...");
    setCameraState("starting");

    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorText("Camera access is not available in this browser.");
      setCameraState("idle");
      setManualOpen(true);
      return;
    }

    try {
      const detectorCtor = (
        window as Window & {
          BarcodeDetector?: new (options: { formats: string[] }) => {
            detect: (
              input: HTMLVideoElement,
            ) => Promise<Array<{ rawValue: string }>>;
          };
        }
      ).BarcodeDetector;

      detectorRef.current = detectorCtor
        ? new detectorCtor({ formats: ["qr_code"] })
        : null;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });

      streamRef.current = stream;

      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      setCameraState("live");
      setStatusText(
        detectorRef.current
          ? "Place the guest QR inside the frame."
          : "Camera is open. Use manual entry if the QR is not detected.",
      );

      if (!detectorRef.current) {
        setManualOpen(true);
        return;
      }

      scanIntervalRef.current = window.setInterval(() => {
        const detector = detectorRef.current;
        const video = videoRef.current;
        if (!detector || !video || submittingRef.current) return;

        void detector.detect(video).then((codes) => {
          const rawValue = codes[0]?.rawValue;
          if (rawValue) void submitScan(rawValue);
        });
      }, 450);
    } catch (error) {
      setErrorText(
        error instanceof Error ? error.message : "Unable to open the camera.",
      );
      setCameraState("idle");
      setManualOpen(true);
    }
  }, [stopCamera, submitScan]);

  useEffect(() => {
    if (!routeToken) {
      setErrorText("No scanner token was found in this link.");
      return;
    }

    let ignore = false;
    fetchStaffScannerContext(routeToken)
      .then((context) => {
        if (!ignore) setScannerContext(context);
      })
      .catch((error) => {
        if (!ignore) {
          setErrorText(
            error instanceof Error
              ? error.message
              : "This scanner link is invalid or disabled.",
          );
        }
      });

    return () => {
      ignore = true;
    };
  }, [routeToken]);

  useEffect(() => {
    if (!scannerContext) return;
    if (!scannerContext.enabled) {
      stopCamera();
      setErrorText("Scanner access is disabled. Contact the host.");
      setStatusText("Access disabled.");
      return;
    }
    if (pinLocked) {
      stopCamera();
      setStatusText("Enter the staff PIN to unlock scanning.");
      return;
    }

    void startCamera();
    return () => stopCamera();
  }, [pinLocked, scannerContext, startCamera, stopCamera]);

  const backToScanner = () => {
    updateScanMode("in");
    setResult(null);
    setManualInput("");
    setFullNameInput("");
    setErrorText(null);
    void startCamera();
  };

  const customFields = result?.guest
    ? result.allowed_admin_fields.map((fieldKey) => ({
        key: fieldKey,
        label: formatFieldLabel(fieldKey),
        value: fieldValue(result.guest?.custom_fields[fieldKey]),
      }))
    : [];

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950 antialiased dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">
        <header className="sticky top-0 z-20 border-b border-zinc-200/80 bg-zinc-50/90 px-5 py-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-base font-semibold">{eventTitle}</p>
              <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                {adminLabel}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                cameraState === "live"
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                  : "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
              }`}
            >
              {scanMode === "in" ? "Scan in" : "Scan out"}
            </span>
          </div>
        </header>

        {scannerContext && !scannerContext.enabled ? (
          <section className="flex flex-1 flex-col justify-center px-5 py-8">
            <div className="rounded-[2rem] border border-red-200 bg-white p-6 text-center shadow-sm dark:border-red-900/60 dark:bg-zinc-900">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-500/15 text-red-600 dark:text-red-300">
                <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M5.07 19h13.86a2 2 0 001.73-3L13.73 4a2 2 0 00-3.46 0L3.34 16a2 2 0 001.73 3z" />
                </svg>
              </div>
              <h1 className="mt-5 text-2xl font-bold">Access disabled</h1>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                This scanner link exists, but the host has disabled it.
              </p>
            </div>
          </section>
        ) : pinLocked ? (
          <section className="flex flex-1 flex-col justify-center px-5 py-8">
            <form
              className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
              onSubmit={(event) => {
                event.preventDefault();
                const nextPin = pinInput.trim();
                if (!nextPin) return;
                setPinCode(nextPin);
                setErrorText(null);
                setResult(null);
              }}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                Staff PIN
              </p>
              <h1 className="mt-2 text-2xl font-bold">Unlock scanner</h1>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                Enter the PIN set by the host for this admin link.
              </p>
              <input
                type="password"
                inputMode="numeric"
                value={pinInput}
                onChange={(event) => setPinInput(event.target.value.slice(0, 12))}
                className="mt-5 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-center text-lg font-semibold tracking-[0.35em] outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950"
                placeholder="PIN"
              />
              <button
                type="submit"
                disabled={!pinInput.trim()}
                className="mt-4 w-full rounded-full bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950"
              >
                Unlock scanner
              </button>
            </form>
          </section>
        ) : successfulScan && result?.guest ? (
          <section className="flex flex-1 flex-col px-5 py-8">
            <div className="flex flex-1 flex-col justify-center rounded-[2rem] border border-zinc-200 bg-white p-6 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <CheckMark mode={scanMode} />
              <p
                className={`mt-6 text-xs font-semibold uppercase tracking-[0.24em] ${
                  scanMode === "out"
                    ? "text-sky-600 dark:text-sky-300"
                    : "text-emerald-600 dark:text-emerald-300"
                }`}
              >
                {scanMode === "out" ? "Scanned out" : "Confirmed"}
              </p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight">
                {result.guest.full_name}
              </h1>
              <div className="mt-4 flex justify-center">
                <span className="rounded-full bg-zinc-950 px-5 py-2 text-sm font-semibold text-white dark:bg-zinc-50 dark:text-zinc-950">
                  {result.guest.category}
                </span>
              </div>

              <div className="mt-8 grid gap-3 text-left">
                <div className="rounded-2xl bg-zinc-100 p-4 dark:bg-zinc-800/80">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                    Current status
                  </p>
                  <p className="mt-1 text-sm font-semibold capitalize">
                    {getPresence(result.guest.check_in_logs)}
                  </p>
                </div>
                {result.guest.check_in_logs[0] ? (
                  <div className="rounded-2xl bg-zinc-100 p-4 dark:bg-zinc-800/80">
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                      Last scan
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      {result.guest.check_in_logs
                        .slice()
                        .sort(
                          (a, b) =>
                            new Date(b.timestamp).getTime() -
                            new Date(a.timestamp).getTime(),
                        )[0]
                        .status}
                    </p>
                  </div>
                ) : null}
                <div className="rounded-2xl bg-zinc-100 p-4 dark:bg-zinc-800/80">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                    Event
                  </p>
                  <p className="mt-1 text-sm font-semibold">
                    {result.event_title}
                  </p>
                </div>
                {customFields.map((field) => (
                  <div
                    key={field.key}
                    className="rounded-2xl bg-zinc-100 p-4 dark:bg-zinc-800/80"
                  >
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                      {field.label}
                    </p>
                    <p className="mt-1 text-sm font-semibold">{field.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={backToScanner}
              className="mt-5 w-full rounded-full bg-zinc-950 px-5 py-4 text-sm font-semibold text-white transition active:scale-[0.99] dark:bg-zinc-50 dark:text-zinc-950"
            >
              Back to scanner
            </button>
          </section>
        ) : result && (deniedScan || !result.found) ? (
          <section className="flex flex-1 flex-col px-5 py-8">
            <div className="flex flex-1 flex-col justify-center rounded-[2rem] border border-red-200 bg-white p-6 text-center shadow-sm dark:border-red-900/60 dark:bg-zinc-900">
              <DeniedMark />
              <p className="mt-6 text-xs font-semibold uppercase tracking-[0.24em] text-red-600 dark:text-red-300">
                Access denied
              </p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight">
                {result.guest?.full_name ?? "Guest not verified"}
              </h1>
              {result.guest ? (
                <div className="mt-4 flex justify-center">
                  <span className="rounded-full bg-zinc-950 px-5 py-2 text-sm font-semibold text-white dark:bg-zinc-50 dark:text-zinc-950">
                    {result.guest.category}
                  </span>
                </div>
              ) : null}

              <div className="mt-8 grid gap-3 text-left">
                <div className="rounded-2xl bg-red-50 p-4 text-red-950 dark:bg-red-950/40 dark:text-red-50">
                  <p className="text-xs uppercase tracking-[0.18em] text-red-500 dark:text-red-300">
                    Reason
                  </p>
                  <p className="mt-1 text-sm font-semibold">{result.message}</p>
                </div>
                {result.guest ? (
                  <div className="rounded-2xl bg-zinc-100 p-4 dark:bg-zinc-800/80">
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                      Current status
                    </p>
                    <p className="mt-1 text-sm font-semibold capitalize">
                      {getPresence(result.guest.check_in_logs)}
                    </p>
                    <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                      This duplicate attempt was logged for the host.
                    </p>
                  </div>
                ) : null}
                <div className="rounded-2xl bg-zinc-100 p-4 dark:bg-zinc-800/80">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                    Event
                  </p>
                  <p className="mt-1 text-sm font-semibold">
                    {result.event_title}
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={backToScanner}
              className="mt-5 w-full rounded-full bg-zinc-950 px-5 py-4 text-sm font-semibold text-white transition active:scale-[0.99] dark:bg-zinc-50 dark:text-zinc-950"
            >
              Back to scanner
            </button>
          </section>
        ) : (
          <section className="flex flex-1 flex-col px-5 py-5">
            <div className="relative overflow-hidden rounded-[2rem] border border-zinc-200 bg-zinc-900 shadow-sm dark:border-zinc-800">
              <video
                ref={videoRef}
                muted
                playsInline
                className="aspect-[3/4] w-full object-cover"
              />

              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_28%,rgba(0,0,0,0.5)_66%)]" />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="relative h-60 w-60 rounded-[2rem] border border-white/70">
                  <span className="absolute left-4 top-4 h-10 w-10 rounded-tl-2xl border-l-4 border-t-4 border-white" />
                  <span className="absolute right-4 top-4 h-10 w-10 rounded-tr-2xl border-r-4 border-t-4 border-white" />
                  <span className="absolute bottom-4 left-4 h-10 w-10 rounded-bl-2xl border-b-4 border-l-4 border-white" />
                  <span className="absolute bottom-4 right-4 h-10 w-10 rounded-br-2xl border-b-4 border-r-4 border-white" />
                </div>
              </div>

              <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-white/92 p-4 text-zinc-950 shadow-lg backdrop-blur dark:bg-zinc-950/88 dark:text-zinc-50">
                <p className="text-sm font-semibold">{statusText}</p>
                {errorText ? (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-300">
                    {errorText}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Hold the guest pass steady inside the square.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4 rounded-full bg-zinc-200 p-1 dark:bg-zinc-800">
              <div className="grid grid-cols-2 gap-1">
                {(["in", "out"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => updateScanMode(mode)}
                    className={`rounded-full px-4 py-3 text-sm font-semibold transition ${
                      scanMode === mode
                        ? "bg-white text-zinc-950 shadow-sm dark:bg-zinc-50"
                        : "text-zinc-500 dark:text-zinc-400"
                    }`}
                  >
                    {mode === "in" ? "Scan In" : "Scan Out"}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => void startCamera()}
                disabled={isSubmitting}
                className="rounded-full bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950"
              >
                Start
              </button>
              <button
                type="button"
                onClick={stopCamera}
                className="rounded-full border border-zinc-300 px-4 py-3 text-sm font-semibold text-zinc-700 transition dark:border-zinc-700 dark:text-zinc-200"
              >
                Stop
              </button>
            </div>

            <button
              type="button"
              onClick={() => setManualOpen((current) => !current)}
              className="mt-4 text-sm font-semibold text-zinc-500 dark:text-zinc-400"
            >
              {manualOpen ? "Hide manual entry" : "Use manual entry"}
            </button>

            {scannerContext?.pin_required ? (
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  setPinInput("");
                  setPinCode("");
                  setResult(null);
                  setErrorText(null);
                }}
                className="mt-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400"
              >
                Change staff PIN
              </button>
            ) : null}

            {manualOpen ? (
              <div className="mt-3 rounded-3xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="mb-3 rounded-full bg-zinc-100 p-1 dark:bg-zinc-800">
                  <div className="grid grid-cols-2 gap-1">
                    {(["qr", "name"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setLookupMode(mode)}
                        className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                          lookupMode === mode
                            ? "bg-white text-zinc-950 shadow-sm dark:bg-zinc-50"
                            : "text-zinc-500 dark:text-zinc-400"
                        }`}
                      >
                        {mode === "qr" ? "QR payload" : "Full name"}
                      </button>
                    ))}
                  </div>
                </div>

                {lookupMode === "qr" ? (
                  <textarea
                    value={manualInput}
                    onChange={(event) => setManualInput(event.target.value)}
                    className="min-h-24 w-full resize-none rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950"
                    placeholder="Paste QR payload or hash"
                  />
                ) : (
                  <input
                    type="text"
                    value={fullNameInput}
                    onChange={(event) => setFullNameInput(event.target.value)}
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950"
                    placeholder="Type guest full name"
                  />
                )}
                <button
                  type="button"
                  disabled={
                    isSubmitting ||
                    (lookupMode === "qr" ? !manualInput.trim() : !fullNameInput.trim())
                  }
                  onClick={() =>
                    lookupMode === "qr"
                      ? void submitScan(manualInput)
                      : void submitNameScan()
                  }
                  className="mt-3 w-full rounded-full bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950"
                >
                  {lookupMode === "qr" ? "Verify code" : "Find guest"}
                </button>
              </div>
            ) : null}
          </section>
        )}

        <footer className="px-5 pb-5 pt-2 text-center text-xs text-zinc-400">
          powered by <span className="font-semibold text-zinc-600 dark:text-zinc-200">GatherVia</span>
        </footer>
      </div>
    </main>
  );
}
