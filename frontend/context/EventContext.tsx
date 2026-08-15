"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { handler } from "@/lib/api/api";
import { createMockEvent, fetchEventById, normalizeEvent, updateEvent as persistEventUpdate } from "@/lib/api/events";
import {
  WORDING_TEMPLATES,
  type WordingTemplateKey,
} from "@/lib/constants/wording-templates";
import {
  buildSessionPayload,
  clearStoredSession,
  persistSession,
  readStoredSession,
} from "@/lib/session/event-session";
import type { EventRecord, WordingDictionary } from "@/lib/types/event";
import { interpolateWording } from "@/lib/wording/interpolate";
import type { SupportedLanguage } from "@/lib/types/auth";
import { useAuth } from "@/context/AuthContext";

interface EventContextValue {
  activeEvent: EventRecord | null;
  language: string;
  wording: WordingDictionary;
  isLoading: boolean;
  error: string | null;
  isHydrated: boolean;
  initializeEvent: (eventId: string) => Promise<void>;
  bootstrapDemoEvent: (
    eventType?: EventRecord["event_type"],
    language?: SupportedLanguage,
  ) => void;
  // LOCAL draft creation (no API call)
  createDraftEvent: (name: string, eventType: string) => string;
  // REAL event creation (POST to /api/v1/events)
  createRealEvent: (title: string, eventType: string) => Promise<string>;
  updateEvent: (updates: Partial<EventRecord>) => void;
  saveEventSettings: (updates: Partial<EventRecord>) => Promise<void>;
  restoreSession: () => Promise<void>;
  clearSession: () => void;
  translate: (
    templateKey: WordingTemplateKey,
    extra?: Record<string, string | number>,
  ) => string;
}

const EventContext = createContext<EventContextValue | undefined>(undefined);

interface EventProviderProps {
  children: ReactNode;
}

export function EventProvider({ children }: EventProviderProps) {
  const [activeEvent, setActiveEvent] = useState<EventRecord | null>(null);
  const [language, setLanguage] = useState("en");
  const [wording, setWording] = useState<WordingDictionary>({
    guest_label_singular: "Guest",
    guest_label_plural: "Guests",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  
  const { user } = useAuth();
  const { refreshToken } = useAuth(); // NEW

  // ── Apply event to state and session ──────────────
  const applySession = useCallback((event: EventRecord) => {
    const payload = buildSessionPayload(event);
    setActiveEvent(event);
    setLanguage(payload.language);
    setWording(payload.wording);
    persistSession(payload);
  }, []);

  // ── Initialize an existing event (tolerates 404) ──
  const initializeEvent = useCallback(
    async (eventId: string) => {
      if (!/^[a-f\d]{24}$/i.test(eventId)) {
        if (activeEvent?.id === eventId) {
          return;
        }

        const stored = readStoredSession();
        if (stored?.event?.id === eventId) {
          applySession(normalizeEvent(stored.event));
          return;
        }

        console.debug("Local UUID event – no backend fetch needed:", eventId);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const event = await fetchEventById(eventId);
        const normalizedEvent = normalizeEvent(event);
        applySession(normalizedEvent);
      } catch {
        console.warn("Event not found, using local draft if available", eventId);
      } finally {
        setIsLoading(false);
      }
    },
    [activeEvent?.id, applySession],
  );

  // ── LOCAL draft creation (no API call) ────────────
  const createDraftEvent = useCallback(
    (name: string, eventType: string): string => {
      const id = crypto.randomUUID();
      const lang = (user?.preferred_language as SupportedLanguage) ?? "en";
      const wordingByType: Record<string, WordingDictionary> = {
        corporate: { guest_label_singular: "Client", guest_label_plural: "Clients" },
        marriage: { guest_label_singular: "Guest", guest_label_plural: "Guests" },
        private: { guest_label_singular: "Invitee", guest_label_plural: "Invitees" },
        conference: { guest_label_singular: "Delegate", guest_label_plural: "Delegates" },
        gala: { guest_label_singular: "Guest", guest_label_plural: "Guests" },
        other: { guest_label_singular: "Attendee", guest_label_plural: "Attendees" },
      };

      const draft = createMockEvent({
        id,
        title: name,
        event_type: eventType as EventRecord["event_type"],
        event_date: "",
        configuration: {
          ui_language: lang,
          wording_dictionary: wordingByType[eventType] ?? wordingByType.other,
          allowed_admin_fields: ["name", "category"],
          invitation_categories_enabled: true,
          invitation_categories: ["General", "VIP"],
        },
      });

      const normalizedEvent = normalizeEvent(draft);
      applySession(normalizedEvent);
      return id;
    },
    [user?.preferred_language, applySession],
  );

  // ── REAL event creation (POST to API) ─────────────
  const createRealEvent = useCallback(
    async (title: string, eventType: string): Promise<string> => {
      // Refresh token before making the API call
      try {
        await refreshToken();
      } catch {
        throw new Error("Session expired. Please log in again.");
      }

      setIsLoading(true);
      setError(null);
      try {
        const rawEvent = await handler<EventRecord>("/api/v1/events", {
          method: "POST",
          auth: true,
          json: { title, event_type: eventType },
        });
        let event = normalizeEvent(rawEvent);
        const pendingSettings = activeEvent && !/^[a-f\d]{24}$/i.test(activeEvent.id)
          ? activeEvent
          : null;

        if (pendingSettings?.event_date) {
          const settings = {
            title: pendingSettings.title,
            event_type: pendingSettings.event_type,
            event_date: pendingSettings.event_date,
            event_time: pendingSettings.event_time ?? null,
            event_timezone: pendingSettings.event_timezone ?? resolveLocalTimeZone(),
            event_location: pendingSettings.event_location ?? null,
            require_rsvp_approval: pendingSettings.require_rsvp_approval,
            configuration: pendingSettings.configuration,
          };
          event = await persistEventUpdate(event.id, settings);
        }
        applySession(event);
        return event.id;
      } catch (caughtError) {
        setError(
          caughtError instanceof Error ? caughtError.message : "Failed to create event.",
        );
        throw caughtError;
      } finally {
        setIsLoading(false);
      }
    },
    [activeEvent, applySession, refreshToken],
  );

  // ── Bootstrap a demo event (local) ────────────────
  const bootstrapDemoEvent = useCallback(
    (
      eventType: EventRecord["event_type"] = "corporate",
      language: SupportedLanguage = "en",
    ) => {
      const wordingByType: Record<EventRecord["event_type"], WordingDictionary> = {
        corporate: { guest_label_singular: "Client", guest_label_plural: "Clients" },
        marriage: { guest_label_singular: "Guest", guest_label_plural: "Guests" },
        private: { guest_label_singular: "Invitee", guest_label_plural: "Invitees" },
        conference: { guest_label_singular: "Delegate", guest_label_plural: "Delegates" },
        gala: { guest_label_singular: "Guest", guest_label_plural: "Guests" },
        other: { guest_label_singular: "Attendee", guest_label_plural: "Attendees" },
      };

      const event = createMockEvent({
        event_type: eventType,
        title: `${eventType.charAt(0).toUpperCase()}${eventType.slice(1)} Event`,
        configuration: {
          ui_language: language,
          wording_dictionary: wordingByType[eventType],
          allowed_admin_fields: ["name", "category"],
          invitation_categories_enabled: true,
          invitation_categories: ["General", "VIP"],
        },
      });

      const normalizedEvent = normalizeEvent(event);
      applySession(normalizedEvent);
    },
    [applySession],
  );

  // ── Update event ──────────────────────────────────
  const updateEvent = useCallback((updates: Partial<EventRecord>) => {
    setActiveEvent((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...updates };
      persistSession(buildSessionPayload(next));

      if (/^[a-f\d]{24}$/i.test(prev.id)) {
        void persistEventUpdate(prev.id, updates).catch((error) => {
          console.error("Failed to save event settings", error);
        });
      }

      return next;
    });
  }, []);

  const saveEventSettings = useCallback(async (updates: Partial<EventRecord>) => {
    if (!activeEvent) throw new Error("No active event to save.");

    if (/^[a-f\d]{24}$/i.test(activeEvent.id)) {
      const savedEvent = await persistEventUpdate(activeEvent.id, updates);
      applySession(savedEvent);
      return;
    }

    applySession({ ...activeEvent, ...updates });
  }, [activeEvent, applySession]);

  // ── Restore session ──────────────────────────────
  const restoreSession = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const stored = readStoredSession();
      if (!stored) return;

      const normalizedEvent = normalizeEvent(stored.event);
      applySession(normalizedEvent);
    } catch (caughtError) {
      clearStoredSession();
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Stored session is invalid.",
      );
    } finally {
      setIsLoading(false);
      setIsHydrated(true);
    }
  }, [applySession]);

  const clearSession = useCallback(() => {
    clearStoredSession();
    setActiveEvent(null);
    setLanguage("en");
    setWording({ guest_label_singular: "Guest", guest_label_plural: "Guests" });
    setError(null);
  }, []);

  const translate = useCallback(
    (templateKey: WordingTemplateKey, extra: Record<string, string | number> = {}) =>
      interpolateWording(WORDING_TEMPLATES[templateKey], wording, extra),
    [wording],
  );

  // ── Auto‑restore session on mount ────────────────
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void restoreSession();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [restoreSession]);

  const value = useMemo<EventContextValue>(
    () => ({
      activeEvent,
      language,
      wording,
      isLoading,
      error,
      isHydrated,
      initializeEvent,
      bootstrapDemoEvent,
      createDraftEvent,
      createRealEvent,
      updateEvent,
      saveEventSettings,
      restoreSession,
      clearSession,
      translate,
    }),
    [
      activeEvent,
      language,
      wording,
      isLoading,
      error,
      isHydrated,
      initializeEvent,
      bootstrapDemoEvent,
      createDraftEvent,
      createRealEvent,
      updateEvent,
      saveEventSettings,
      restoreSession,
      clearSession,
      translate,
    ],
  );

  return <EventContext.Provider value={value}>{children}</EventContext.Provider>;
}

function resolveLocalTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function useEventContext(): EventContextValue {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error("useEventContext must be used within an EventProvider.");
  }
  return context;
}
