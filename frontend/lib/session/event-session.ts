import {
  ACTIVE_EVENT_COOKIE,
  EVENT_LOCALE_COOKIE,
  EVENT_SESSION_STORAGE_KEY,
} from "@/lib/constants/cookies";
import type { EventSessionPayload } from "@/lib/types/event";

export function readStoredSession(): EventSessionPayload | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.sessionStorage.getItem(EVENT_SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as EventSessionPayload;
  } catch {
    return null;
  }
}

export function persistSession(payload: EventSessionPayload): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    EVENT_SESSION_STORAGE_KEY,
    JSON.stringify(payload),
  );

  document.cookie = `${ACTIVE_EVENT_COOKIE}=${payload.event.id}; path=/; SameSite=Lax`;
  document.cookie = `${EVENT_LOCALE_COOKIE}=${payload.language}; path=/; SameSite=Lax`;
}

export function clearStoredSession(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(EVENT_SESSION_STORAGE_KEY);
  document.cookie = `${ACTIVE_EVENT_COOKIE}=; path=/; max-age=0`;
  document.cookie = `${EVENT_LOCALE_COOKIE}=; path=/; max-age=0`;
}

export function buildSessionPayload(
  event: import("@/lib/types/event").EventRecord,
): EventSessionPayload {
  return {
    event,
    language: event.configuration.ui_language,
    wording: event.configuration.wording_dictionary,
  };
}
