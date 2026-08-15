import type { ReactNode } from "react";

interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  action?: ReactNode;
  className?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  action,
  className = "",
}: SectionHeadingProps) {
  const alignment = align === "center" ? "mx-auto text-center" : "";

  return (
    <div className={`flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between ${className}`}>
      <div className={`max-w-2xl ${alignment}`}>
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-400">
            {eyebrow}
          </p>
        ) : null}
        <h2 className={`${eyebrow ? "mt-4" : ""} text-2xl font-semibold tracking-tight min-[380px]:text-3xl sm:text-4xl`}>
          {title}
        </h2>
        {description ? (
          <p className="mt-4 text-sm leading-7 text-foreground/70 sm:text-base">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
