"use client";

import { useEffect, useState } from "react";

const navItems = [
  {
    id: "how-it-works",
    href: "#how-it-works",
    label: "How it works",
  },
  {
    id: "invitations",
    href: "#invitations",
    label: "Invitations",
  },
  {
    id: "templates",
    href: "#templates",
    label: "Templates",
  },
  {
    id: "guests",
    href: "#guests",
    label: "Guests",
  },
  {
    id: "analytics",
    href: "#analytics",
    label: "Analytics",
  },
] as const;

type NavigationSectionId = (typeof navItems)[number]["id"];

export function ActiveNav() {
  const [activeSection, setActiveSection] =
    useState<NavigationSectionId>(navItems[0].id);

  useEffect(() => {
    let animationFrame: number | null = null;

    const updateActiveSection = () => {
      animationFrame = null;

      const activePoint = Math.min(
        180,
        Math.max(100, window.innerHeight * 0.22),
      );

      let nextSection: NavigationSectionId = navItems[0].id;

      for (const item of navItems) {
        const section = document.getElementById(item.id);

        if (!section) continue;

        const bounds = section.getBoundingClientRect();

        if (
          bounds.top <= activePoint &&
          bounds.bottom > activePoint
        ) {
          nextSection = item.id;
          break;
        }

        if (bounds.top <= activePoint) {
          nextSection = item.id;
        }
      }

      setActiveSection((current) =>
        current === nextSection ? current : nextSection,
      );
    };

    const requestUpdate = () => {
      if (animationFrame !== null) return;

      animationFrame =
        window.requestAnimationFrame(updateActiveSection);
    };

    updateActiveSection();

    window.addEventListener("scroll", requestUpdate, {
      passive: true,
    });

    window.addEventListener("resize", requestUpdate);

    return () => {
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);

      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }
    };
  }, []);

  return (
    <nav
      aria-label="Landing page navigation"
      className="scrollbar-none order-last -mx-4 flex w-[calc(100%+2rem)] items-center gap-1 overflow-x-auto border-t border-brand-400/10 px-4 py-2 lg:order-none lg:mx-0 lg:w-auto lg:flex-1 lg:justify-center lg:overflow-visible lg:border-0 lg:px-0 lg:py-0"
    >
      {navItems.map((item) => {
        const isActive = activeSection === item.id;

        return (
          <a
            key={item.id}
            href={item.href}
            aria-current={isActive ? "location" : undefined}
            className={[
              "relative min-h-10 shrink-0 rounded-full px-3 py-2 text-sm sm:px-4",
              "transition-colors duration-200",
              "focus-visible:outline-none",
              "focus-visible:ring-2",
              "focus-visible:ring-brand-400",
              isActive
                ? "font-medium text-brand-400"
                : "text-foreground/55 hover:bg-brand-400/5 hover:text-foreground",
            ].join(" ")}
          >
            {item.label}

            <span
              aria-hidden="true"
              className={[
                "absolute inset-x-3 bottom-0 h-0.5 sm:inset-x-4 lg:-bottom-[17px]",
                "rounded-full bg-brand-400",
                "transition-all duration-300",
                isActive
                  ? "scale-x-100 opacity-100"
                  : "scale-x-0 opacity-0",
              ].join(" ")}
            />
          </a>
        );
      })}
    </nav>
  );
}
