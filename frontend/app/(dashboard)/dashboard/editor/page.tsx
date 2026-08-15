"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useEventContext } from "@/context/EventContext";

export default function EditorPage() {
  const router = useRouter();
  const { activeEvent, isHydrated } = useEventContext();

  useEffect(() => {
    if (!isHydrated) return;
    router.replace(activeEvent?.id ? `/dashboard/event/${activeEvent.id}` : "/dashboard");
  }, [activeEvent?.id, isHydrated, router]);

  return (
    <div className="flex h-full min-h-64 items-center justify-center text-sm text-foreground/60">
      Opening editor…
    </div>
  );
}
