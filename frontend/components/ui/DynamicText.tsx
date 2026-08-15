"use client";

import type { HTMLAttributes } from "react";

import { useWording } from "@/hooks/useWording";
import type { WordingTemplateKey } from "@/lib/constants/wording-templates";

interface DynamicTextProps extends HTMLAttributes<HTMLElement> {
  templateKey: WordingTemplateKey;
  extra?: Record<string, string | number>;
  as?: keyof HTMLElementTagNameMap;
}

export function DynamicText({
  templateKey,
  extra,
  as: Tag = "span",
  className,
  ...props
}: DynamicTextProps) {
  const text = useWording(templateKey, extra);

  return (
    <Tag className={className} {...props}>
      {text}
    </Tag>
  );
}
