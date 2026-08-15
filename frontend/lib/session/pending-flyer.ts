import type { FlyerTemplate } from "@/lib/types/flyer";

const TEMPLATE_KEY = "pendingFlyerTemplate";

export function storePendingTemplate(template: FlyerTemplate) {
  sessionStorage.setItem(TEMPLATE_KEY, JSON.stringify(template));
}

export function consumePendingTemplate(): FlyerTemplate | null {
  const raw = sessionStorage.getItem(TEMPLATE_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(TEMPLATE_KEY);
  try {
    return JSON.parse(raw) as FlyerTemplate;
  } catch {
    return null;
  }
}
