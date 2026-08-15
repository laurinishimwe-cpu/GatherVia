import Link, { type LinkProps } from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import {
  getButtonClasses,
  type ButtonSize,
  type ButtonVariant,
} from "@/components/ui/Button";

type NativeAnchorProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">;

interface ButtonLinkProps extends LinkProps, NativeAnchorProps {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function ButtonLink({
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={getButtonClasses({ variant, size, className })} {...props}>
      {children}
    </Link>
  );
}
