import { differenceInCalendarDays, format } from "date-fns";
import type { HistoricEventRecord } from "@/lib/types/auth";
import Link from "next/link";

function getStatusBadge(eventDate: string | null) {
  const date = parseEventDate(eventDate);
  if (!date) {
    return {
      label: "Needs date",
      className: "border-red-400/20 bg-red-400/10 text-red-400",
    };
  }
  const daysLeft = differenceInCalendarDays(date, new Date());

  if (daysLeft === 0) {
    return {
      label: "Today",
      className: "border-brand-400/20 bg-brand-400/10 text-brand-400",
    };
  }
  if (daysLeft < 0) {
    const daysAgo = Math.abs(daysLeft);
    return {
      label: `${daysAgo} day${daysAgo === 1 ? "" : "s"} ago`,
      className: "border-amber-400/20 bg-amber-400/10 text-amber-400",
    };
  }
  if (daysLeft >= 30) {
    const monthsLeft = Math.max(1, Math.round(daysLeft / 30));
    return {
      label: `In ${monthsLeft} month${monthsLeft === 1 ? "" : "s"}`,
      className: "border-foreground/10 bg-foreground/5 text-brand-400/75",
    };
  }
  return {
    label: `In ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
    className: "border-foreground/10 bg-foreground/5 text-brand-400/75",
  };
}

function parseEventDate(value: string | null) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) return null;
  return date;
}

interface ProjectCardProps {
  event: HistoricEventRecord;
  onDelete?: (eventId: string) => void;
}

export function ProjectCard({ event, onDelete }: ProjectCardProps) {
  const badge = getStatusBadge(event.event_date);
  const eventDate = parseEventDate(event.event_date);

  return (
    <div className="relative group flex-shrink-0 w-60 h-40 rounded-3xl border border-brand-400/10 bg-background p-4 shadow-lg hover:shadow-xl transition">
      <Link
        href={`/dashboard/event/${event.id}`}
        className="flex flex-col h-full justify-between"
      >
        <div>
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-widest text-brand-400">
              {event.event_type}
            </p>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] ${badge.className}`}>
              {badge.label}
            </span>
          </div>
          <h3 className="mt-1 font-semibold text-sm truncate">{event.title}</h3>
        </div>
        <p className="text-xs text-foreground/60">
          {eventDate ? format(eventDate, "MMM d, yyyy") : "Date not set"}
        </p>
      </Link>

      {/* Delete icon – visible on hover */}
      {onDelete && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete(event.id);
          }}
          className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 p-1.5 rounded-full bg-red-400/10 text-red-400 hover:bg-red-400/20 transition"
          title="Delete event"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
