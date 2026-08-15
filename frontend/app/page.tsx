import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import HeroCarousel from "@/components/hero/HeroCarousel";
import { TemplateGallery } from "@/components/dashboard/TemplateGallery";
import { ActiveNav } from "@/components/landing/ActiveNav";
import { FlyerPreview } from "@/components/landing/FlyerPreview";
import { Footer } from "@/components/landing/Footer";
import { GuestListDemo } from "@/components/landing/GuestListDemo";
import { LandingAnalyticsDemo } from "@/components/landing/LandingAnalyticsDemo";
import { ScrollReveal } from "@/components/landing/ScrollReveal";
import { SectionHeading } from "@/components/landing/SectionHeading";
import { ThemeToggle } from "@/components/landing/ThemeToggle";

export const metadata: Metadata = {
  title: "GatherVia — Create, invite and welcome",
  description:
    "Create digital invitations, organise guest lists and welcome guests smoothly with GatherVia.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "GatherVia",
    title: "GatherVia — Create, invite and welcome",
    description:
      "Beautiful invitations, organised guest lists and smooth event check-in in one connected platform.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "GatherVia invitation and event guest management platform",
      },
    ],
  },
};

const heroImages = [
  {
    src: "/assets/event-hero-1.jpg",
    alt: "Elegant wedding reception",
  },
  {
    src: "/assets/event-hero-2.jpg",
    alt: "Birthday celebration",
  },
  {
    src: "/assets/event-hero-3.jpg",
    alt: "Corporate event entrance",
  },
  {
    src: "/assets/event-hero-4.jpg",
    alt: "Private party",
  },
  {
    src: "/assets/event-hero-5.jpg",
    alt: "Digital event invitation",
  },
  {
    src: "/assets/event-hero-6.jpg",
    alt: "Guests arriving at an event",
  },
];

const workflowSteps = [
  {
    number: "01",
    title: "Create",
    description:
      "Upload your flyer or choose a ready-made invitation template.",
  },
  {
    number: "02",
    title: "Invite",
    description:
      "Add your guests and prepare personalised invitations with QR passes.",
  },
  {
    number: "03",
    title: "Welcome",
    description:
      "Give your entrance team a focused scanner for quick check-in.",
  },
  {
    number: "04",
    title: "Follow",
    description:
      "Track arrivals, pending guests and event activity from one dashboard.",
  },
];

const productRoles = [
  {
    number: "01",
    title: "Organiser workspace",
    description:
      "Manage the invitation, guest list, event details and staff access from one place.",
    items: [
      "Invitation design",
      "Guest categories",
      "Event settings",
    ],
  },
  {
    number: "02",
    title: "Guest experience",
    description:
      "Give each guest a clear invitation with their details and personal access pass.",
    items: [
      "Personalised invitation",
      "Event details",
      "QR access",
    ],
  },
  {
    number: "03",
    title: "Entrance scanner",
    description:
      "Keep the entrance fast with a limited interface built specifically for check-in.",
    items: [
      "Fast scanning",
      "Duplicate warnings",
      "Focused staff access",
    ],
  },
];

const invitationPreviews = [
  {
    imageSrc: "/assets/invitations/gathervia-wedding.webp",
    alt: "Elegant wedding invitation created with GatherVia",
    eyebrow: "Wedding",
    title: "A warm invitation for every guest",
    description:
      "Combine your event design with personalised guest details and a clear QR pass.",
  },
  {
    imageSrc: "/assets/invitations/gathervia-corporate.webp",
    alt: "Corporate event invitation created with GatherVia",
    eyebrow: "Corporate",
    title: "A clean pass for professional events",
    description:
      "Keep the design polished while giving delegates a simple entry experience.",
  },
  {
    imageSrc: "/assets/invitations/gathervia-birthday.webp",
    alt: "Birthday invitation created with GatherVia",
    eyebrow: "Celebration",
    title: "A personal design for memorable moments",
    description:
      "Start with your own creative direction and connect it to the complete guest flow.",
  },
];

const features = [
  {
    number: "01",
    title: "Flexible wording",
    description:
      "Use Guest, Client, Delegate, Invitee or wording that matches your occasion.",
  },
  {
    number: "02",
    title: "Template or upload",
    description:
      "Start with a GatherVia template or upload a flyer you already designed.",
  },
  {
    number: "03",
    title: "Personalised invitations",
    description:
      "Prepare invitations using each guest’s name, category and QR access.",
  },
  {
    number: "04",
    title: "Focused staff access",
    description:
      "Entrance staff only see the information required to welcome guests.",
  },
  {
    number: "05",
    title: "Clear guest statuses",
    description:
      "Organise pending, approved, declined and checked-in guests.",
  },
  {
    number: "06",
    title: "Event insights",
    description:
      "Follow attendance, guest categories and duplicate scan attempts.",
  },
];

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

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-brand-400/10 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center gap-x-4 px-4 sm:px-6 lg:flex-nowrap lg:px-8">
          <Link
            href="#overview"
            aria-label="GatherVia home"
            className="flex shrink-0 items-center gap-3"
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
              Gather<span className="text-brand-400">Via</span>
            </span>
          </Link>

          <ActiveNav />

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <ThemeToggle />

            <Link
              href="/login"
              className="hidden rounded-full px-4 py-2 text-sm font-medium text-foreground/65 transition hover:bg-brand-400/5 hover:text-foreground sm:inline-flex"
            >
              Log in
            </Link>

            <Link
              href="/login?next=/dashboard"
              className="inline-flex min-h-10 items-center justify-center rounded-full bg-brand-400 px-4 text-sm font-semibold text-brand-950 transition hover:-translate-y-0.5 hover:bg-brand-500 hover:shadow-[0_12px_30px_rgba(79,214,190,0.22)] sm:px-5"
            >
              <span className="sm:hidden">Start</span>
              <span className="hidden sm:inline">Start an event</span>
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section
          id="overview"
          className="relative scroll-mt-28 overflow-hidden border-b border-brand-400/10 lg:scroll-mt-20"
        >
          <HeroCarousel
            images={heroImages}
            className="h-[calc(100svh-7rem)] min-h-[600px] sm:h-[82svh] sm:min-h-[650px]"
          />

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/20" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />

          <div className="absolute inset-0 flex items-center py-10 sm:py-12">
            <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
              <ScrollReveal className="w-full max-w-3xl">
                <p className="text-sm font-semibold uppercase tracking-[0.32em] text-brand-400">
                  GatherVia
                </p>

                <h1 className="mt-4 font-display text-4xl font-semibold leading-[0.98] tracking-tight text-white min-[380px]:text-5xl sm:mt-5 sm:text-6xl lg:text-8xl">
                  Create.
                  <br />
                  Invite.
                  <br />
                  <span className="text-brand-400">Welcome.</span>
                </h1>

                <p className="mt-5 w-full max-w-2xl text-sm leading-7 text-white/75 sm:mt-7 sm:text-lg sm:leading-8">
                  Design your invitation, organise every guest and manage event
                  entry from one connected platform.
                </p>

                <div className="pointer-events-auto mt-7 flex flex-col gap-3 sm:mt-9 sm:flex-row">
                  <Link
                    href="/login?next=/dashboard"
                    className="inline-flex min-h-12 items-center justify-center rounded-full bg-brand-400 px-6 text-sm font-semibold text-brand-950 transition hover:-translate-y-0.5 hover:bg-brand-500 hover:shadow-[0_16px_40px_rgba(79,214,190,0.3)]"
                  >
                    Create your event
                  </Link>

                  <Link
                    href="#templates"
                    className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/25 bg-white/5 px-6 text-sm font-semibold text-white backdrop-blur transition hover:border-brand-400/60 hover:bg-brand-400/10"
                  >
                    Explore templates
                  </Link>
                </div>

                <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2.5 text-xs text-white/65 sm:mt-10 sm:gap-x-6 sm:gap-y-3 sm:text-sm">
                  {[
                    "Digital invitations",
                    "Guest management",
                    "QR check-in",
                  ].map((item) => (
                    <span key={item} className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-400/15 text-brand-400">
                        <CheckIcon />
                      </span>
                      {item}
                    </span>
                  ))}
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* Workflow */}
        <section
          id="how-it-works"
          className="scroll-mt-28 border-b border-brand-400/10 bg-section-dim py-16 sm:py-20 lg:scroll-mt-20 lg:py-28"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <SectionHeading
                eyebrow="How it works"
                title="One clear flow for your event"
                description="GatherVia connects the invitation, guest list and entrance instead of treating them as separate tasks."
                align="center"
              />
            </ScrollReveal>

            <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {workflowSteps.map((step, index) => (
                <ScrollReveal
                  key={step.number}
                  delay={`delay-${Math.min(index * 100, 300)}`}
                >
                  <article className="group flex h-full flex-col rounded-3xl border border-brand-400/10 bg-background p-7 shadow-lg transition hover:-translate-y-1 hover:border-brand-400/30">
                    <span className="text-sm font-semibold text-brand-400/65">
                      {step.number}
                    </span>

                    <h3 className="mt-7 text-xl font-semibold">
                      {step.title}
                    </h3>

                    <p className="mt-3 text-sm leading-7 text-foreground/60">
                      {step.description}
                    </p>

                    <div className="mt-auto pt-8">
                      <div className="h-px w-10 bg-brand-400/40 transition-all group-hover:w-full" />
                    </div>
                  </article>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* Product roles */}
        <section
          id="product"
          className="scroll-mt-28 border-b border-brand-400/10 py-16 sm:py-20 lg:scroll-mt-20 lg:py-28"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <SectionHeading
                eyebrow="Connected experience"
                title="The right view for every person"
                description="Organisers manage the event, guests receive a polished invitation and entrance teams get a focused scanning tool."
              />
            </ScrollReveal>

            <div className="mt-12 grid gap-5 lg:grid-cols-3">
              {productRoles.map((role, index) => (
                <ScrollReveal
                  key={role.number}
                  delay={`delay-${Math.min(index * 100, 300)}`}
                >
                  <article className="h-full rounded-[2rem] border border-brand-400/10 bg-brand-400/[0.04] p-7 transition hover:-translate-y-1 hover:border-brand-400/30">
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-400">
                      {role.number}
                    </span>

                    <h3 className="mt-6 text-xl font-semibold">
                      {role.title}
                    </h3>

                    <p className="mt-3 text-sm leading-7 text-foreground/60">
                      {role.description}
                    </p>

                    <ul className="mt-7 space-y-3">
                      {role.items.map((item) => (
                        <li
                          key={item}
                          className="flex items-center gap-3 text-sm text-foreground/75"
                        >
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-400/10 text-brand-400">
                            <CheckIcon />
                          </span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </article>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* Real invitation previews */}
        <section
          id="invitations"
          className="scroll-mt-28 border-b border-brand-400/10 bg-section-dim py-16 sm:py-20 lg:scroll-mt-20 lg:py-28"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <SectionHeading
                eyebrow="Invitation experience"
                title="See the final invitation as your guest will"
                description="Your design stays at the centre while GatherVia connects it to guest details, QR access and event information."
                align="center"
              />
            </ScrollReveal>

            <div className="scrollbar-custom -mx-4 mt-10 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-8 sm:mx-0 sm:mt-14 sm:gap-8 sm:px-0 xl:grid xl:grid-cols-3 xl:overflow-visible">
              {invitationPreviews.map((preview, index) => (
                <ScrollReveal
                  key={preview.title}
                  delay={`delay-${Math.min(index * 100, 300)}`}
                  className="w-[min(86vw,360px)] shrink-0 snap-center xl:w-auto xl:min-w-0"
                >
                  <article className="flex h-full min-w-0 flex-col rounded-[2rem] border border-brand-400/10 bg-background p-4 shadow-xl sm:p-6">
                    <FlyerPreview
                      imageSrc={preview.imageSrc}
                      alt={preview.alt}
                      priority={index === 0}
                      caption={
                        <span>
                          Preview displayed inside the GatherVia mobile pass
                          frame.
                        </span>
                      }
                    />

                    <div className="mt-7">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-400">
                        {preview.eyebrow}
                      </p>

                      <h3 className="mt-3 text-xl font-semibold">
                        {preview.title}
                      </h3>

                      <p className="mt-3 text-sm leading-7 text-foreground/60">
                        {preview.description}
                      </p>
                    </div>
                  </article>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* Shared live templates */}
        <div id="templates" className="scroll-mt-28 lg:scroll-mt-20">
          <TemplateGallery
            variant="landing"
            maximumTemplates={8}
          />
        </div>

        {/* Guest management */}
        <section
          id="guests"
          className="scroll-mt-28 border-b border-brand-400/10 py-16 sm:py-20 lg:scroll-mt-20 lg:py-28"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <SectionHeading
                eyebrow="Guest management"
                title="Know who is coming"
                description="Search, organise and follow every guest from invitation to arrival."
              />
            </ScrollReveal>

            <ScrollReveal
              delay="delay-200"
              className="mt-10 sm:mt-12"
            >
              <GuestListDemo />
            </ScrollReveal>
          </div>
        </section>

        {/* Analytics */}
        <section
          id="analytics"
          className="scroll-mt-28 border-b border-brand-400/10 bg-section-dim py-16 sm:py-20 lg:scroll-mt-20 lg:py-28"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <SectionHeading
                eyebrow="Event insights"
                title="Follow the event as it happens"
                description="Explore sample attendance, arrival and guest-category data through an interactive GatherVia dashboard."
              />
            </ScrollReveal>

            <ScrollReveal
              delay="delay-200"
              className="mt-10 sm:mt-12"
            >
              <LandingAnalyticsDemo />
            </ScrollReveal>
          </div>
        </section>

        {/* Features */}
        <section
          id="features"
          className="scroll-mt-28 border-b border-brand-400/10 py-16 sm:py-20 lg:scroll-mt-20 lg:py-28"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <SectionHeading
                eyebrow="Built around your event"
                title="The essentials stay together"
                description="From the first design choice to the final guest arrival, GatherVia keeps the workflow connected."
              />
            </ScrollReveal>

            <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {features.map((feature, index) => (
                <ScrollReveal
                  key={feature.number}
                  delay={`delay-${Math.min((index % 3) * 100, 300)}`}
                >
                  <article className="h-full rounded-3xl border border-brand-400/10 bg-brand-400/[0.035] p-6 transition hover:-translate-y-1 hover:border-brand-400/30 hover:bg-brand-400/[0.06]">
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-400">
                      {feature.number}
                    </span>

                    <h3 className="mt-5 text-xl font-semibold">
                      {feature.title}
                    </h3>

                    <p className="mt-3 text-sm leading-7 text-foreground/60">
                      {feature.description}
                    </p>
                  </article>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-28">
          <ScrollReveal className="mx-auto max-w-7xl">
            <div className="feature-panel relative overflow-hidden rounded-[2rem] border px-5 py-14 text-center sm:rounded-[2.5rem] sm:px-10 sm:py-16 lg:py-20">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(79,214,190,0.18),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(79,214,190,0.08),transparent_32%)]" />

              <div className="relative mx-auto max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.26em] text-brand-400">
                  Your event, connected
                </p>

                <h2 className="mt-5 font-display text-3xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                  Bring every guest together with GatherVia.
                </h2>

                <p className="feature-panel-muted mx-auto mt-6 max-w-2xl text-base leading-8">
                  Begin with your own flyer or choose a template, then
                  organise the complete guest experience in one place.
                </p>

                <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
                  <Link
                    href="/login?next=/dashboard"
                    className="inline-flex min-h-12 items-center justify-center rounded-full bg-brand-400 px-7 text-sm font-semibold text-brand-950 transition hover:-translate-y-0.5 hover:bg-brand-500"
                  >
                    Start creating
                  </Link>

                  <Link
                    href="#templates"
                    className="feature-panel-secondary inline-flex min-h-12 items-center justify-center rounded-full border px-7 text-sm font-semibold transition hover:-translate-y-0.5 hover:border-brand-400/60 hover:bg-brand-400/10"
                  >
                    View templates
                  </Link>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </section>
      </main>

      <Footer />
    </div>
  );
}
