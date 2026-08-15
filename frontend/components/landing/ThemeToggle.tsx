"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggle({ className = "", showLabel = false }: ThemeToggleProps) {
  const { resolvedTheme, isReady, toggleTheme } = useTheme();
  const switchesTo = resolvedTheme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-brand-400/20 bg-background/70 px-3 text-brand-400 shadow-sm backdrop-blur transition hover:border-brand-400/40 hover:bg-brand-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${className}`}
      aria-label={`Switch to ${switchesTo} theme`}
      title={`Switch to ${switchesTo} theme`}
      data-ready={isReady ? "true" : "false"}
      suppressHydrationWarning
    >
      {resolvedTheme === "dark" ? (
        <Sun aria-hidden="true" className="h-5 w-5" strokeWidth={2} />
      ) : (
        <Moon aria-hidden="true" className="h-5 w-5" strokeWidth={2} />
      )}
      {showLabel ? (
        <span className="text-sm font-medium" suppressHydrationWarning>
          {resolvedTheme === "dark" ? "Light" : "Dark"}
        </span>
      ) : null}
    </button>
  );
}
