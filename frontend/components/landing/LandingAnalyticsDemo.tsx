"use client";

import { useMemo, useState, type SVGProps } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, ShieldAlert, Sparkles, Users } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { demoAnalyticsEvents } from "@/components/landing/demoData";

const chartColors = ["#4fd6be", "#f59e0b", "#60a5fa", "#e0ba5a"];

export function LandingAnalyticsDemo() {
  const [eventId, setEventId] = useState(demoAnalyticsEvents[0]?.id ?? "");

  const event = demoAnalyticsEvents.find((item) => item.id === eventId) ?? demoAnalyticsEvents[0];

  const metrics = useMemo(() => {
    if (!event) return null;

    const checkedIn = event.timeline.reduce((sum, point) => sum + point.checkedIn, 0);
    const activeInvitations = Math.max(event.total - event.rejected, 0);
    const pending = Math.max(activeInvitations - checkedIn, 0);
    const completionRate = event.total > 0 ? Math.round((checkedIn / event.total) * 100) : 0;

    let cumulative = 0;
    const attendanceTimeline = event.timeline.map((point) => {
      cumulative += point.checkedIn;
      return {
        ...point,
        pending: Math.max(activeInvitations - cumulative, 0),
      };
    });

    return { checkedIn, pending, completionRate, attendanceTimeline };
  }, [event]);

  if (!event || !metrics) return null;

  const ringRadius = 52;
  const circumference = 2 * Math.PI * ringRadius;

  return (
    <Card variant="outlined" className="min-w-0 overflow-hidden p-0">
      <style>{`
        @keyframes analytics-progress-ring-fill {
          from { stroke-dashoffset: ${circumference}; }
        }

        @media (prefers-reduced-motion: reduce) {
          .analytics-progress-ring {
            animation: none !important;
          }
        }
      `}</style>

      <div className="flex flex-col gap-4 border-b border-brand-400/10 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-brand-400" aria-hidden="true" />
            <h3 className="font-semibold">Event analytics demo</h3>
          </div>
          <p className="mt-1 text-sm text-foreground/55">Interactive charts generated from synthetic event data.</p>
        </div>
        <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0" role="tablist" aria-label="Demo event type">
          {demoAnalyticsEvents.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={event.id === item.id}
              onClick={() => setEventId(item.id)}
              className={`min-h-10 shrink-0 rounded-full px-3 py-2 text-xs font-medium transition ${
                event.id === item.id
                  ? "bg-brand-400 text-brand-950"
                  : "bg-brand-400/5 text-foreground/60 hover:bg-brand-400/10 hover:text-foreground"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 p-4 sm:space-y-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-400">Sample event</p>
            <h4 aria-live="polite" className="mt-2 text-xl font-semibold sm:text-2xl">{event.eventName}</h4>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-brand-400/15 bg-brand-400/5 px-3 py-1.5 text-xs text-foreground/60">
            <Sparkles className="h-3.5 w-3.5 text-brand-400" aria-hidden="true" />
            Synthetic data
          </span>
        </div>

        <div className="grid gap-5 xl:grid-cols-[330px_minmax(0,1fr)]">
          <div className="rounded-2xl border border-brand-400/15 bg-brand-400/[0.035] p-4 sm:p-5">
            <div className="flex flex-col items-start gap-4 min-[420px]:flex-row min-[420px]:items-center sm:gap-5">
              <div className="relative h-28 w-28 shrink-0 sm:h-32 sm:w-32">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 128 128" aria-hidden="true">
                  <circle cx="64" cy="64" r={ringRadius} fill="none" stroke="currentColor" strokeWidth="10" className="text-foreground/10" />
                  <circle
                    key={event.id}
                    cx="64"
                    cy="64"
                    r={ringRadius}
                    fill="none"
                    stroke="#4fd6be"
                    strokeLinecap="round"
                    strokeWidth="10"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference * (1 - metrics.completionRate / 100)}
                    className="analytics-progress-ring"
                    style={{ animation: "analytics-progress-ring-fill 850ms cubic-bezier(0.22, 1, 0.36, 1) both" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-brand-400">{metrics.completionRate}%</span>
                  <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.15em] text-foreground/45">Arrived</span>
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.15em] text-foreground/45">Attendance</p>
                <p className="mt-2 text-xl font-semibold">{metrics.checkedIn} of {event.total}</p>
                <p className="mt-2 text-sm leading-6 text-foreground/55">Invited guests who have completed check-in.</p>
              </div>
            </div>
          </div>

          <div className="min-w-0 rounded-2xl border border-brand-400/15 bg-background p-3 sm:p-5">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h5 className="text-sm font-semibold">Arrivals by time</h5>
                <p className="mt-1 text-xs text-foreground/45">Tap or hover over the bars to inspect sample values.</p>
              </div>
              <div className="flex gap-3 text-[11px] text-foreground/55">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brand-400" />Checked in</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" />Remaining</span>
              </div>
            </div>
            <div className="h-[240px] w-full sm:h-[270px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.attendanceTimeline} barGap={4} margin={{ top: 12, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="rgba(127,127,127,0.12)" />
                  <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} minTickGap={12} />
                  <YAxis tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: "rgba(79,214,190,0.05)" }}
                    contentStyle={{
                      backgroundColor: "var(--background)",
                      border: "1px solid rgba(79,214,190,0.2)",
                      borderRadius: 12,
                      color: "var(--foreground)",
                    }}
                  />
                  <Bar dataKey="checkedIn" name="Checked in" fill="#4fd6be" radius={[5, 5, 0, 0]} />
                  <Bar dataKey="pending" name="Remaining" fill="#f59e0b" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: "Invited", value: event.total, icon: Users, className: "text-foreground" },
            { label: "Checked in", value: metrics.checkedIn, icon: UserCheckIcon, className: "text-brand-400" },
            { label: "Pending", value: metrics.pending, icon: Activity, className: "text-amber-500" },
            { label: "Rejected", value: event.rejected, icon: ShieldAlert, className: "text-red-400" },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-2xl border border-brand-400/10 bg-brand-400/[0.035] p-3 sm:p-4">
                <Icon className={`h-4 w-4 ${item.className}`} aria-hidden="true" />
                <p className="mt-3 text-xs text-foreground/45">{item.label}</p>
                <p className={`mt-1 text-2xl font-bold ${item.className}`}>{item.value}</p>
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl border border-brand-400/15 bg-background p-4 sm:p-5">
          <div>
            <h5 className="text-sm font-semibold">Guest categories</h5>
            <p className="mt-1 text-xs text-foreground/45">Distribution of invitations across configured groups.</p>
          </div>
          <div className="mt-2 h-[280px] w-full sm:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={event.categories}
                  dataKey="count"
                  nameKey="category"
                  cx="50%"
                  cy="48%"
                  innerRadius={62}
                  outerRadius={98}
                  paddingAngle={3}
                >
                  {event.categories.map((entry, index) => (
                    <Cell key={entry.category} fill={chartColors[index % chartColors.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--background)",
                    border: "1px solid rgba(79,214,190,0.2)",
                    borderRadius: 12,
                    color: "var(--foreground)",
                  }}
                />
                <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Guest category totals">
            {event.categories.map((category, index) => (
              <div key={category.category} className="rounded-xl bg-brand-400/[0.035] px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: chartColors[index % chartColors.length] }}
                    aria-hidden="true"
                  />
                  <span className="truncate text-xs text-foreground/55">{category.category}</span>
                </div>
                <p className="mt-1.5 text-sm font-semibold">
                  {category.count}
                  <span className="ml-1 text-[11px] font-normal text-foreground/40">
                    ({event.total > 0 ? Math.round((category.count / event.total) * 100) : 0}%)
                  </span>
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function UserCheckIcon({ className = "", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="m16 11 2 2 4-4" />
    </svg>
  );
}
