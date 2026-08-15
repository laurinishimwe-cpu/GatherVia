"use client";

import { useEventContext } from "@/context/EventContext";

export function useEventValidation() {
  const { activeEvent } = useEventContext();
  const isReady = Boolean(
    activeEvent?.title && activeEvent?.event_type && activeEvent?.event_date
  );
  const missingFields: string[] = [];
  if (!activeEvent?.title) missingFields.push("Event name");
  if (!activeEvent?.event_type) missingFields.push("Event type");
  if (!activeEvent?.event_date) missingFields.push("Event date");

  return { isReady, missingFields };
}
