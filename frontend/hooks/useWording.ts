"use client";

import { useEventContext } from "@/context/EventContext";
import type { WordingTemplateKey } from "@/lib/constants/wording-templates";

export function useWording(
  templateKey: WordingTemplateKey,
  extra?: Record<string, string | number>,
): string {
  const { translate } = useEventContext();
  return translate(templateKey, extra);
}
