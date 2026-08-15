"use client";

import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";

import { ThemeToggle } from "@/components/landing/ThemeToggle";

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

const experienceItems = [
  {
    number: "01",
    title: "Create",
    description:
      "Upload your own flyer or begin with a GatherVia template.",
  },
  {
    number: "02",
    title: "Invite",
    description:
      "Organise your guests and prepare personalised invitations.",
  },
  {
    number: "03",
    title: "Welcome",
    description:
      "Manage guest entry with clear QR passes and focused check-in.",
  },
];

function BackIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m15 18-6-6 6-6"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m5 12 4 4L19 6"
      />
    </svg>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
}: AuthShellProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sticky authentication header */}
      <header className="sticky top-0 z-50 border-b border-brand-400/10 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            aria-label="GatherVia home"
            className="flex items-center gap-3"
          >
            <Image
              src="/gathervia-mark.svg"
              alt=""
              width={32}
              height={32}
              priority
              className="h-8 w-8"
            />

            <span className="text-base font-semibold tracking-tight">
              Gather
              <span className="text-brand-400">
                Via
              </span>
            </span>
          </Link>

          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-16 pt-7 sm:px-6 sm:pt-9 lg:px-8 lg:pb-20">
        {/* Back action inside the page */}
        <Link
          href="/"
          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-brand-400/15 bg-brand-400/[0.04] px-4 text-sm font-medium text-foreground/65 transition hover:border-brand-400/35 hover:bg-brand-400/10 hover:text-foreground"
        >
          <BackIcon />
          Back to home
        </Link>

        <div className="mt-7 grid gap-7 lg:grid-cols-[minmax(0,1.05fr)_minmax(400px,0.75fr)] lg:items-stretch">
          {/* GatherVia introduction card */}
          <section className="feature-panel relative overflow-hidden rounded-[2rem] border p-7 sm:p-9 lg:min-h-[610px] lg:p-11">
  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(79,214,190,0.18),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(79,214,190,0.08),transparent_34%)]" />

  <div className="relative flex h-full flex-col">
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-400">
        GatherVia
      </p>

      <h1 className="mt-6 font-display text-5xl font-semibold leading-[0.98] tracking-tight sm:text-6xl">
        Create.
        <br />
        Invite.
        <br />
        <span className="text-brand-400">
          Welcome.
        </span>
      </h1>

      <p className="feature-panel-muted mt-7 max-w-xl text-base leading-8">
        Design your invitation, organise every guest and manage
        event entry from one connected platform.
      </p>
    </div>

    <div className="mt-10 grid gap-3 sm:grid-cols-3 lg:mt-auto lg:pt-12">
      {experienceItems.map((item) => (
        <article
          key={item.number}
          className="feature-panel-card rounded-2xl border p-4 backdrop-blur"
        >
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-400">
            {item.number}
          </span>

          <h2 className="mt-3 text-sm font-semibold">
            {item.title}
          </h2>

          <p className="feature-panel-muted mt-2 text-xs leading-5">
            {item.description}
          </p>
        </article>
      ))}
    </div>

    <div className="feature-panel-muted mt-7 flex flex-wrap gap-x-5 gap-y-3 text-xs">
      {[
        "Digital invitations",
        "Guest management",
        "QR check-in",
      ].map((item) => (
        <span
          key={item}
          className="flex items-center gap-2"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-400/15 text-brand-400">
            <CheckIcon />
          </span>

          {item}
        </span>
      ))}
    </div>
  </div>
</section>

          {/* Authentication card */}
          <section className="flex min-h-[610px] flex-col rounded-[2rem] border border-brand-400/15 bg-background p-6 shadow-2xl sm:p-8">
            <div className="border-b border-brand-400/10 pb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-400">
                Your GatherVia account
              </p>

              <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
                {title}
              </h2>

              <p className="mt-3 text-sm leading-6 text-foreground/55">
                {subtitle}
              </p>
            </div>

            <div className="flex flex-1 flex-col justify-center py-7">
              {children}
            </div>

            <p className="border-t border-brand-400/10 pt-5 text-center text-xs leading-5 text-foreground/40">
              By continuing, you agree to use GatherVia
              responsibly for your event and invited guests.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
