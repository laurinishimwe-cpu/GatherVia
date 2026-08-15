"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Fuse from "fuse.js";

import { useToast } from "@/components/providers/ToastProvider";
import { QrCodeModal } from "@/components/workspace/guests/QrCodeModal";
import { useEventContext } from "@/context/EventContext";
import {
  createAdminShareLink,
  deleteAdminShareLink,
  fetchAdminShareLinks,
  fetchEventPublicLinks,
  toggleAdminShareLink,
  updateAdminShareLinkPin,
} from "@/lib/api/communications";
import type {
  AdminActivityEntry,
  AdminShareLinkResponse,
  EventPublicLinksResponse,
} from "@/lib/types/communications";

function formatCreatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatActivityTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

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

interface AdminCardProps {
  link: AdminShareLinkResponse;
  actionLinkId: string | null;
  copiedKey: string | null;
  onCopy: (link: AdminShareLinkResponse) => void;
  onDelete: (link: AdminShareLinkResponse) => void;
  onOpen: (link: AdminShareLinkResponse) => void;
  onPin: (link: AdminShareLinkResponse) => void;
  onShare: (link: AdminShareLinkResponse) => void;
  onToggle: (link: AdminShareLinkResponse) => void;
}

function AdminCard({
  link,
  actionLinkId,
  copiedKey,
  onCopy,
  onDelete,
  onOpen,
  onPin,
  onShare,
  onToggle,
}: AdminCardProps) {
  const isBusy = actionLinkId === link.id;
  const activity = link.activity ?? { scanned_in: 0, scanned_out: 0, logs: [] };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(link)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(link);
        }
      }}
      className="w-full rounded-xl border border-brand-400/15 bg-background p-4 text-left transition hover:border-brand-400/35 hover:bg-brand-400/5"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-400/10 text-sm font-semibold text-brand-400">
            {(link.link_label || "A").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-semibold">{link.link_label}</h3>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  link.enabled
                    ? "bg-brand-400/15 text-brand-400"
                    : "bg-amber-400/15 text-amber-300"
                }`}
              >
                {link.enabled ? "Approved" : "Needs approval"}
              </span>
              {link.pin_enabled && (
                <span className="rounded-full bg-sky-400/15 px-2 py-0.5 text-[11px] font-semibold text-sky-300">
                  PIN
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-foreground/45">
              Added {formatCreatedAt(link.created_at)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <div className="rounded-xl border border-brand-400/10 bg-brand-400/5 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.16em] text-foreground/45">In</p>
            <p className="text-sm font-semibold text-brand-400">{activity.scanned_in}</p>
          </div>
          <div className="rounded-xl border border-sky-400/10 bg-sky-400/5 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.16em] text-foreground/45">Out</p>
            <p className="text-sm font-semibold text-sky-300">{activity.scanned_out}</p>
          </div>
        </div>

        <div
          className="flex flex-wrap items-center gap-2"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => onToggle(link)}
            disabled={isBusy}
            className="flex items-center gap-2 rounded-full border border-brand-400/15 px-3 py-2 text-xs font-semibold text-foreground/75 transition hover:border-brand-400/35 disabled:opacity-50"
          >
            <span
              className={`relative h-6 w-12 rounded-full transition ${
                link.enabled ? "bg-brand-400" : "bg-foreground/20"
              }`}
            >
              <span
                className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform ${
                  link.enabled ? "" : "translate-x-[1.35rem]"
                }`}
              />
            </span>
            {link.enabled ? "Approved" : "Approve"}
          </button>
          <button
            type="button"
            onClick={() => onCopy(link)}
            className={`flex h-9 w-9 items-center justify-center rounded-full border transition ${
              copiedKey === link.id
                ? "border-brand-400 bg-brand-400 text-black"
                : "border-brand-400/20 hover:bg-brand-400/10"
            }`}
            title="Copy scanner link"
          >
            <CopyCheckIcon copied={copiedKey === link.id} />
          </button>
          <button
            type="button"
            onClick={() => onShare(link)}
            className="rounded-full bg-brand-400 px-4 py-2 text-xs font-semibold text-black transition hover:shadow-[0_4px_12px_rgba(79,214,190,0.3)]"
          >
            Share
          </button>
          <button
            type="button"
            onClick={() => onPin(link)}
            disabled={isBusy}
            className="rounded-full border border-brand-400/20 px-3 py-2 text-xs font-semibold transition hover:bg-brand-400/10 disabled:opacity-50"
          >
            PIN
          </button>
          <button
            type="button"
            onClick={() => onDelete(link)}
            disabled={isBusy}
            className="flex h-9 w-9 items-center justify-center rounded-full text-red-400/70 transition hover:bg-red-400/10 hover:text-red-300 disabled:opacity-50"
            title="Delete admin"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminsPanel() {
  const { activeEvent } = useEventContext();
  const { toast } = useToast();
  const [links, setLinks] = useState<AdminShareLinkResponse[]>([]);
  const [adminName, setAdminName] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [actionLinkId, setActionLinkId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [selectedAdmin, setSelectedAdmin] = useState<AdminShareLinkResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminShareLinkResponse | null>(null);
  const [pinTarget, setPinTarget] = useState<AdminShareLinkResponse | null>(null);
  const [pinValue, setPinValue] = useState("");
  const [isSavingPin, setIsSavingPin] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [publicLinks, setPublicLinks] = useState<EventPublicLinksResponse | null>(null);

  const eventId = activeEvent?.id ?? "";
  const canManageLinks = /^[a-f\d]{24}$/i.test(eventId);
  const adminRsvpLink = publicLinks?.admin_rsvp_url ?? null;

  const loadLinks = useCallback(async () => {
    if (!canManageLinks) {
      setLinks([]);
      return;
    }

    setIsLoading(true);
    try {
      const [data, nextPublicLinks] = await Promise.all([
        fetchAdminShareLinks(eventId),
        fetchEventPublicLinks(eventId),
      ]);
      setLinks(data);
      setPublicLinks(nextPublicLinks);
      setSelectedAdmin((currentAdmin) =>
        currentAdmin ? data.find((link) => link.id === currentAdmin.id) ?? null : null,
      );
    } catch (caughtError) {
      toast(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not load admins.",
        "error",
      );
    } finally {
      setIsLoading(false);
    }
  }, [canManageLinks, eventId, toast]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadLinks(), 0);
    return () => window.clearTimeout(timer);
  }, [loadLinks]);

  useEffect(() => {
    if (!copiedKey) return;
    const timer = window.setTimeout(() => setCopiedKey(null), 1600);
    return () => window.clearTimeout(timer);
  }, [copiedKey]);

  const syncLink = (updatedLink: AdminShareLinkResponse) => {
    setLinks((currentLinks) => {
      const exists = currentLinks.some((link) => link.id === updatedLink.id);
      if (!exists) return [updatedLink, ...currentLinks];
      return currentLinks.map((link) => (link.id === updatedLink.id ? updatedLink : link));
    });
    setSelectedAdmin((currentAdmin) =>
      currentAdmin?.id === updatedLink.id ? updatedLink : currentAdmin,
    );
  };

  const handleCreate = async () => {
    const nextName = adminName.trim();
    if (!canManageLinks || !nextName) return;

    setIsCreating(true);
    try {
      const link = await createAdminShareLink(eventId, nextName);
      syncLink(link);
      setAdminName("");
      toast("Admin approved and scanner link created.", "success");
    } catch (caughtError) {
      toast(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not add admin.",
        "error",
      );
    } finally {
      setIsCreating(false);
    }
  };

  const copyText = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast("Link copied.", "success");
  };

  const handleCopy = async (link: AdminShareLinkResponse) => {
    await copyText(link.share_url, link.id);
  };

  const handleShare = async (link: AdminShareLinkResponse) => {
    const shareUrl = link.share_url;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${link.link_label} scanner link`,
          url: shareUrl,
        });
        return;
      } catch {}
    }
    await handleCopy(link);
  };

  const handleToggle = async (link: AdminShareLinkResponse) => {
    setActionLinkId(link.id);
    try {
      const updatedLink = await toggleAdminShareLink(link.id);
      syncLink(updatedLink);
      toast(updatedLink.enabled ? "Admin access approved." : "Admin access disabled.", "success");
    } catch (caughtError) {
      toast(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not update admin access.",
        "error",
      );
    } finally {
      setActionLinkId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    setActionLinkId(deleteTarget.id);
    try {
      await deleteAdminShareLink(deleteTarget.id);
      setLinks((currentLinks) => currentLinks.filter((item) => item.id !== deleteTarget.id));
      setSelectedAdmin((currentAdmin) => (currentAdmin?.id === deleteTarget.id ? null : currentAdmin));
      setDeleteTarget(null);
      toast("Admin deleted.", "success");
    } catch (caughtError) {
      toast(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not delete admin.",
        "error",
      );
    } finally {
      setActionLinkId(null);
    }
  };

  const openPinModal = (link: AdminShareLinkResponse) => {
    setPinTarget(link);
    setPinValue(link.pin_code ?? "");
  };

  const handleSavePin = async (enabled: boolean) => {
    if (!pinTarget) return;

    setIsSavingPin(true);
    setActionLinkId(pinTarget.id);
    try {
      const updatedLink = await updateAdminShareLinkPin(pinTarget.id, {
        pin_enabled: enabled,
        pin_code: enabled ? pinValue.trim() : null,
      });
      syncLink(updatedLink);
      setPinTarget(null);
      toast(enabled ? "Staff PIN enabled." : "Staff PIN disabled.", "success");
    } catch (caughtError) {
      toast(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not update staff PIN.",
        "error",
      );
    } finally {
      setIsSavingPin(false);
      setActionLinkId(null);
    }
  };

  const filteredLinks = useMemo(() => {
    const query = searchQuery.trim();
    if (!query) return links;

    const fuse = new Fuse(links, {
      keys: ["link_label", "enabled", "pin_enabled"],
      threshold: 0.35,
      ignoreLocation: true,
    });
    return fuse.search(query).map((result) => result.item);
  }, [links, searchQuery]);

  if (!activeEvent) {
    return (
      <div className="flex h-full items-center justify-center text-foreground/50">
        <p>Select an event to manage admin access.</p>
      </div>
    );
  }

  if (selectedAdmin) {
    return (
      <AdminActivityView
        admin={selectedAdmin}
        eventTitle={activeEvent.title}
        onBack={() => setSelectedAdmin(null)}
        onRefresh={loadLinks}
      />
    );
  }

  return (
    <div className="h-full overflow-y-auto p-8 scrollbar-custom">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-3xl font-semibold">Admins / Doormen</h2>
            <p className="mt-1 text-sm text-foreground/55">
              Approve scanner access and track each admin&apos;s door activity.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSearchOpen((isOpen) => !isOpen);
                if (searchOpen) setSearchQuery("");
              }}
              className={`flex h-9 w-9 items-center justify-center rounded-full border transition ${
                searchOpen
                  ? "border-brand-400 bg-brand-400 text-black"
                  : "border-brand-400/20 hover:bg-brand-400/10"
              }`}
              title="Search admins"
              aria-label="Search admins"
              aria-expanded={searchOpen}
            >
              <SearchIcon />
            </button>
            <button
              type="button"
              onClick={() => void loadLinks()}
              disabled={!canManageLinks || isLoading}
              className="w-fit rounded-full border border-brand-400/20 px-4 py-2 text-xs font-semibold transition hover:bg-brand-400/10 disabled:opacity-50"
            >
              {isLoading ? "Refreshing..." : "Refresh"}
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
                placeholder="Search admins by name or status"
                className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-foreground/40"
                aria-label="Search admins"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="text-xs text-foreground/50 hover:text-foreground"
                  aria-label="Clear admin search"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}

        {!canManageLinks && (
          <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm text-yellow-100">
            Save this event first before creating admin access.
          </div>
        )}

        <section className="rounded-xl border border-brand-400/15 bg-brand-400/5 p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold">Admin RSVP form</p>
              <p className="mt-1 text-xs text-foreground/55">
                Share this form so doormen can request scanner access by name.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => adminRsvpLink && copyText(adminRsvpLink, "admin-rsvp")}
                disabled={!adminRsvpLink}
                className={`flex h-9 w-9 items-center justify-center rounded-full border transition disabled:opacity-50 ${
                  copiedKey === "admin-rsvp"
                    ? "border-brand-400 bg-brand-400 text-black"
                    : "border-brand-400/20 hover:bg-brand-400/10"
                }`}
                title="Copy admin RSVP form"
              >
                <CopyCheckIcon copied={copiedKey === "admin-rsvp"} />
              </button>
              <button
                type="button"
                onClick={() => adminRsvpLink && setQrUrl(adminRsvpLink)}
                disabled={!adminRsvpLink}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-brand-400/20 transition hover:bg-brand-400/10 disabled:opacity-50"
                title="Show admin RSVP QR"
              >
                <QrIcon />
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!adminRsvpLink) return;
                  if (navigator.share) {
                    try {
                      await navigator.share({
                        title: `${activeEvent.title} admin RSVP`,
                        url: adminRsvpLink,
                      });
                      return;
                    } catch {}
                  }
                  await copyText(adminRsvpLink, "admin-rsvp");
                }}
                disabled={!adminRsvpLink}
                className="rounded-full bg-brand-400 px-4 py-2 text-xs font-semibold text-black transition hover:shadow-[0_4px_12px_rgba(79,214,190,0.3)] disabled:opacity-50"
              >
                Share form
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-brand-400/15 bg-background p-4">
          <p className="text-sm font-semibold">Add admin manually</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={adminName}
              onChange={(event) => setAdminName(event.target.value.slice(0, 64))}
              className="min-w-0 flex-1 rounded-full border border-brand-400/20 bg-background px-4 py-2.5 text-sm outline-none transition placeholder:text-foreground/35 focus:border-brand-400/50"
              placeholder="Admin name, e.g. Main Entrance"
              disabled={!canManageLinks}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleCreate();
                }
              }}
            />
            <button
              type="button"
              onClick={handleCreate}
              disabled={!canManageLinks || !adminName.trim() || isCreating}
              className="rounded-full bg-brand-400 px-5 py-2.5 text-sm font-semibold text-black transition hover:shadow-[0_4px_12px_rgba(79,214,190,0.3)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isCreating ? "Adding..." : "Add admin"}
            </button>
          </div>
        </section>

        <section className="space-y-3">
          <p className="text-sm font-semibold text-foreground/75">Admins</p>

          {isLoading ? (
            <div className="rounded-xl border border-brand-400/15 bg-brand-400/5 p-8 text-center text-sm text-foreground/50">
              Loading admins...
            </div>
          ) : filteredLinks.length > 0 ? (
            <div className="space-y-3">
              {filteredLinks.map((link) => (
                <AdminCard
                  key={link.id}
                  link={link}
                  actionLinkId={actionLinkId}
                  copiedKey={copiedKey}
                  onCopy={handleCopy}
                  onDelete={setDeleteTarget}
                  onOpen={setSelectedAdmin}
                  onPin={openPinModal}
                  onShare={handleShare}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-brand-400/15 bg-brand-400/5 p-10 text-center">
              <h3 className="text-lg font-semibold">
                {searchQuery.trim() ? "No admins match your search" : "No admins yet"}
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-foreground/50">
                {searchQuery.trim()
                  ? "Try a different name or status."
                  : "Add an admin manually or share the RSVP form to collect access requests."}
              </p>
            </div>
          )}
        </section>
      </div>

      <AdminDeleteConfirmModal
        adminName={deleteTarget?.link_label ?? ""}
        open={Boolean(deleteTarget)}
        isDeleting={Boolean(deleteTarget && actionLinkId === deleteTarget.id)}
        onCancel={() => {
          if (!actionLinkId) setDeleteTarget(null);
        }}
        onConfirm={handleConfirmDelete}
      />

      <AdminPinModal
        open={Boolean(pinTarget)}
        adminName={pinTarget?.link_label ?? ""}
        pinEnabled={Boolean(pinTarget?.pin_enabled)}
        pinValue={pinValue}
        isSaving={isSavingPin}
        onPinChange={setPinValue}
        onClose={() => {
          if (!isSavingPin) setPinTarget(null);
        }}
        onDisable={() => void handleSavePin(false)}
        onEnable={() => void handleSavePin(true)}
      />

      <QrCodeModal open={Boolean(qrUrl)} url={qrUrl} onClose={() => setQrUrl("")} />
    </div>
  );
}

function AdminActivityView({
  admin,
  eventTitle,
  onBack,
  onRefresh,
}: {
  admin: AdminShareLinkResponse;
  eventTitle: string;
  onBack: () => void;
  onRefresh: () => void;
}) {
  const logs = admin.activity?.logs ?? [];

  return (
    <div className="h-full overflow-y-auto p-8 scrollbar-custom">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="rounded-full border border-brand-400/20 px-4 py-2 text-xs font-semibold transition hover:bg-brand-400/10"
          >
            Back to admins
          </button>
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-full bg-brand-400 px-4 py-2 text-xs font-semibold text-black transition hover:shadow-[0_4px_12px_rgba(79,214,190,0.3)]"
          >
            Refresh
          </button>
        </div>

        <section className="rounded-2xl border border-brand-400/10 bg-brand-400/5 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">{admin.link_label}</h2>
              <p className="mt-1 text-sm text-foreground/60">
                {eventTitle} · scanner activity
              </p>
            </div>
            <span
              className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${
                admin.enabled
                  ? "border-brand-400/20 bg-brand-400/10 text-brand-400"
                  : "border-amber-400/20 bg-amber-400/10 text-amber-300"
              }`}
            >
              {admin.enabled ? "Approved" : "Needs approval"}
            </span>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-brand-400/10 bg-background p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-foreground/50">
                People scanned in
              </p>
              <p className="mt-2 text-2xl font-semibold text-brand-400">
                {admin.activity?.scanned_in ?? 0}
              </p>
            </div>
            <div className="rounded-xl border border-brand-400/10 bg-background p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-foreground/50">
                People scanned out
              </p>
              <p className="mt-2 text-2xl font-semibold text-sky-300">
                {admin.activity?.scanned_out ?? 0}
              </p>
            </div>
            <div className="rounded-xl border border-red-400/10 bg-red-400/5 p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-foreground/50">
                Denied attempts
              </p>
              <p className="mt-2 text-2xl font-semibold text-red-300">
                {admin.activity?.denied ?? 0}
              </p>
            </div>
            <div className="rounded-xl border border-amber-400/10 bg-amber-400/5 p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-foreground/50">
                Duplicate denied
              </p>
              <p className="mt-2 text-2xl font-semibold text-amber-300">
                {admin.activity?.duplicate_denied ?? 0}
              </p>
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-lg font-semibold">Activity Log</h3>
          <div className="mt-4 space-y-3 border-l border-brand-400/20 pl-5">
            {logs.length > 0 ? (
              logs.map((log: AdminActivityEntry, index) => (
                <div key={`${log.timestamp}-${log.guest_id}-${index}`} className="relative">
                  <span className="absolute -left-[1.85rem] top-5 h-3 w-3 rounded-full border border-brand-400 bg-background" />
                  <div className="rounded-xl border border-brand-400/10 bg-background p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-md bg-brand-400/10 px-2 py-1 text-[11px] font-semibold tracking-[0.15em] text-brand-400">
                        {formatActivityTime(log.timestamp)}
                      </span>
                      <span className="text-xs text-foreground/50">{log.guest_category}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold">{log.status}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                          log.outcome === "denied"
                            ? "bg-red-400/10 text-red-300"
                            : "bg-brand-400/10 text-brand-400"
                        }`}
                      >
                        {log.outcome}
                      </span>
                      <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/55">
                        {log.lookup_method}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-foreground/55">{log.guest_name}</p>
                    {log.reason ? (
                      <p className="mt-2 text-xs text-foreground/45">{log.reason}</p>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-brand-400/10 bg-background p-5 text-sm text-foreground/55">
                No scanner activity yet. Scans made with this admin link will appear here.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function AdminPinModal({
  open,
  adminName,
  pinEnabled,
  pinValue,
  isSaving,
  onPinChange,
  onClose,
  onDisable,
  onEnable,
}: {
  open: boolean;
  adminName: string;
  pinEnabled: boolean;
  pinValue: string;
  isSaving: boolean;
  onPinChange: (value: string) => void;
  onClose: () => void;
  onDisable: () => void;
  onEnable: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-3xl border border-brand-400/10 bg-background p-6 shadow-2xl">
        <h2 className="text-lg font-semibold">Staff PIN</h2>
        <p className="mt-2 text-sm text-foreground/70">
          Set an optional PIN for <strong>{adminName}</strong>. The scanner will ask for it before scanning.
        </p>
        <input
          type="text"
          inputMode="numeric"
          value={pinValue}
          maxLength={12}
          onChange={(event) => onPinChange(event.target.value.slice(0, 12))}
          className="mt-5 w-full rounded-xl border border-brand-400/20 bg-background px-4 py-3 text-center text-sm font-semibold tracking-[0.3em] outline-none focus:border-brand-400/50"
          placeholder="1234"
        />
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="flex-1 rounded-full border border-brand-400/20 px-4 py-2 text-sm transition hover:bg-brand-400/5 disabled:opacity-50"
          >
            Cancel
          </button>
          {pinEnabled && (
            <button
              type="button"
              onClick={onDisable}
              disabled={isSaving}
              className="flex-1 rounded-full border border-red-400/20 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-400/10 disabled:opacity-50"
            >
              Disable
            </button>
          )}
          <button
            type="button"
            onClick={onEnable}
            disabled={isSaving || pinValue.trim().length < 4}
            className="flex-1 rounded-full bg-brand-400 py-2 text-sm font-semibold text-black transition hover:shadow-[0_8px_20px_rgba(79,214,190,0.3)] disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminDeleteConfirmModal({
  adminName,
  open,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  adminName: string;
  open: boolean;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-3xl border border-brand-400/10 bg-background p-6 shadow-2xl">
        <h2 className="text-lg font-semibold">Delete admin?</h2>
        <p className="mt-2 text-sm text-foreground/70">
          Are you sure you want to delete <strong>{adminName}</strong>? Their scanner link will stop working.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 rounded-full border border-brand-400/20 px-4 py-2 text-sm transition hover:bg-brand-400/5 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 rounded-full bg-red-500 py-2 text-sm font-semibold text-white transition hover:shadow-[0_8px_20px_rgba(239,68,68,0.3)] disabled:opacity-50"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
