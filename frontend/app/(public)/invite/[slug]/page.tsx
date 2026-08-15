"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { fetchPublicEventBySlug } from "@/lib/api/public-events";

export default function PublicInvitePage() {
  const params = useParams();
  const slug = params.slug as string;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [eventTitle, setEventTitle] = useState("Event RSVP");

  useEffect(() => {
    let cancelled = false;
    fetchPublicEventBySlug(slug)
      .then((payload) => {
        if (!cancelled) setEventTitle(payload.event.title);
      })
      .catch(() => {
        if (!cancelled) setEventTitle("Event RSVP");
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter your full name.");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/guests/register/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: name, email: email || null, phone: phone || null }),
      });
      if (!res.ok) throw new Error("Registration failed");
      setSubmitted(true);
    } catch (err) {
      setError("Could not register. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rounded-3xl border border-brand-400/10 bg-background/80 backdrop-blur-xl p-8 shadow-2xl">
        <div className="mb-6 border-b border-brand-400/10 pb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-400">
            {eventTitle}
          </p>
          <p className="mt-1 text-xs text-foreground/45">
            powered by <span className="font-semibold text-foreground/70">GatherVia</span>
          </p>
        </div>
        {submitted ? (
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-brand-400/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold">Registration sent!</h2>
            <p className="text-sm text-foreground/60">
              Your invitation is pending approval. You'll receive a QR pass once the host confirms.
            </p>
          </div>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-400">RSVP</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Confirm your attendance</h2>
            <p className="mt-1 text-sm text-foreground/60">Enter your details to receive a unique QR pass.</p>
            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Full name</span>
                <input
                  type="text" required value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-brand-400/20 bg-background px-3 py-2.5 text-sm outline-none focus:border-brand-400/50"
                  placeholder="Alexander Wright"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Email (optional)</span>
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-brand-400/20 bg-background px-3 py-2.5 text-sm outline-none focus:border-brand-400/50"
                  placeholder="you@example.com"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Phone (optional)</span>
                <input
                  type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-xl border border-brand-400/20 bg-background px-3 py-2.5 text-sm outline-none focus:border-brand-400/50"
                  placeholder="+1 555 123 4567"
                />
              </label>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <button
                type="submit" disabled={isLoading}
                className="w-full rounded-full bg-brand-400 py-3 text-sm font-semibold text-black transition hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(79,214,190,0.3)] disabled:opacity-50"
              >
                {isLoading ? "Sending…" : "Confirm attendance"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
