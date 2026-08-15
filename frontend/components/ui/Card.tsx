import type { HTMLAttributes, ReactNode } from "react";

export type CardVariant = "default" | "soft" | "outlined" | "danger";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: CardVariant;
}

const variantClasses: Record<CardVariant, string> = {
  default: "premium-panel",
  soft: "premium-panel-soft",
  outlined: "border border-brand-400/15 bg-background/70 shadow-sm backdrop-blur",
  danger: "border border-red-400/20 bg-red-400/5 shadow-sm",
};

export function Card({
  children,
  variant = "soft",
  className = "",
  ...props
}: CardProps) {
  return (
    <div className={`${variantClasses[variant]} rounded-[28px] p-6 ${className}`} {...props}>
      {children}
    </div>
  );
}
