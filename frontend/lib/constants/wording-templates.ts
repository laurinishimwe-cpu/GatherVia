export const WORDING_TEMPLATES = {
  add_guest_button: "Add {guest_label_singular} +",
  manage_guests_heading: "Manage {guest_label_plural}",
  guest_list_empty: "No {guest_label_plural} yet. Invite your first {guest_label_singular}.",
  check_in_cta: "Check in {guest_label_singular}",
  total_guests_label: "Total {guest_label_plural}",
  editor_canvas_title: "{guest_label_singular} experience canvas",
} as const;

export type WordingTemplateKey = keyof typeof WORDING_TEMPLATES;

export const DEFAULT_WORDING: import("@/lib/types/event").WordingDictionary = {
  guest_label_singular: "Guest",
  guest_label_plural: "Guests",
};
