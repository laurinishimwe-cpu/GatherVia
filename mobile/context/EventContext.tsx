import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createEvent, createMockEvent, fetchEventById } from "@/lib/api/events";
import type { EventRecord } from "@/lib/types/event";

const BYPASS_AUTH = process.env.EXPO_PUBLIC_BYPASS_AUTH === "true";
const PENDING_EVENT_KEY = "gatekeep.pending-event-id";

interface EventContextValue {
  activeEvent: EventRecord | null;
  setActiveEvent: (event: EventRecord | null) => void;
  loadEvent: (eventId: string) => Promise<EventRecord>;
  pendingDraftEventId: string | null;
  markEventPublished: (eventId?: string) => Promise<void>;
  markEventDraft: (eventId: string) => Promise<void>;
  clearPendingDraft: () => Promise<void>;
  createDraftEvent: (
    title: string,
    eventType: EventRecord["event_type"],
  ) => Promise<string>;
}

const EventContext = createContext<EventContextValue | null>(null);

export function EventProvider({ children }: { children: ReactNode }) {
  const [activeEvent, setActiveEvent] = useState<EventRecord | null>(null);
  const [pendingDraftEventId, setPendingDraftEventId] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(PENDING_EVENT_KEY).then(setPendingDraftEventId).catch(() => undefined);
  }, []);
  const value = useMemo(
    () => ({
      activeEvent,
      setActiveEvent,
      pendingDraftEventId,
      markEventPublished: async (eventId?: string) => {
        if (eventId && pendingDraftEventId && eventId !== pendingDraftEventId) return;
        setPendingDraftEventId(null);
        await AsyncStorage.removeItem(PENDING_EVENT_KEY);
      },
      markEventDraft: async (eventId: string) => {
        setPendingDraftEventId(eventId);
        await AsyncStorage.setItem(PENDING_EVENT_KEY, eventId);
      },
      clearPendingDraft: async () => {
        setPendingDraftEventId(null);
        await AsyncStorage.removeItem(PENDING_EVENT_KEY);
      },
      loadEvent: async (eventId: string) => {
        if (activeEvent?.id === eventId) return activeEvent;
        const event = BYPASS_AUTH
          ? createMockEvent({ id: eventId })
          : await fetchEventById(eventId);
        setActiveEvent(event);
        if (event.design_status === "published") {
          if (!pendingDraftEventId || pendingDraftEventId === event.id) {
            setPendingDraftEventId(null);
            await AsyncStorage.removeItem(PENDING_EVENT_KEY);
          }
        } else {
          setPendingDraftEventId(event.id);
          await AsyncStorage.setItem(PENDING_EVENT_KEY, event.id);
        }
        return event;
      },
      createDraftEvent: async (
        title: string,
        eventType: EventRecord["event_type"],
      ) => {
        const event = BYPASS_AUTH
          ? createMockEvent({
              id: `mobile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              title,
              event_type: eventType,
              event_date: "",
              design_status: "draft",
              design_published_at: null,
            })
          : await createEvent(title, eventType);
        setActiveEvent({ ...event, event_date: "" });
        setPendingDraftEventId(event.id);
        await AsyncStorage.setItem(PENDING_EVENT_KEY, event.id);
        return event.id;
      },
    }),
    [activeEvent, pendingDraftEventId],
  );
  return <EventContext.Provider value={value}>{children}</EventContext.Provider>;
}

export function useEvent() {
  const context = useContext(EventContext);
  if (!context) throw new Error("useEvent must be used inside EventProvider");
  return context;
}
