"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { WorkspaceLayout } from "@/components/layout/WorkspaceLayout";
import { Workspace } from "@/components/workspace/Workspace";
import { FlyerDraftProvider } from "@/context/FlyerDraftContext";
import { useEventContext } from "@/context/EventContext";

function isMongoObjectId(value: string) {
  return /^[a-f\d]{24}$/i.test(value);
}

export default function EventWorkspacePage() {
  const params = useParams();
  const eventId = params.eventId as string;
  const { activeEvent, initializeEvent } = useEventContext();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsReady(false);

      try {
        await initializeEvent(eventId);
      } finally {
        if (!cancelled) {
          setIsReady(true);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [eventId, initializeEvent]);

  if (!isReady || (isMongoObjectId(eventId) && activeEvent?.id !== eventId)) {
    return (
      <WorkspaceLayout>
        <div className="flex items-center justify-center h-full text-foreground/50 text-sm">
          Loading event…
        </div>
      </WorkspaceLayout>
    );
  }

  return (
    <WorkspaceLayout>
      <FlyerDraftProvider>
        <Workspace />
      </FlyerDraftProvider>
    </WorkspaceLayout>
  );
}
