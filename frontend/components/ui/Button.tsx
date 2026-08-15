import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

const baseClasses =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-[0.01em] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-400 text-brand-950 shadow-[0_14px_36px_rgba(79,214,190,0.18)] hover:-translate-y-0.5 hover:bg-brand-200 hover:shadow-[0_18px_44px_rgba(79,214,190,0.24)]",
  secondary:
    "border border-brand-400/20 bg-background/70 text-foreground shadow-sm backdrop-blur hover:border-brand-400/40 hover:bg-brand-400/10",
  ghost: "text-foreground/70 hover:bg-brand-400/10 hover:text-foreground",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "min-h-9 px-4 text-xs",
  md: "min-h-11 px-5 py-2.5 text-sm",
  lg: "min-h-12 px-6 py-3 text-base",
};

export function getButtonClasses({
  variant = "primary",
  size = "md",
  className = "",
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button type={type} className={getButtonClasses({ variant, size, className })} {...props}>
      {children}
    </button>
  );
}
