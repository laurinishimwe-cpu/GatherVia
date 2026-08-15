import type { WordingDictionary } from "@/lib/types/event";

const PLACEHOLDER_PATTERN = /\{(\w+)\}/g;

export function interpolateWording(
  template: string,
  dictionary: WordingDictionary,
  extra: Record<string, string | number> = {},
): string {
  return template.replace(PLACEHOLDER_PATTERN, (_, key: string) => {
    if (key in extra) {
      return String(extra[key]);
    }
    if (key in dictionary) {
      return dictionary[key];
    }
    return `{${key}}`;
  });
}
