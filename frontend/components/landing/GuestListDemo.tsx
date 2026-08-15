"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Search,
  ShieldAlert,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  demoGuests,
  type DemoGuest,
  type DemoGuestStatus,
} from "@/components/landing/demoData";

const filters: Array<"All" | DemoGuestStatus> = [
  "All",
  "Pending",
  "Approved",
  "Arrived",
  "Declined",
];

const statusStyles: Record<DemoGuestStatus, string> = {
  Pending: "bg-amber-400/10 text-amber-500",
  Approved: "bg-blue-400/10 text-blue-400",
  Arrived: "bg-brand-400/10 text-brand-400",
  Declined: "bg-red-400/10 text-red-400",
};

const statusIcons = {
  Pending: Clock3,
  Approved: UserCheck,
  Arrived: CheckCircle2,
  Declined: XCircle,
} satisfies Record<DemoGuestStatus, typeof Clock3>;

export function GuestListDemo() {
  const [guests, setGuests] = useState<DemoGuest[]>(demoGuests);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const [selectedId, setSelectedId] = useState(demoGuests[1]?.id ?? "");
  const [notice, setNotice] = useState("");

  const filteredGuests = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return guests.filter((guest) => {
      const matchesFilter = filter === "All" || guest.status === filter;
      const matchesQuery =
        !normalizedQuery ||
        guest.name.toLowerCase().includes(normalizedQuery) ||
        guest.email.toLowerCase().includes(normalizedQuery) ||
        guest.category.toLowerCase().includes(normalizedQuery);
      return matchesFilter && matchesQuery;
    });
  }, [filter, guests, query]);

  const selectedGuest = guests.find((guest) => guest.id === selectedId) ?? filteredGuests[0];

  const summary = useMemo(
    () => ({
      total: guests.length,
      arrived: guests.filter((guest) => guest.status === "Arrived").length,
      approved: guests.filter((guest) => guest.status === "Approved").length,
      pending: guests.filter((guest) => guest.status === "Pending").length,
    }),
    [guests],
  );

  const checkInSelectedGuest = () => {
    if (!selectedGuest) return;

    if (selectedGuest.status === "Arrived") {
      setNotice(`Duplicate scan blocked for ${selectedGuest.name}.`);
      return;
    }

    if (selectedGuest.status === "Declined") {
      setNotice(`${selectedGuest.name} is not approved for entry.`);
      return;
    }

    setGuests((currentGuests) =>
      currentGuests.map((guest) =>
        guest.id === selectedGuest.id
          ? { ...guest, status: "Arrived", checkedInAt: "Just now" }
          : guest,
      ),
    );
    setNotice(`${selectedGuest.name} checked in successfully.`);
  };

  return (
    <Card variant="outlined" className="min-w-0 overflow-hidden p-0">
      <div className="border-b border-brand-400/10 px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-brand-400" aria-hidden="true" />
              <h3 className="font-semibold">Guest management demo</h3>
            </div>
            <p className="mt-1 text-sm text-foreground/55">Interactive sample data — no real guest information.</p>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 text-center sm:w-auto sm:grid-cols-4">
            {[
              ["Total", summary.total],
              ["Arrived", summary.arrived],
              ["Approved", summary.approved],
              ["Pending", summary.pending],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0 rounded-xl bg-brand-400/5 px-2 py-2 sm:min-w-16 sm:px-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-foreground/45">{label}</p>
                <p className="mt-1 font-semibold">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:min-h-[520px] lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
        <div className="min-w-0 border-b border-brand-400/10 p-3 sm:p-5 lg:border-b-0 lg:border-r">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" aria-hidden="true" />
            <span className="sr-only">Search guests</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, email, or category"
              className="min-h-11 w-full rounded-xl border border-brand-400/15 bg-background pl-10 pr-4 text-sm outline-none transition placeholder:text-foreground/35 focus:border-brand-400/50 focus:ring-2 focus:ring-brand-400/15"
            />
          </label>

          <div className="scrollbar-none mt-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Guest status filters">
            {filters.map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={filter === item}
                onClick={() => setFilter(item)}
                className={`min-h-9 shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  filter === item
                    ? "bg-brand-400 text-brand-950"
                    : "bg-brand-400/5 text-foreground/60 hover:bg-brand-400/10 hover:text-foreground"
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-2">
            {filteredGuests.map((guest) => {
              const StatusIcon = statusIcons[guest.status];
              const isSelected = selectedGuest?.id === guest.id;

              return (
                <button
                  key={guest.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(guest.id);
                    setNotice("");
                  }}
                  className={`flex min-h-16 w-full items-center justify-between gap-2 rounded-2xl border px-3 py-3 text-left transition sm:gap-4 sm:px-4 ${
                    isSelected
                      ? "border-brand-400/40 bg-brand-400/10"
                      : "border-transparent bg-brand-400/[0.035] hover:border-brand-400/15 hover:bg-brand-400/[0.07]"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{guest.name}</p>
                    <p className="mt-0.5 truncate text-xs text-foreground/45">
                      {guest.category} · Party of {guest.partySize}
                    </p>
                  </div>
                  <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium sm:gap-1.5 sm:px-2.5 sm:text-[11px] ${statusStyles[guest.status]}`}>
                    <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    {guest.status}
                  </span>
                </button>
              );
            })}

            {filteredGuests.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-brand-400/15 py-12 text-center text-sm text-foreground/45">
                No guests match this search.
              </div>
            ) : null}
          </div>
        </div>

        <aside className="flex min-w-0 flex-col justify-between bg-brand-400/[0.025] p-4 sm:p-6">
          {selectedGuest ? (
            <>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-400">Selected guest</p>
                <h4 className="mt-3 text-xl font-semibold">{selectedGuest.name}</h4>
                <p className="mt-1 break-all text-sm text-foreground/50">{selectedGuest.email}</p>

                <dl className="mt-6 space-y-3 text-sm">
                  <div className="flex justify-between gap-4 border-b border-brand-400/10 pb-3">
                    <dt className="text-foreground/45">Category</dt>
                    <dd className="font-medium">{selectedGuest.category}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-brand-400/10 pb-3">
                    <dt className="text-foreground/45">Party size</dt>
                    <dd className="font-medium">{selectedGuest.partySize}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-brand-400/10 pb-3">
                    <dt className="text-foreground/45">Status</dt>
                    <dd className="font-medium">{selectedGuest.status}</dd>
                  </div>
                  {selectedGuest.checkedInAt ? (
                    <div className="flex justify-between gap-4">
                      <dt className="text-foreground/45">Checked in</dt>
                      <dd className="font-medium">{selectedGuest.checkedInAt}</dd>
                    </div>
                  ) : null}
                </dl>

                {notice ? (
                  <div aria-live="polite" className={`mt-6 flex items-start gap-2 rounded-xl border p-3 text-xs leading-5 ${
                    notice.includes("successfully")
                      ? "border-brand-400/20 bg-brand-400/5 text-brand-400"
                      : "border-amber-400/20 bg-amber-400/5 text-amber-500"
                  }`}>
                    {notice.includes("successfully") ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    ) : (
                      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    )}
                    <span>{notice}</span>
                  </div>
                ) : null}
              </div>

              <Button onClick={checkInSelectedGuest} className="mt-8 w-full">
                {selectedGuest.status === "Arrived" ? "Test duplicate scan" : "Check in guest"}
              </Button>
            </>
          ) : (
            <p className="text-sm text-foreground/45">Select a guest to see their invitation status.</p>
          )}
        </aside>
      </div>
    </Card>
  );
}
