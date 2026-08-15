"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { useEventContext } from "@/context/EventContext";
import { fetchEventAnalytics } from "@/lib/api/guests";
import type { EventAnalytics } from "@/lib/types/guest";

const COLORS = ["#4fd6be", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6", "#ec4899"];

export function AnalyticsPanel() {
  const { activeEvent } = useEventContext();
  const eventId = activeEvent?.id;
  const [data, setData] = useState<EventAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [animatedRate, setAnimatedRate] = useState(0);

  useEffect(() => {
    if (!eventId || !/^[a-f\d]{24}$/i.test(eventId)) {
      return;
    }

    const load = async () => {
      setIsLoading(true);
      setError("");
      try {
        const result = await fetchEventAnalytics(eventId);
        setData(result);
      } catch {
        setError("Failed to load analytics");
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [eventId]);

  useEffect(() => {
    if (!data) return;
    let animationFrame: number | undefined;
    const resetFrame = requestAnimationFrame(() => {
      setAnimatedRate(0);
      animationFrame = requestAnimationFrame(() => {
        setAnimatedRate(Math.max(0, Math.min(100, data.summary.completion_rate)));
      });
    });
    return () => {
      cancelAnimationFrame(resetFrame);
      if (animationFrame !== undefined) cancelAnimationFrame(animationFrame);
    };
  }, [data]);

  if (!eventId || !/^[a-f\d]{24}$/i.test(eventId)) {
    return (
      <div className="flex items-center justify-center h-full text-foreground/50">
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold">Analytics unavailable</p>
          <p className="text-sm">Save the event first to view analytics.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-foreground/50">
        Loading analytics...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-full text-red-400">
        {error || "No data available"}
      </div>
    );
  }

  const { summary, checkInTimeline, categoryBreakdown, recentActivity } = data;
  const activeGuests = Math.max(summary.total - summary.rejected, 0);
  const attendanceTimeline = checkInTimeline.map((entry, index) => {
    const cumulativeArrivals = checkInTimeline
      .slice(0, index + 1)
      .reduce((total, point) => total + point.count, 0);
    return {
      hour: entry.hour,
      checkedIn: entry.count,
      pending: Math.max(activeGuests - cumulativeArrivals, 0),
    };
  });
  const ringRadius = 54;
  const ringCircumference = 2 * Math.PI * ringRadius;

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-6">
      <h2 className="text-2xl font-semibold">Analytics</h2>

      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="flex items-center gap-6 rounded-xl border border-brand-400/15 bg-brand-400/5 p-5">
          <div className="relative h-36 w-36 shrink-0">
            <svg className="h-36 w-36 -rotate-90" viewBox="0 0 128 128" aria-hidden="true">
              <circle cx="64" cy="64" r={ringRadius} fill="none" stroke="currentColor" strokeWidth="11" className="text-foreground/10" />
              <circle
                cx="64"
                cy="64"
                r={ringRadius}
                fill="none"
                stroke="#4fd6be"
                strokeLinecap="round"
                strokeWidth="11"
                strokeDasharray={ringCircumference}
                strokeDashoffset={ringCircumference * (1 - animatedRate / 100)}
                style={{ transition: "stroke-dashoffset 850ms cubic-bezier(0.22, 1, 0.36, 1)" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-brand-400">{Math.round(animatedRate)}%</span>
              <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/45">Arrived</span>
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/45">Attendance rate</p>
            <p className="mt-2 text-xl font-semibold">{summary.checked_in} of {summary.total} guests</p>
            <p className="mt-2 text-sm leading-5 text-foreground/55">Guests who have arrived and checked in.</p>
          </div>
        </div>

        <div className="rounded-xl border border-brand-400/15 bg-background p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold">Arrivals by hour</h3>
              <p className="mt-1 text-xs text-foreground/45">Hourly arrivals and remaining invitations</p>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-foreground/55">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brand-400" />Checked in</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" />Pending</span>
            </div>
          </div>
          {attendanceTimeline.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={attendanceTimeline} barGap={4}>
                <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "#888" }} />
                <YAxis tick={{ fontSize: 11, fill: "#888" }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--background)",
                    border: "1px solid rgba(79,214,190,0.2)",
                    borderRadius: 8,
                  }}
                />
                <Bar dataKey="checkedIn" name="Checked in" fill="#4fd6be" radius={[5, 5, 0, 0]} />
                <Bar dataKey="pending" name="Pending" fill="#f59e0b" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-24 text-center text-sm text-foreground/50">Hourly activity will appear after the first scan.</p>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Total", value: summary.total, color: "text-foreground" },
          { label: "Checked In", value: summary.checked_in, color: "text-brand-400" },
          { label: "Pending", value: summary.pending, color: "text-amber-400" },
          { label: "Rejected", value: summary.rejected, color: "text-red-400" },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-brand-400/10 bg-brand-400/5 p-4 text-center"
          >
            <p className="text-xs text-foreground/50">{card.label}</p>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Category Breakdown */}
        <div className="rounded-xl border border-brand-400/10 bg-background p-5">
          <h3 className="text-sm font-semibold mb-4">Guest Categories</h3>
          {categoryBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={categoryBreakdown}
                  dataKey="count"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                >
                  {categoryBreakdown.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--background)",
                    border: "1px solid rgba(79,214,190,0.2)",
                    borderRadius: 12,
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-foreground/50 text-center py-10">
              No category data yet
            </p>
          )}
      </div>

      {/* Recent Activity Feed */}
      <div className="rounded-xl border border-brand-400/10 bg-background p-5">
        <h3 className="text-sm font-semibold mb-4">Recent Activity</h3>
        {recentActivity.length > 0 ? (
          <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-custom">
            {recentActivity.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between rounded-lg bg-brand-400/5 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{log.guest_name}</p>
                  <p className="text-xs text-foreground/50">{log.action}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-foreground/50">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-brand-400/10 text-brand-400">
                    {log.category}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-foreground/50 text-center py-10">
            No recent activity
          </p>
        )}
      </div>
      {/* Duplicate Scan Attempts */}
{data.duplicateAttempts.length > 0 && (
  <div className="rounded-xl border border-red-400/10 bg-red-400/5 p-5">
    <h3 className="text-sm font-semibold mb-4 text-red-400">
      Duplicate Scan Attempts
    </h3>
    <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-custom">
      {data.duplicateAttempts.map((log) => (
        <div
          key={log.id}
          className="flex items-center justify-between rounded-lg bg-red-400/5 px-4 py-3 border border-red-400/10"
        >
          <div>
            <p className="text-sm font-medium">{log.guest_name}</p>
            <p className="text-xs text-foreground/50">Duplicate scan rejected</p>
          </div>
          <div className="text-right">
            <span className="text-xs text-foreground/50">
              {new Date(log.timestamp).toLocaleTimeString()}
            </span>
            <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-red-400/10 text-red-400">
              {log.category}
            </span>
          </div>
        </div>
      ))}
    </div>
  </div>
)}
    </div>
  );
}
