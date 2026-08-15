import type {
  TemplateCategory,
} from "@/lib/types/flyer";

export interface TemplateCategoryOption {
  value: TemplateCategory;
  label: string;
  eyebrow: string;
}

export const TEMPLATE_CATEGORIES = [
  {
    value: "wedding",
    label: "Wedding",
    eyebrow: "Wedding invitations",
  },
  {
    value: "corporate",
    label: "Corporate",
    eyebrow: "Corporate events",
  },
  {
    value: "birthday",
    label: "Birthday",
    eyebrow: "Birthday invitations",
  },
  {
    value: "party",
    label: "Party",
    eyebrow: "Party invitations",
  },
  {
    value: "conference",
    label: "Conference",
    eyebrow: "Conference passes",
  },
  {
    value: "gala",
    label: "Gala",
    eyebrow: "Gala invitations",
  },
  {
    value: "other",
    label: "Other",
    eyebrow: "Other event invitations",
  },
] as const satisfies ReadonlyArray<TemplateCategoryOption>;

export function getTemplateCategoryLabel(
  category: TemplateCategory,
): string {
  return (
    TEMPLATE_CATEGORIES.find(
      (item) =>
        item.value === category,
    )?.label ?? category
  );
}
