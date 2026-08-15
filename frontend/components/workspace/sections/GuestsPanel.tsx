"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import Image from "next/image";
import Fuse from "fuse.js";
import QRCode from "qrcode";
import { useToast } from "@/components/providers/ToastProvider";
import { useEventContext } from "@/context/EventContext";
import { useFlyerDraft } from "@/context/FlyerDraftContext";
import { createEventGuest, fetchEventGuests, updateGuestStatus, deleteGuest } from "@/lib/api/guests";
import { fetchEventPublicLinks } from "@/lib/api/communications";
import { ApiError } from "@/lib/api/api";
import {
  checkGuestLimit,
  type GuestLimitStatus,
} from "@/lib/api/plans";
import { renderStoredGuestInvitation } from "@/lib/api/flyers";
import {
  generateGuestInvitationImage,
  type GuestInvitationImageFormat,
} from "@/lib/invitation/generateGuestInvitation";
import { QrCodeModal } from "@/components/workspace/guests/QrCodeModal";
import { OriginalFlyer } from "@/components/workspace/flyer/OriginalFlyer";
import { UpgradeModal } from "@/components/dashboard/UpgradeModal";
import type {
  GuestActivityLog,
  GuestOwnerView,
  GuestListSummary,
} from "@/lib/types/guest";

const defaultInvitationCategories = ["General", "VIP"];

function CopyCheckIcon({ copied }: { copied: boolean }) {
  return copied ? (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  ) : (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2M10 20h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

function QrIcon() {
  return (
    <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
      <path d="M2 2h2v2H2V2Z"/>
      <path d="M6 0v6H0V0h6ZM5 1H1v4h4V1ZM4 12H2v2h2v-2Z"/>
      <path d="M6 10v6H0v-6h6Zm-5 1v4h4v-4H1Zm11-9h2v2h-2V2Z"/>
      <path d="M10 0v6h6V0h-6Zm5 1v4h-4V1h4ZM8 1V0h1v2H8v2H7V1h1Zm0 5V4h1v2H8ZM6 8V7h1V6h1v2h1V7h5v1h-4v1H7V8H6Zm0 0v1H2V8H1v1H0V7h3v1h3Zm10 1h-1V7h1v2Zm-1 0h-1v2h2v-1h-1v-1Zm-4 0h2v1h-1v1h-1v-2Zm2 3v-1h-1v1h-1v1H9v1h3v-2Zm0 0h3v1h-2v1h-1v-2Zm-4-1v1h1v-2H7v1h1Z"/>
      <path d="M7 12h1v3h4v1H7v-4Zm9 2v2h-3v-1h2v-1h1Z"/>
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="11" cy="11" r="6.5" />
      <path strokeLinecap="round" d="m16 16 4.5 4.5" />
    </svg>
  );
}

export function GuestsPanel() {
  const { activeEvent } = useEventContext();
  const { draft, setPreviewGuest } = useFlyerDraft();
  const { toast } = useToast();
  const eventId = activeEvent?.id;
  const [guests, setGuests] = useState<GuestOwnerView[]>([]);
  const [summary, setSummary] = useState<GuestListSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // QR modal state
  const [showQrModal, setShowQrModal] = useState(false);
  const [selectedPassGuest, setSelectedPassGuest] = useState<GuestOwnerView | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GuestOwnerView | null>(null);
  const [isDeletingGuest, setIsDeletingGuest] = useState(false);
  const [selectedActivityGuest, setSelectedActivityGuest] =
    useState<GuestOwnerView | null>(null);
  const [copiedInviteLink, setCopiedInviteLink] = useState(false);

  // Manual add state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newGuestName, setNewGuestName] = useState("");
  const [newGuestEmail, setNewGuestEmail] = useState("");
  const [newGuestPhone, setNewGuestPhone] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [isCheckingLimit, setIsCheckingLimit] = useState(false);
  const [guestLimitStatus, setGuestLimitStatus] = useState<GuestLimitStatus | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const loadGuests = useCallback(async (force = false) => {
    if (!eventId) return;
    setIsLoading(true);
    setError("");
    try {
      const [data, publicLinks] = await Promise.all([
        fetchEventGuests(eventId, { force }),
        fetchEventPublicLinks(eventId).catch(() => null),
      ]);
      setGuests(data.guests);
      setSummary(data.summary);
      setInviteLink(publicLinks?.invite_url ?? null);
      setSelectedActivityGuest((currentGuest) =>
        currentGuest
          ? data.guests.find((guest) => guest.id === currentGuest.id) ?? null
          : null
      );
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to load guests.");
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadGuests(), 0);
    return () => window.clearTimeout(timer);
  }, [loadGuests]);

  useEffect(() => {
    if (!copiedInviteLink) return;
    const timer = window.setTimeout(() => setCopiedInviteLink(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copiedInviteLink]);

  const handleCopyInviteLink = async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopiedInviteLink(true);
    toast("Invitation link copied.", "success");
  };

  const handleShareInviteLink = async () => {
    if (!inviteLink) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${activeEvent?.title ?? "Event"} RSVP`,
          url: inviteLink,
        });
        return;
      } catch {}
    }
    await handleCopyInviteLink();
  };

  const handleStatusChange = async (guestId: string, status: "pending" | "checked_in" | "rejected") => {
    try {
      await updateGuestStatus(guestId, { status });
      await loadGuests();
      toast(
        status === "checked_in" ? "Guest approved." : status === "rejected" ? "Guest rejected." : "Guest returned to pending.",
        "success",
      );
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not update guest status.", "error");
    }
  };

  const handleDeleteGuest = async () => {
    if (!deleteTarget) return;
    setIsDeletingGuest(true);
    try {
      await deleteGuest(deleteTarget.id);
      await loadGuests();
      setDeleteTarget(null);
    } catch {
    } finally {
      setIsDeletingGuest(false);
    }
  };

  const getGuestQrHash = (guest: GuestOwnerView) => {
    return guest.qr_hash ?? "";
  };

  const buildGuestInvitationBlob = useCallback(async (
    guest: GuestOwnerView,
    format: GuestInvitationImageFormat = "png",
    category: string = guest.category
  ) => {
    const qrHash = getGuestQrHash(guest);
    if (!draft.configuration || !qrHash) return null;

    if (eventId) {
      return renderStoredGuestInvitation(eventId, guest.id, format, category);
    }

    return generateGuestInvitationImage(
      draft.configuration,
      draft.layers,
      {
        guestName: guest.full_name,
        guestCategory: category,
        qrHash,
      },
      format
    );
  }, [draft.configuration, draft.layers, eventId]);

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getInvitationFilename = (guest: GuestOwnerView, format: GuestInvitationImageFormat) => {
    const safeName = guest.full_name.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
    return `${safeName || "guest"}-invitation.${format}`;
  };

  const handleOpenInvitationModal = (guest: GuestOwnerView) => {
    const qrHash = getGuestQrHash(guest);
    if (!draft.configuration || !qrHash) return;

    setPreviewGuest({
      id: guest.id,
      name: guest.full_name,
      category: guest.category,
      qrHash,
    });
    setSelectedPassGuest(guest);
  };

  const handleCloseInvitationModal = () => {
    setSelectedPassGuest(null);
    setPreviewGuest(null);
  };

  const handleDownloadInvitation = async (
    guest: GuestOwnerView,
    format: GuestInvitationImageFormat,
    blob: Blob,
  ) => {
    try {
      downloadBlob(blob, getInvitationFilename(guest, format));
    } catch (error) {
      console.error("Failed to generate invitation", error);
    }
  };

  const handleShareInvitation = async (
    guest: GuestOwnerView,
    format: GuestInvitationImageFormat = "png",
    blob: Blob,
  ) => {
    try {
      const file = new File([blob], getInvitationFilename(guest, format), {
        type: format === "jpg" ? "image/jpeg" : "image/png",
      });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Event Invitation",
        });
        return;
      }

      downloadBlob(blob, getInvitationFilename(guest, format));
    } catch (error) {
      console.error("Failed to generate invitation", error);
    }
  };

  const handleAddGuest = async () => {
    if (!newGuestName.trim()) return;
    if (!eventId) return;
    setIsAdding(true);
    try {
      await createEventGuest(eventId, {
        full_name: newGuestName.trim(),
        email: newGuestEmail || null,
        phone: newGuestPhone || null,
      });
      setNewGuestName("");
      setNewGuestEmail("");
      setNewGuestPhone("");
      setShowAddForm(false);
      await loadGuests();
      toast("Guest added successfully.", "success");
    } catch (caughtError) {
      if (caughtError instanceof ApiError && caughtError.status === 402) {
        const latestLimit = await checkGuestLimit(eventId).catch(() => null);
        if (latestLimit) setGuestLimitStatus(latestLimit);
        setShowAddForm(false);
        setShowUpgradeModal(true);
        toast(caughtError.message || "Your event has reached its guest limit.", "info");
        return;
      }
      toast(
        caughtError instanceof Error ? caughtError.message : "Could not add this guest.",
        "error",
      );
    } finally {
      setIsAdding(false);
    }
  };

  const handleOpenAddGuest = async () => {
    if (!eventId || isCheckingLimit) return;
    setIsCheckingLimit(true);
    try {
      const limitStatus = await checkGuestLimit(eventId);
      setGuestLimitStatus(limitStatus);
      if (limitStatus.allowed) {
        setShowAddForm(true);
        return;
      }
      setShowAddForm(false);
      setShowUpgradeModal(true);
    } catch (caughtError) {
      toast(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not verify your guest capacity.",
        "error",
      );
    } finally {
      setIsCheckingLimit(false);
    }
  };

  const statusFilteredGuests = useMemo(() => {
    if (filter === "all") return guests;
    if (filter === "pending") return guests.filter(g => g.status === "pending");
    if (filter === "approved") return guests.filter(g => g.status === "checked_in");
    if (filter === "rejected") return guests.filter(g => g.status === "rejected");
    return guests;
  }, [guests, filter]);

  const filteredGuests = useMemo(() => {
    const query = searchQuery.trim();
    if (!query) return statusFilteredGuests;

    const fuse = new Fuse(statusFilteredGuests, {
      keys: ["full_name", "email", "phone", "category", "status"],
      threshold: 0.35,
      ignoreLocation: true,
    });
    return fuse.search(query).map((result) => result.item);
  }, [searchQuery, statusFilteredGuests]);

  if (selectedActivityGuest) {
    return (
      <GuestActivityView
        guest={selectedActivityGuest}
        eventTitle={activeEvent?.title ?? "Event"}
        onBack={() => setSelectedActivityGuest(null)}
        onRefresh={loadGuests}
      />
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Guests</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleOpenAddGuest}
            disabled={isCheckingLimit}
            className="rounded-full bg-brand-400 px-4 py-1.5 text-xs font-semibold text-black transition hover:shadow-[0_4px_12px_rgba(79,214,190,0.3)] disabled:cursor-wait disabled:opacity-65"
          >
            {isCheckingLimit ? "Checking…" : "+ Add guest"}
          </button>
          <button
            type="button"
            onClick={() => {
              setSearchOpen((isOpen) => !isOpen);
              if (searchOpen) setSearchQuery("");
            }}
            className={`flex h-8 w-8 items-center justify-center rounded-full border transition ${
              searchOpen
                ? "border-brand-400 bg-brand-400 text-black"
                : "border-brand-400/20 hover:bg-brand-400/10"
            }`}
            title="Search guests"
            aria-label="Search guests"
            aria-expanded={searchOpen}
          >
            <SearchIcon />
          </button>
          <button
            onClick={() => void loadGuests(true)}
            className="rounded-full border border-brand-400/20 px-3 py-1.5 text-xs font-medium hover:bg-brand-400/5 transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {searchOpen && (
        <div className="rounded-xl border border-brand-400/15 bg-brand-400/5 p-3">
          <div className="flex items-center gap-2 rounded-lg border border-brand-400/20 bg-background px-3">
            <SearchIcon />
            <input
              type="search"
              autoFocus
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search guests by name, email, phone, or category"
              className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-foreground/40"
              aria-label="Search guests"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-xs text-foreground/50 hover:text-foreground"
                aria-label="Clear guest search"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Manual add form */}
      {showAddForm && (
        <div className="rounded-xl border border-brand-400/20 bg-brand-400/5 p-4 space-y-3">
          <h3 className="text-sm font-semibold">Add guest manually</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              type="text"
              value={newGuestName}
              onChange={(e) => setNewGuestName(e.target.value)}
              placeholder="Full name *"
              className="rounded-lg border border-brand-400/20 bg-background px-3 py-2 text-sm outline-none focus:border-brand-400/50"
            />
            <input
              type="email"
              value={newGuestEmail}
              onChange={(e) => setNewGuestEmail(e.target.value)}
              placeholder="Email"
              className="rounded-lg border border-brand-400/20 bg-background px-3 py-2 text-sm outline-none focus:border-brand-400/50"
            />
            <input
              type="tel"
              value={newGuestPhone}
              onChange={(e) => setNewGuestPhone(e.target.value)}
              placeholder="Phone"
              className="rounded-lg border border-brand-400/20 bg-background px-3 py-2 text-sm outline-none focus:border-brand-400/50"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowAddForm(false)}
              className="rounded-full border border-brand-400/20 px-4 py-1.5 text-xs font-medium hover:bg-brand-400/5 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleAddGuest}
              disabled={!newGuestName.trim() || isAdding}
              className="rounded-full bg-brand-400 px-4 py-1.5 text-xs font-semibold text-black hover:shadow-[0_4px_12px_rgba(79,214,190,0.3)] transition disabled:opacity-50"
            >
              {isAdding ? "Adding…" : "Add"}
            </button>
          </div>
        </div>
      )}

      {inviteLink && (
        <div className="rounded-xl border border-brand-400/10 bg-brand-400/5 p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Invitation link</p>
            <p className="text-xs text-foreground/60 truncate max-w-xs">{inviteLink}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowQrModal(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-brand-400/20 hover:bg-brand-400/10 transition"
              title="Show QR code"
            >
              <QrIcon />
            </button>
            <button
              onClick={handleCopyInviteLink}
              className={`flex h-9 w-9 items-center justify-center rounded-full border transition ${
                copiedInviteLink
                  ? "border-brand-400 bg-brand-400 text-black"
                  : "border-brand-400/20 hover:bg-brand-400/10"
              }`}
              title="Copy invitation link"
            >
              <CopyCheckIcon copied={copiedInviteLink} />
            </button>
            <button
              onClick={handleShareInviteLink}
              className="rounded-full bg-brand-400 px-4 py-2 text-xs font-semibold text-black hover:shadow-[0_4px_12px_rgba(79,214,190,0.3)] transition"
            >
              Share
            </button>
          </div>
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-xl border border-brand-400/10 bg-brand-400/5 p-3 text-center">
            <p className="text-[10px] uppercase text-foreground/50">Total</p>
            <p className="text-xl font-bold">{summary.total}</p>
          </div>
          <div className="rounded-xl border border-amber-400/10 bg-amber-400/5 p-3 text-center">
            <p className="text-[10px] uppercase text-amber-400/70">Pending</p>
            <p className="text-xl font-bold text-amber-400">{summary.pending}</p>
          </div>
          <div className="rounded-xl border border-brand-400/10 bg-brand-400/5 p-3 text-center">
            <p className="text-[10px] uppercase text-brand-400/70">Approved</p>
            <p className="text-xl font-bold text-brand-400">{summary.approved ?? guests.filter((guest) => guest.status === "checked_in").length}</p>
          </div>
          <div className="rounded-xl border border-sky-400/10 bg-sky-400/5 p-3 text-center">
            <p className="text-[10px] uppercase text-sky-300/70">Inside</p>
            <p className="text-xl font-bold text-brand-400">{summary.checked_in}</p>
          </div>
          <div className="rounded-xl border border-red-400/10 bg-red-400/5 p-3 text-center">
            <p className="text-[10px] uppercase text-red-400/70">Rejected</p>
            <p className="text-xl font-bold text-red-400">{summary.rejected}</p>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {(["all", "pending", "approved", "rejected"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
              filter === f ? "bg-brand-400 text-black" : "bg-brand-400/10 text-foreground/70 hover:bg-brand-400/20"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-foreground/60">Loading guests…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="space-y-2">
        {filteredGuests.map((guest) => (
          <div
            key={guest.id}
            onClick={() => setSelectedActivityGuest(guest)}
            className="flex items-center justify-between rounded-xl border border-brand-400/10 bg-background p-4 hover:border-brand-400/20 transition"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-brand-400/10 flex items-center justify-center text-brand-400 font-semibold text-sm">
                {guest.full_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedActivityGuest(guest);
                  }}
                  className="text-left text-sm font-medium hover:text-brand-400"
                >
                  {guest.full_name}
                </button>
                <p className="text-xs text-foreground/50">
                  {guest.email || guest.phone || "No contact"} ·{" "}
                  <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] ${
                    guest.status === "checked_in" ? "bg-brand-400/10 text-brand-400" :
                    guest.status === "rejected" ? "bg-red-400/10 text-red-400" :
                    "bg-amber-400/10 text-amber-400"
                  }`}>
                    {guest.status === "checked_in" ? "Approved" : guest.status === "rejected" ? "Rejected" : "Pending"}
                  </span>
                </p>
              </div>
            </div>
            <div
              className="flex items-center gap-2"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                onClick={() => handleOpenInvitationModal(guest)}
                disabled={!draft.configuration || !getGuestQrHash(guest)}
                className="rounded-full bg-brand-400 px-3 py-1.5 text-xs font-semibold text-black hover:shadow-[0_4px_12px_rgba(79,214,190,0.3)] transition disabled:cursor-not-allowed disabled:opacity-50"
                title="Open guest invitation"
              >
                Share
              </button>
              {guest.status === "pending" && (
                <>
                  <button onClick={() => handleStatusChange(guest.id, "checked_in")} className="rounded-full bg-brand-400 px-3 py-1.5 text-xs font-semibold text-black hover:shadow-[0_4px_12px_rgba(79,214,190,0.3)] transition">Approve</button>
                  <button onClick={() => handleStatusChange(guest.id, "rejected")} className="rounded-full border border-red-400/20 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-400/10 transition">Reject</button>
                </>
              )}
              {guest.status === "checked_in" && (
                <>
                  <button onClick={() => handleStatusChange(guest.id, "pending")} className="rounded-full border border-amber-400/20 px-3 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-400/10 transition">Reset</button>
                </>
              )}
              {guest.status === "rejected" && (
                <button onClick={() => handleStatusChange(guest.id, "pending")} className="rounded-full border border-brand-400/20 px-3 py-1.5 text-xs font-medium hover:bg-brand-400/10 transition">Reconsider</button>
              )}
              <button
                onClick={() => setDeleteTarget(guest)}
                className="text-red-400/60 hover:text-red-400 hover:bg-red-400/10 p-1 rounded transition"
                title="Delete guest"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredGuests.length === 0 && !isLoading && (
        <div className="text-center py-12 text-foreground/50">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p className="text-sm">{searchQuery.trim() ? "No guests match your search" : "No guests yet"}</p>
          <p className="text-xs mt-1">
            {searchQuery.trim()
              ? "Try a different name, contact, category, or status."
              : "Share the invitation link to start receiving RSVPs."}
          </p>
        </div>
      )}

      <GuestInvitationModal
        key={selectedPassGuest?.id ?? "closed-pass"}
        open={Boolean(selectedPassGuest)}
        guest={selectedPassGuest}
        onClose={handleCloseInvitationModal}
        prepareInvitation={buildGuestInvitationBlob}
        onDownload={handleDownloadInvitation}
        onShare={handleShareInvitation}
      />

      <GuestDeleteConfirmModal
        open={Boolean(deleteTarget)}
        guestName={deleteTarget?.full_name ?? ""}
        isDeleting={isDeletingGuest}
        onConfirm={handleDeleteGuest}
        onCancel={() => {
          if (!isDeletingGuest) setDeleteTarget(null);
        }}
      />

      {/* QR Code Modal */}
      {inviteLink && (
        <QrCodeModal
          open={showQrModal}
          url={inviteLink}
          onClose={() => setShowQrModal(false)}
        />
      )}

      <UpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        current={guestLimitStatus?.current ?? summary?.total}
        limit={guestLimitStatus?.limit}
        tier={guestLimitStatus?.tier}
      />
    </div>
  );
}

function GuestDeleteConfirmModal({
  open,
  guestName,
  isDeleting,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  guestName: string;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm modal-backdrop-animate"
        onClick={onCancel}
      />
      <div className="relative w-full max-w-sm rounded-3xl border border-brand-400/10 bg-background p-6 shadow-2xl modal-card-animate">
        <h2 className="text-lg font-semibold">Delete guest?</h2>
        <p className="mt-2 text-sm text-foreground/70">
          Are you sure you want to delete <strong>{guestName}</strong>? Their pass
          and QR access will no longer be available.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 rounded-full border border-brand-400/20 px-4 py-2 text-sm hover:bg-brand-400/5 transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 rounded-full bg-red-500 py-2 text-sm font-semibold text-white hover:shadow-[0_8px_20px_rgba(239,68,68,0.3)] transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

function parseLogTime(log: GuestActivityLog) {
  return new Date(log.timestamp).getTime();
}

function sortLogsAscending(logs: GuestActivityLog[]) {
  return [...logs].sort((first, second) => parseLogTime(first) - parseLogTime(second));
}

function isInsideStatus(status: string) {
  return status === "Checked In" || status === "Returned";
}

function isMovementStatus(status: string) {
  return isInsideStatus(status) || status === "Left Building";
}

function getCurrentPresence(guest: GuestOwnerView) {
  if (guest.status === "pending") return "Pending approval";
  if (guest.status === "rejected") return "Rejected";
  if (guest.check_in_logs.length === 0) return "Approved, not arrived";

  const latestLog = sortLogsAscending(
    guest.check_in_logs.filter((log) => isMovementStatus(log.status))
  ).at(-1);
  if (!latestLog) return "Approved, not arrived";
  return latestLog.status === "Left Building" ? "Currently out" : "Currently inside";
}

function formatActivityTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(milliseconds: number) {
  const totalMinutes = Math.max(0, Math.floor(milliseconds / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function calculateMovementStats(logs: GuestActivityLog[]) {
  const sortedLogs = sortLogsAscending(logs);
  let insideStartedAt: number | null = null;
  let outsideStartedAt: number | null = null;
  let totalInside = 0;
  let totalOutside = 0;

  for (const log of sortedLogs) {
    const timestamp = parseLogTime(log);
    if (Number.isNaN(timestamp)) continue;

    if (isInsideStatus(log.status)) {
      if (outsideStartedAt !== null) {
        totalOutside += timestamp - outsideStartedAt;
      }
      outsideStartedAt = null;
      if (insideStartedAt === null) insideStartedAt = timestamp;
    } else if (log.status === "Left Building") {
      if (insideStartedAt !== null) {
        totalInside += timestamp - insideStartedAt;
      }
      insideStartedAt = null;
      outsideStartedAt = timestamp;
    }
  }

  const now = Date.now();
  if (insideStartedAt !== null) totalInside += now - insideStartedAt;
  if (outsideStartedAt !== null) totalOutside += now - outsideStartedAt;

  return {
    totalInside,
    totalOutside,
  };
}

function GuestActivityView({
  guest,
  eventTitle,
  onBack,
  onRefresh,
}: {
  guest: GuestOwnerView;
  eventTitle: string;
  onBack: () => void;
  onRefresh: () => void;
}) {
  const stats = calculateMovementStats(guest.check_in_logs);
  const activityLogs = [...guest.check_in_logs].sort(
    (first, second) => parseLogTime(second) - parseLogTime(first)
  );
  const currentPresence = getCurrentPresence(guest);

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full border border-brand-400/20 px-4 py-2 text-xs font-semibold hover:bg-brand-400/10 transition"
        >
          Back to guests
        </button>
        <button
          type="button"
          onClick={onRefresh}
          className="rounded-full bg-brand-400 px-4 py-2 text-xs font-semibold text-black hover:shadow-[0_4px_12px_rgba(79,214,190,0.3)] transition"
        >
          Refresh
        </button>
      </div>

      <section className="rounded-2xl border border-brand-400/10 bg-brand-400/5 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">{guest.full_name}</h2>
            <p className="mt-1 text-sm text-foreground/60">
              {guest.category} Guest · {eventTitle}
            </p>
          </div>
          <span
            className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${
              currentPresence === "Currently inside"
                ? "border-brand-400/20 bg-brand-400/10 text-brand-400"
                : currentPresence === "Currently out"
                ? "border-sky-400/20 bg-sky-400/10 text-sky-300"
                : currentPresence === "Rejected"
                ? "border-red-400/20 bg-red-400/10 text-red-300"
                : "border-amber-400/20 bg-amber-400/10 text-amber-300"
            }`}
          >
            {currentPresence}
          </span>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-brand-400/10 bg-background p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-foreground/50">
              Total time inside
            </p>
            <p className="mt-2 text-2xl font-semibold text-brand-400">
              {formatDuration(stats.totalInside)}
            </p>
          </div>
          <div className="rounded-xl border border-brand-400/10 bg-background p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-foreground/50">
              Total time outside
            </p>
            <p className="mt-2 text-2xl font-semibold text-sky-300">
              {formatDuration(stats.totalOutside)}
            </p>
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold">Activity Log</h3>
        <div className="mt-4 space-y-3 border-l border-brand-400/20 pl-5">
          {activityLogs.length > 0 ? (
            activityLogs.map((log, index) => (
              <div key={`${log.timestamp}-${index}`} className="relative">
                <span className="absolute -left-[1.85rem] top-5 h-3 w-3 rounded-full border border-brand-400 bg-background" />
                <div className="rounded-xl border border-brand-400/10 bg-background p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-md bg-brand-400/10 px-2 py-1 text-[11px] font-semibold tracking-[0.15em] text-brand-400">
                      {formatActivityTime(log.timestamp)}
                    </span>
                    <span className="text-xs text-foreground/50">{log.door_id}</span>
                  </div>
                  <p className="mt-3 text-sm font-semibold">{log.status}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-brand-400/10 bg-background p-5 text-sm text-foreground/55">
              No scanner activity yet. The first Scan In will create the initial arrival.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function GuestInvitationModal({
  open,
  guest,
  onClose,
  prepareInvitation,
  onDownload,
  onShare,
}: {
  open: boolean;
  guest: GuestOwnerView | null;
  onClose: () => void;
  prepareInvitation: (
    guest: GuestOwnerView,
    format: GuestInvitationImageFormat,
    category: string,
  ) => Promise<Blob | null>;
  onDownload: (
    guest: GuestOwnerView,
    format: GuestInvitationImageFormat,
    blob: Blob,
  ) => Promise<void>;
  onShare: (
    guest: GuestOwnerView,
    format: GuestInvitationImageFormat,
    blob: Blob,
  ) => Promise<void>;
}) {
  const { activeEvent } = useEventContext();
  const { draft } = useFlyerDraft();
  const [qrResult, setQrResult] = useState<{ key: string; svg: string } | null>(null);
  const [busyAction, setBusyAction] = useState<"png" | "jpg" | "share" | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [categoryError, setCategoryError] = useState(false);
  const [shareFormatOpen, setShareFormatOpen] = useState(false);
  const [preparedByKey, setPreparedByKey] = useState<Record<string, {
    png?: Blob;
    jpg?: Blob;
  }>>({});
  const [backendPreview, setBackendPreview] = useState<{ key: string; url: string } | null>(null);
  const previewObjectUrl = useRef("");
  const preparationPromises = useRef(new Map<string, Promise<Blob | null>>());
  const qrHash = guest?.qr_hash ?? "";
  const qrKey = open && qrHash ? `${guest?.id ?? "guest"}:${qrHash}` : "";
  const qrSvg = qrResult?.key === qrKey ? qrResult.svg : "";
  const configuredCategories =
    activeEvent?.configuration.invitation_categories ?? defaultInvitationCategories;
  const categoriesEnabled =
    activeEvent?.configuration.invitation_categories_enabled !== false &&
    configuredCategories.length > 0;
  const invitationCategories =
    categoriesEnabled ? configuredCategories : [];
  const previewCategory = categoriesEnabled ? selectedCategory : "";
  const preparationKey =
    open && guest && (!categoriesEnabled || selectedCategory)
      ? `${activeEvent?.id ?? "draft"}:${guest.id}:${previewCategory}`
      : "";
  const preparedForSelection = preparationKey ? preparedByKey[preparationKey] : undefined;
  const backendPreviewUrl = backendPreview?.key === preparationKey ? backendPreview.url : "";
  const isPreparing = Boolean(
    preparationKey && (!preparedForSelection?.png || !preparedForSelection?.jpg),
  );

  const ensurePrepared = useCallback((format: GuestInvitationImageFormat) => {
    if (!preparationKey || !guest) return Promise.resolve(null);
    const promiseKey = `${preparationKey}:${format}`;
    const existing = preparationPromises.current.get(promiseKey);
    if (existing) return existing;

    const promise = prepareInvitation(guest, format, previewCategory)
      .then((blob) => {
        if (blob) {
          setPreparedByKey((current) => ({
            ...current,
            [preparationKey]: {
              ...current[preparationKey],
              [format]: blob,
            },
          }));
          if (format === "png") {
            const objectUrl = URL.createObjectURL(blob);
            if (previewObjectUrl.current) URL.revokeObjectURL(previewObjectUrl.current);
            previewObjectUrl.current = objectUrl;
            setBackendPreview({ key: preparationKey, url: objectUrl });
          }
        }
        return blob;
      })
      .catch((error) => {
        preparationPromises.current.delete(promiseKey);
        throw error;
      });
    preparationPromises.current.set(promiseKey, promise);
    return promise;
  }, [guest, preparationKey, prepareInvitation, previewCategory]);

  useEffect(() => {
    if (!qrKey) return;

    let cancelled = false;
    QRCode.toString(qrHash, {
      type: "svg",
      width: 240,
      margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then((svg) => {
        if (!cancelled) setQrResult({ key: qrKey, svg });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [qrHash, qrKey]);

  useEffect(() => {
    if (!preparationKey) return;
    void ensurePrepared("png").catch(() => undefined);
    void ensurePrepared("jpg").catch(() => undefined);
  }, [ensurePrepared, preparationKey]);

  useEffect(() => () => {
    if (previewObjectUrl.current) URL.revokeObjectURL(previewObjectUrl.current);
  }, []);

  if (!open || !guest || !draft.configuration) return null;

  const requireCategorySelection = () => {
    if (!categoriesEnabled || selectedCategory) return true;
    setCategoryError(true);
    window.setTimeout(() => setCategoryError(false), 450);
    return false;
  };

  const runAction = async (
    action: "png" | "jpg" | "share",
    format: GuestInvitationImageFormat,
    callback: (blob: Blob) => Promise<void>,
  ) => {
    if (!requireCategorySelection()) return;
    setBusyAction(action);
    try {
      const blob = preparedForSelection?.[format] ?? await ensurePrepared(format);
      if (blob) await callback(blob);
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close pass preview"
        onClick={onClose}
      />
      <div className="relative flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-brand-400/10 bg-background shadow-2xl modal-card-animate">
        <div className="flex items-center justify-between border-b border-brand-400/10 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold">Guest Pass</h3>
            <p className="text-xs text-foreground/50">{guest.full_name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-brand-400/20 px-3 py-1 text-xs font-medium text-foreground/70 hover:bg-brand-400/10 hover:text-brand-400 transition"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-black/30 px-5 py-5">
          <div className="mx-auto w-full max-w-[320px] shadow-2xl">
            {backendPreviewUrl ? (
              <Image
                src={backendPreviewUrl}
                alt={`${guest.full_name} invitation`}
                width={1080}
                height={1920}
                unoptimized
                className="block h-auto w-full"
              />
            ) : (
              <OriginalFlyer
                configuration={draft.configuration}
                layers={draft.layers}
                guestName={guest.full_name}
                guestCategory={previewCategory}
                qrSvg={qrSvg}
                eventDate={activeEvent?.event_date}
                eventTime={activeEvent?.event_time}
                eventLocation={activeEvent?.event_location}
              />
            )}
          </div>
        </div>

        <div className="border-t border-brand-400/10 px-5 py-4">
          {isPreparing && (
            <div className="mb-3 flex items-center justify-center gap-2 text-xs text-foreground/55">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-400/25 border-t-brand-400" aria-hidden="true" />
              Preparing download and share files…
            </div>
          )}
          {categoriesEnabled && (
            <div
              className={`mb-3 rounded-2xl border p-2 transition ${
                categoryError
                  ? "animate-pass-category-shake border-red-400 bg-red-400/10"
                  : "border-brand-400/10 bg-brand-400/5"
              }`}
            >
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-custom">
                {invitationCategories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => {
                      setSelectedCategory(category);
                      setCategoryError(false);
                    }}
                    className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      selectedCategory === category
                        ? "border-brand-400 bg-brand-400 text-black"
                        : "border-brand-400/20 bg-background text-foreground/70 hover:border-brand-400/50"
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => runAction("png", "png", (blob) => onDownload(guest, "png", blob))}
              disabled={busyAction !== null}
              className="flex-1 rounded-full border border-brand-400/20 px-3 py-2 text-xs font-semibold hover:bg-brand-400/10 transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busyAction === "png" ? "Preparing..." : "Download PNG"}
            </button>
            <button
              type="button"
              onClick={() => runAction("jpg", "jpg", (blob) => onDownload(guest, "jpg", blob))}
              disabled={busyAction !== null}
              className="flex-1 rounded-full border border-brand-400/20 px-3 py-2 text-xs font-semibold hover:bg-brand-400/10 transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busyAction === "jpg" ? "Preparing..." : "Download JPG"}
            </button>
            <div className="relative flex-1">
              <button
                type="button"
                onClick={() => {
                  if (!requireCategorySelection()) return;
                  setShareFormatOpen((isOpen) => !isOpen);
                }}
                disabled={busyAction !== null}
                className="w-full rounded-full bg-brand-400 px-3 py-2 text-xs font-semibold text-black hover:shadow-[0_8px_20px_rgba(79,214,190,0.3)] transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busyAction === "share" ? "Preparing..." : "Share"}
              </button>
              {shareFormatOpen && (
                <div className="absolute bottom-full right-0 mb-2 w-32 rounded-2xl border border-brand-400/20 bg-background p-1.5 shadow-2xl">
                  {(["png", "jpg"] as const).map((nextFormat) => (
                    <button
                      key={nextFormat}
                      type="button"
                      onClick={() => {
                        setShareFormatOpen(false);
                        void runAction("share", nextFormat, (blob) =>
                          onShare(guest, nextFormat, blob)
                        );
                      }}
                      className="w-full rounded-xl px-3 py-2 text-left text-xs font-semibold uppercase text-foreground/80 hover:bg-brand-400/10 hover:text-brand-400"
                    >
                      {nextFormat}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
