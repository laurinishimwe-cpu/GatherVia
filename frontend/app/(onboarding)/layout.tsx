import Link from "next/link";
import type { ReactNode } from "react";
import { UserMenu } from "@/components/layout/UserMenu";

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      {/* Subtle gradient */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,var(--grad-1),transparent_28%),radial-gradient(circle_at_top_right,var(--grad-2),transparent_24%),linear-gradient(180deg,var(--grad-bg-start)_0%,var(--grad-bg-end)_100%)]" />

      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        {/* Header – brand logo + user menu */}
        <header className="flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-3 text-sm font-semibold tracking-[0.2em]"
          >
            <span className="h-3 w-3 rounded-full bg-brand-400 shadow-[0_0_0_6px_rgba(79,214,190,0.15)]" />
            <span>GatherVia</span>
          </Link>

          <div className="flex items-center gap-4">
            <span className="rounded-full border border-brand-400/10 bg-brand-400/5 px-4 py-2 text-xs uppercase tracking-[0.18em] text-foreground/60">
              Setup
            </span>
            <UserMenu />   {/* ← now clickable, with Sign Out */}
          </div>
        </header>

        <div className="flex flex-1 items-center justify-center">{children}</div>
      </div>
    </div>
  );
}
