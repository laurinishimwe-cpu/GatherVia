"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";

import {
  fetchAdminRsvpContext,
  requestAdminAccess,
} from "@/lib/api/communications";

export default function AdminRsvpPage() {
  const params = useParams<{ eventId?: string | string[] }>();
  const eventId = Array.isArray(params.eventId)
    ? params.eventId[0] ?? ""
    : params.eventId ?? "";
  const [eventTitle, setEventTitle] = useState("Admin access");
  const [adminName, setAdminName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!eventId) return;

    let cancelled = false;
    fetchAdminRsvpContext(eventId)
      .then((context) => {
        if (!cancelled) setEventTitle(context.event_title);
      })
      .catch(() => {
        if (!cancelled) setError("This admin request link is not available.");
      });

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const name = adminName.trim();
    if (!name) {
      setError("Please enter your name.");
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      await requestAdminAccess(eventId, { admin_name: name });
      setSubmitted(true);
    } catch {
      setError("Could not send this request. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8 text-foreground">
      <div className="w-full max-w-md rounded-3xl border border-brand-400/10 bg-background/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="mb-6 border-b border-brand-400/10 pb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-400">
            {eventTitle}
          </p>
          <p className="mt-1 text-xs text-foreground/45">
            powered by <span className="font-semibold text-foreground/70">GatherVia</span>
          </p>
        </div>

        {submitted ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-400/20">
              <svg
                className="h-8 w-8 text-brand-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold">Request sent</h1>
            <p className="text-sm text-foreground/60">
              The host will approve your scanner access before the link becomes active.
            </p>
          </div>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-400">
              Admin RSVP
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              Request scanner access
            </h1>
            <p className="mt-1 text-sm text-foreground/60">
              Enter your name so the host can approve and track your door activity.
            </p>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Admin name</span>
                <input
                  type="text"
                  required
                  value={adminName}
                  onChange={(event) => setAdminName(event.target.value.slice(0, 64))}
                  className="w-full rounded-xl border border-brand-400/20 bg-background px-3 py-2.5 text-sm outline-none focus:border-brand-400/50"
                  placeholder="Main Entrance"
                />
              </label>

              {error ? <p className="text-sm text-red-400">{error}</p> : null}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-full bg-brand-400 py-3 text-sm font-semibold text-black transition hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(79,214,190,0.3)] disabled:opacity-50"
              >
                {isLoading ? "Sending..." : "Request access"}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
