"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Image from "next/image";

import { useAuth } from "@/context/AuthContext";
import type { SupportedLanguage } from "@/lib/types/auth";

const languages: { code: SupportedLanguage; label: string; flagSrc: string }[] = [
  { code: "en", label: "English", flagSrc: "/flags/en.svg" },
  { code: "fr", label: "Français", flagSrc: "/flags/fr.svg" },
  { code: "es", label: "Español", flagSrc: "/flags/es.svg" },
  { code: "de", label: "Deutsch", flagSrc: "/flags/de.svg" },
];

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isHydrated, setPreferredLanguage } = useAuth();
  const nextPath = searchParams.get("next") ?? "/dashboard";
  const [selected, setSelected] = useState<SupportedLanguage | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (!isHydrated || !user?.needs_language_selection) return;
    const browserLang = navigator.language.slice(0, 2) as SupportedLanguage;
    const match = languages.find((l) => l.code === browserLang);
    if (match) setSelected(match.code);
  }, [isHydrated, user]);

  useEffect(() => {
    if (hasRedirected.current) return;
    if (isHydrated && user && !user.needs_language_selection) {
      hasRedirected.current = true;
      router.replace(nextPath);
    }
  }, [isHydrated, user, nextPath, router]);

  if (!isHydrated || (user && !user.needs_language_selection && !hasRedirected.current)) {
    return null;
  }

  const handleContinue = async () => {
    if (!selected || isSaving) return;
    setIsSaving(true);
    try {
      await setPreferredLanguage(selected);
      router.replace(nextPath);
    } catch {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full max-w-sm rounded-3xl border border-brand-400/10 bg-background/80 backdrop-blur-xl p-8 shadow-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-400">
        Language
      </p>
      <h2 className="mt-2 text-1lg font-semibold tracking-tight">
        Choose your favorite language
      </h2>
      <p className="mt-1 text-sm text-foreground/60">
        This sets the default wording for your events.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        {languages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => setSelected(lang.code)}
            className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition ${
              selected === lang.code
                ? "border-brand-400/50 bg-brand-400/10"
                : "border-brand-400/20 bg-brand-400/5 hover:bg-brand-400/10"
            }`}
          >
            <Image
              src={lang.flagSrc}
              alt={lang.label}
              width={28}
              height={20}
              className="rounded-sm"
            />
            <span className="text-sm font-medium">{lang.label}</span>
          </button>
        ))}
      </div>

      <button
        onClick={handleContinue}
        disabled={!selected || isSaving}
        className="mt-6 w-full rounded-full bg-brand-400 py-3 text-sm font-semibold text-black transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(79,214,190,0.35)] disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isSaving ? "Saving…" : "Continue"}
      </button>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading…</div>}>
      <OnboardingContent />
    </Suspense>
  );
}