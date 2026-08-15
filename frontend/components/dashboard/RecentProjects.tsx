"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { CreateCard } from "./CreateCard";
import { ProjectCard } from "./ProjectCard";
import { DeleteConfirmModal } from "./DeleteConfirmModal";
import { deleteEvent } from "@/lib/api/events";

interface RecentProjectsProps {
  onCreateClick: () => void;
}

export function RecentProjects({ onCreateClick }: RecentProjectsProps) {
  const { user } = useAuth();
  const [events, setEvents] = useState(user?.historic_events ?? []);

  useEffect(() => {
    setEvents(user?.historic_events ?? []);
  }, [user]);

  const sorted = [...events].sort(
    (a, b) => {
      const bTime = b.event_date ? new Date(b.event_date).getTime() : 0;
      const aTime = a.event_date ? new Date(a.event_date).getTime() : 0;
      return bTime - aTime;
    }
  );
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? sorted : sorted.slice(0, 4);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteEvent(deleteTarget.id);
      setEvents((prev) => prev.filter((e) => e.id !== deleteTarget.id));
    } catch (err) {
      console.error("Failed to delete event", err);
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold">Your events</h2>
        {sorted.length > 4 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-sm text-brand-400 hover:underline"
          >
            {showAll ? "Show less" : "See all"}
          </button>
        )}
      </div>

      {/* ─── Horizontal scrolling container ─── */}
      <div className="overflow-x-auto flex gap-4 pb-4 snap-x scrollbar-custom">
        <CreateCard onClick={onCreateClick} />
        {displayed.map((event) => (
          <ProjectCard
            key={event.id}
            event={event}
            onDelete={(id) =>
              setDeleteTarget({ id, title: event.title })
            }
          />
        ))}
      </div>

      <DeleteConfirmModal
        open={!!deleteTarget}
        eventTitle={deleteTarget?.title ?? ""}
        isDeleting={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => {
          if (!isDeleting) setDeleteTarget(null);
        }}
      />
    </section>
  );
}
