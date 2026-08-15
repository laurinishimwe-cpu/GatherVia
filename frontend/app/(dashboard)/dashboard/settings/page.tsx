"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import type { SupportedLanguage } from "@/lib/types/auth";

const languages: { code: SupportedLanguage; label: string; flagSrc: string }[] = [
  { code: "en", label: "English", flagSrc: "/flags/en.svg" },
  { code: "fr", label: "Français", flagSrc: "/flags/fr.svg" },
  { code: "es", label: "Español", flagSrc: "/flags/es.svg" },
  { code: "de", label: "Deutsch", flagSrc: "/flags/de.svg" },
];

export default function SettingsPage() {
  const router = useRouter();
  const { user, isHydrated, setPreferredLanguage } = useAuth();
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [saved, setSaved] = useState(false);

  // Detect current theme
  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "light") setTheme("light");
    else {
      const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
      setTheme(prefersLight ? "light" : "dark");
    }
  }, []);

  // Set current language from user
  useEffect(() => {
    if (user?.preferred_language) {
      setSelectedLanguage(user.preferred_language);
    }
  }, [user]);

  if (!isHydrated) return null;

  const handleSaveLanguage = async () => {
    if (!selectedLanguage || isSaving) return;
    setIsSaving(true);
    try {
      await setPreferredLanguage(selectedLanguage);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // error handled in context
    } finally {
      setIsSaving(false);
    }
  };

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    if (next === "light") {
      document.documentElement.classList.add("theme-light");
    } else {
      document.documentElement.classList.remove("theme-light");
    }
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-2xl space-y-8 py-8">
        <div>
          <h1 className="text-2xl font-semibold">System settings</h1>
          <p className="mt-1 text-sm text-foreground/60">
            Manage your language preference and appearance.
          </p>
        </div>

        {/* Language card */}
        <div className="rounded-2xl border border-brand-400/10 bg-background p-6 space-y-4">
          <h2 className="text-lg font-semibold">Language</h2>
          <p className="text-sm text-foreground/60">
            Choose your preferred language. This sets the default wording for your events.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => setSelectedLanguage(lang.code)}
                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                  selectedLanguage === lang.code
                    ? "border-brand-400/50 bg-brand-400/10"
                    : "border-brand-400/20 bg-brand-400/5 hover:bg-brand-400/10"
                }`}
              >
                <Image
                  src={lang.flagSrc}
                  alt={lang.label}
                  width={24}
                  height={18}
                  className="rounded-sm"
                />
                <span className="text-sm font-medium">{lang.label}</span>
              </button>
            ))}
          </div>
          <button
            onClick={handleSaveLanguage}
            disabled={!selectedLanguage || isSaving || selectedLanguage === user?.preferred_language}
            className="rounded-full bg-brand-400 px-5 py-2.5 text-sm font-semibold text-black transition hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(79,214,190,0.3)] disabled:opacity-40"
          >
            {saved ? "Saved!" : isSaving ? "Saving…" : "Save language"}
          </button>
        </div>

        {/* Theme card */}
        <div className="rounded-2xl border border-brand-400/10 bg-background p-6 space-y-4">
          <h2 className="text-lg font-semibold">Appearance</h2>
          <p className="text-sm text-foreground/60">
            Switch between dark and light mode.
          </p>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {theme === "dark" ? "Dark mode" : "Light mode"}
            </span>
            <button
              onClick={toggleTheme}
              className={`relative w-14 h-7 rounded-full transition ${
                theme === "dark" ? "bg-brand-400" : "bg-foreground/20"
              }`}
            >
              <span
                className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white transition-transform ${
                  theme === "dark" ? "translate-x-0" : "translate-x-7"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-foreground/60 hover:text-foreground transition"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to dashboard
        </button>
      </div>
    </DashboardLayout>
  );
}
