"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEventContext } from "@/context/EventContext";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/providers/ToastProvider";
import { UpgradeModal } from "@/components/dashboard/UpgradeModal";
import {
  checkGuestLimit,
  PLAN_DEFINITIONS,
  type GuestLimitStatus,
  type PlanDefinition,
} from "@/lib/api/plans";
import type { EventRecord, EventType } from "@/lib/types/event";
import type { UserTier } from "@/lib/types/auth";
import {
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  CreditCard,
  MapPin,
  Smartphone,
  Users,
} from "lucide-react";

const eventTypes: Array<{ label: string; value: EventType }> = [
  { label: "Wedding", value: "marriage" },
  { label: "Corporate", value: "corporate" },
  { label: "Private", value: "private" },
  { label: "Conference", value: "conference" },
  { label: "Gala", value: "gala" },
  { label: "Other", value: "other" },
];
const defaultInvitationCategories = ["General", "VIP"];
type SettingsSaveStatus = "idle" | "pending" | "saving" | "saved" | "waiting" | "error";

export function SettingsPanel() {
  const { activeEvent, saveEventSettings } = useEventContext();
  if (!activeEvent) return null;

  return (
    <SettingsForm
      key={activeEvent.id}
      activeEvent={activeEvent}
      saveEventSettings={saveEventSettings}
    />
  );
}

function SettingsForm({
  activeEvent,
  saveEventSettings,
}: {
  activeEvent: EventRecord;
  saveEventSettings: (updates: Partial<EventRecord>) => Promise<void>;
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const localTimeZone = useMemo(() => resolveLocalTimeZone(), []);
  const [activeSettingsView, setActiveSettingsView] = useState<"event" | "plans">("event");
  const [categoryInput, setCategoryInput] = useState("");
  const [title, setTitle] = useState(activeEvent?.title ?? "");
  const [eventType, setEventType] = useState<EventType>(activeEvent?.event_type ?? "other");
  const [eventDate, setEventDate] = useState(activeEvent?.event_date ?? "");
  const [eventTime, setEventTime] = useState(activeEvent?.event_time?.slice(0, 5) ?? "");
  const [eventLocation, setEventLocation] = useState(activeEvent?.event_location ?? "");
  const [requireApproval, setRequireApproval] = useState(activeEvent?.require_rsvp_approval !== false);
  const [categoriesEnabled, setCategoriesEnabled] = useState(activeEvent?.configuration.invitation_categories_enabled !== false);
  const [invitationCategories, setInvitationCategories] = useState<string[]>(activeEvent?.configuration.invitation_categories ?? defaultInvitationCategories);
  const [saveStatus, setSaveStatus] = useState<SettingsSaveStatus>("idle");
  const [selectedPlan, setSelectedPlan] = useState<PlanDefinition | null>(null);
  const [showUpgradeQr, setShowUpgradeQr] = useState(false);
  const [guestLimitStatus, setGuestLimitStatus] = useState<GuestLimitStatus | null>(null);
  const [guestLimitLoading, setGuestLimitLoading] = useState(false);
  const [guestLimitError, setGuestLimitError] = useState("");
  const currentTier = guestLimitStatus?.tier ?? user?.tier ?? "free";
  const settingsDraft = useMemo<Partial<EventRecord>>(() => ({
    title: title.trim(),
    event_type: eventType,
    event_date: eventDate,
    event_time: eventTime || null,
    event_timezone: localTimeZone,
    event_location: eventLocation.trim() || null,
    require_rsvp_approval: requireApproval,
    configuration: {
      ...activeEvent.configuration,
      invitation_categories_enabled: categoriesEnabled,
      invitation_categories: invitationCategories,
    },
  }), [
    activeEvent.configuration,
    categoriesEnabled,
    eventDate,
    eventLocation,
    eventTime,
    eventType,
    invitationCategories,
    localTimeZone,
    requireApproval,
    title,
  ]);
  const draftSignature = useMemo(() => JSON.stringify(settingsDraft), [settingsDraft]);
  const initialSignature = useMemo(() => JSON.stringify({
    title: activeEvent.title.trim(),
    event_type: activeEvent.event_type,
    event_date: activeEvent.event_date ?? "",
    event_time: activeEvent.event_time?.slice(0, 5) || null,
    event_timezone: activeEvent.event_timezone ?? localTimeZone,
    event_location: activeEvent.event_location?.trim() || null,
    require_rsvp_approval: activeEvent.require_rsvp_approval !== false,
    configuration: {
      ...activeEvent.configuration,
      invitation_categories_enabled: activeEvent.configuration.invitation_categories_enabled !== false,
      invitation_categories: activeEvent.configuration.invitation_categories ?? defaultInvitationCategories,
    },
  }), [activeEvent, localTimeZone]);
  const [lastSavedSignature, setLastSavedSignature] = useState(initialSignature);
  const lastSavedSignatureRef = useRef(initialSignature);
  const latestDraftRef = useRef({ payload: settingsDraft, signature: draftSignature });
  const savePromiseRef = useRef<Promise<boolean> | null>(null);
  const saveEventSettingsRef = useRef(saveEventSettings);
  const hasUnsavedChanges = draftSignature !== lastSavedSignature;

  useEffect(() => {
    latestDraftRef.current = { payload: settingsDraft, signature: draftSignature };
  }, [draftSignature, settingsDraft]);

  useEffect(() => {
    saveEventSettingsRef.current = saveEventSettings;
  }, [saveEventSettings]);

  useEffect(() => () => {
    void (async () => {
      if (savePromiseRef.current) await savePromiseRef.current;
      const { payload, signature } = latestDraftRef.current;
      if (
        signature === lastSavedSignatureRef.current ||
        !String(payload.title ?? "").trim() ||
        !String(payload.event_date ?? "").trim()
      ) return;
      await saveEventSettingsRef.current(payload).catch(() => undefined);
    })();
  }, []);

  const addInvitationCategory = () => {
    const nextCategory = categoryInput.trim();
    if (!nextCategory || nextCategory.length > 10) return;
    if (invitationCategories.some((category) => category.toLowerCase() === nextCategory.toLowerCase())) {
      setCategoryInput("");
      return;
    }

    setInvitationCategories((current) => [...current, nextCategory]);
    setCategoryInput("");
  };

  const removeInvitationCategory = (categoryToRemove: string) => {
    setInvitationCategories((current) => current.filter((category) => category !== categoryToRemove));
  };

  const flushSettings = useCallback(async (announceValidation = false): Promise<boolean> => {
    while (true) {
      if (savePromiseRef.current) {
        const previousSaveSucceeded = await savePromiseRef.current;
        if (!previousSaveSucceeded) return false;
      }

      const { payload, signature } = latestDraftRef.current;
      if (signature === lastSavedSignatureRef.current) return true;
      if (!String(payload.title ?? "").trim() || !String(payload.event_date ?? "").trim()) {
        setSaveStatus("waiting");
        if (announceValidation) toast("Add an event name and date before leaving Settings.", "error");
        return false;
      }

      setSaveStatus("saving");
      const request = saveEventSettings(payload)
        .then(() => {
          lastSavedSignatureRef.current = signature;
          setLastSavedSignature(signature);
          setSaveStatus(latestDraftRef.current.signature === signature ? "saved" : "pending");
          return true;
        })
        .catch((error) => {
          setSaveStatus("error");
          toast(error instanceof Error ? `Settings were not saved: ${error.message}` : "Settings were not saved.", "error");
          return false;
        });
      savePromiseRef.current = request;
      const succeeded = await request;
      if (savePromiseRef.current === request) savePromiseRef.current = null;
      if (!succeeded) return false;
      if (latestDraftRef.current.signature === lastSavedSignatureRef.current) return true;
    }
  }, [saveEventSettings, toast]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const valid = Boolean(title.trim() && eventDate.trim());
    const timer = window.setTimeout(() => {
      if (!valid) {
        setSaveStatus("waiting");
        return;
      }
      setSaveStatus("pending");
      void flushSettings(false);
    }, valid ? 900 : 0);
    return () => window.clearTimeout(timer);
  }, [draftSignature, eventDate, flushSettings, hasUnsavedChanges, title]);

  const showPlans = async () => {
    if (!(await flushSettings(true))) return;
    setActiveSettingsView("plans");
    if (guestLimitLoading) return;

    setGuestLimitLoading(true);
    setGuestLimitError("");
    try {
      setGuestLimitStatus(await checkGuestLimit(activeEvent.id));
    } catch (error) {
      setGuestLimitError(
        error instanceof Error ? error.message : "Could not load guest usage right now.",
      );
    } finally {
      setGuestLimitLoading(false);
    }
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div
        className="grid w-full grid-cols-2 gap-1 rounded-2xl border border-brand-400/10 bg-brand-400/5 p-1 sm:inline-grid sm:w-auto sm:min-w-[360px]"
        role="tablist"
        aria-label="Settings sections"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeSettingsView === "event"}
          onClick={() => setActiveSettingsView("event")}
          className={`relative inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition ${
            activeSettingsView === "event"
              ? "bg-background text-foreground shadow-sm ring-1 ring-brand-400/15"
              : "text-foreground/55 hover:text-foreground"
          }`}
        >
          <CalendarDays className="h-4 w-4" aria-hidden="true" />
          Event settings
          {hasUnsavedChanges && activeSettingsView !== "event" && (
            <span className="h-1.5 w-1.5 rounded-full bg-brand-400" aria-label="Unsaved changes" />
          )}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeSettingsView === "plans"}
          onClick={() => void showPlans()}
          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition ${
            activeSettingsView === "plans"
              ? "bg-background text-foreground shadow-sm ring-1 ring-brand-400/15"
              : "text-foreground/55 hover:text-foreground"
          }`}
        >
          <CreditCard className="h-4 w-4" aria-hidden="true" />
          Plans
        </button>
      </div>

      {activeSettingsView === "event" ? (
        <div className="max-w-lg space-y-6" role="tabpanel">
          <div>
            <h2 className="text-2xl font-semibold">Event settings</h2>
            <p className="mt-1 text-sm text-foreground/55">
              Manage this event’s details, RSVP flow, and guest pass options.
            </p>
          </div>

      <div>
        <label className="block text-sm font-medium mb-1">Event name</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-xl border border-brand-400/20 bg-background px-3 py-2.5 text-sm outline-none focus:border-brand-400/50"
          placeholder="e.g. Amara & Kofi Wedding"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Event type</label>
        <div className="flex flex-wrap gap-2">
          {eventTypes.map((type) => (
            <button
              key={type.value}
              onClick={() => setEventType(type.value)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium border transition ${
                eventType === type.value
                  ? "border-brand-400 bg-brand-400/10 text-brand-400"
                  : "border-brand-400/20 bg-brand-400/5 text-foreground/70 hover:border-brand-400/40"
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      <CalendarDateCard
        value={eventDate}
        onChange={setEventDate}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <TimePickerCard
          value={eventTime}
          onChange={setEventTime}
        />
        <label className="rounded-xl border border-brand-400/10 bg-brand-400/5 p-4 flex flex-col justify-between">
          <span className="mb-2 flex items-center gap-2 text-sm font-medium">
            <MapPin className="h-4 w-4 text-brand-400" />
            Location <span className="text-[10px] font-normal text-foreground/45">Optional</span>
          </span>
          <input
            type="text"
            value={eventLocation}
            maxLength={160}
            onChange={(event) => setEventLocation(event.target.value)}
            placeholder="Venue or address"
            className="w-full rounded-xl border border-brand-400/20 bg-background px-3 py-2.5 text-sm outline-none focus:border-brand-400/50"
          />
        </label>
      </div>

      {/* RSVP approval toggle */}
      <div className="flex items-center justify-between rounded-xl border border-brand-400/10 bg-brand-400/5 p-4">
        <div>
          <p className="text-sm font-medium">Require RSVP approval</p>
          <p className="text-xs text-foreground/60">
            When on, new registrations must be manually approved.
          </p>
        </div>
        <button
          onClick={() => setRequireApproval((current) => !current)}
          className={`relative w-12 h-6 rounded-full transition ${
            requireApproval ? "bg-brand-400" : "bg-foreground/20"
          }`}
        >
          <span
            className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
              requireApproval ? "" : "translate-x-[1.35rem]"
            }`}
          />
        </button>
      </div>

      <div className="rounded-xl border border-brand-400/10 bg-brand-400/5 p-4 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Pass categories</p>
            <p className="text-xs text-foreground/60">
              Choose short labels available when sharing guest passes.
            </p>
          </div>
          <button
            onClick={() =>
              setCategoriesEnabled((current) => !current)
            }
            className={`relative h-6 w-12 rounded-full transition ${
              categoriesEnabled ? "bg-brand-400" : "bg-foreground/20"
            }`}
          >
            <span
              className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform ${
                categoriesEnabled ? "" : "translate-x-[1.35rem]"
              }`}
            />
          </button>
        </div>

        {categoriesEnabled && (
          <>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-custom">
              {invitationCategories.map((category) => (
                <span
                  key={category}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-brand-400/20 bg-background px-3 py-1 text-xs font-semibold"
                >
                  {category}
                  <button
                    type="button"
                    onClick={() => removeInvitationCategory(category)}
                    className="ml-1 text-foreground/40 hover:text-red-400"
                    title={`Remove ${category}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={categoryInput}
                maxLength={10}
                onChange={(e) => setCategoryInput(e.target.value.slice(0, 10))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addInvitationCategory();
                  }
                }}
                className="min-w-0 flex-1 rounded-xl border border-brand-400/20 bg-background px-3 py-2 text-sm outline-none focus:border-brand-400/50"
                placeholder="Custom label"
              />
              <button
                type="button"
                onClick={addInvitationCategory}
                disabled={!categoryInput.trim()}
                className="rounded-full bg-brand-400 px-4 py-2 text-xs font-semibold text-black transition hover:shadow-[0_4px_12px_rgba(79,214,190,0.3)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add
              </button>
            </div>
            <p className="text-[11px] text-foreground/50">Maximum 10 characters per label.</p>
          </>
        )}
      </div>

        </div>
      ) : (
        <PlansView
          currentTier={currentTier}
          guestLimitStatus={guestLimitStatus}
          loading={guestLimitLoading}
          error={guestLimitError}
          onSelectPlan={(plan) => {
            setSelectedPlan(plan);
            setShowUpgradeQr(false);
          }}
        />
      )}

      {(hasUnsavedChanges || saveStatus === "saved" || saveStatus === "error") && activeSettingsView === "event" && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 pointer-events-none">
          <button
            type="button"
            onClick={() => void flushSettings(true)}
            disabled={saveStatus === "saving"}
            className={`pointer-events-auto inline-flex items-center rounded-full px-6 py-3 text-sm font-semibold shadow-[0_12px_30px_rgba(0,0,0,0.25)] transition disabled:cursor-wait disabled:opacity-70 ${
              saveStatus === "error" || saveStatus === "waiting"
                ? "border border-red-400/30 bg-background text-red-300"
                : "bg-brand-400 text-black hover:shadow-[0_10px_26px_rgba(79,214,190,0.3)]"
            }`}
          >
            {saveStatus === "saving"
              ? "Saving automatically…"
              : saveStatus === "pending"
                ? "Changes queued…"
                : saveStatus === "saved"
                  ? "All changes saved"
                  : saveStatus === "waiting"
                    ? "Complete required fields"
                    : saveStatus === "error"
                      ? "Retry autosave"
                      : "Changes save automatically"}
          </button>
        </div>
      )}

      <PlanInfoSheet
        plan={showUpgradeQr ? null : selectedPlan}
        currentTier={currentTier}
        onClose={() => setSelectedPlan(null)}
        onUpgrade={() => setShowUpgradeQr(true)}
      />

      <UpgradeModal
        open={Boolean(selectedPlan && showUpgradeQr)}
        onClose={() => {
          setShowUpgradeQr(false);
          setSelectedPlan(null);
        }}
        targetPlan={selectedPlan}
        title={selectedPlan ? `${selectedPlan.name} continues on mobile` : undefined}
        message="Scan the QR code or use the store link for this device. Your plan purchase will be handled securely by Apple or Google."
      />
    </div>
  );
}

function resolveLocalTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function PlansView({
  currentTier,
  guestLimitStatus,
  loading,
  error,
  onSelectPlan,
}: {
  currentTier: UserTier;
  guestLimitStatus: GuestLimitStatus | null;
  loading: boolean;
  error: string;
  onSelectPlan: (plan: PlanDefinition) => void;
}) {
  const currentPlan =
    PLAN_DEFINITIONS.find((plan) => plan.tier === currentTier) ?? PLAN_DEFINITIONS[0];
  const currentGuests = guestLimitStatus?.current ?? 0;
  const guestLimit = guestLimitStatus?.limit ?? currentPlan.guestLimit;
  const hasLiveUsage = guestLimitStatus !== null;
  const progress = guestLimit > 0 ? Math.min(100, (currentGuests / guestLimit) * 100) : 0;
  const guestsRemaining = Math.max(guestLimit - currentGuests, 0);

  return (
    <div className="space-y-6" role="tabpanel">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-400">
            Event capacity
          </p>
          <h2 className="mt-1 text-2xl font-semibold">Plans</h2>
          <p className="mt-1 max-w-xl text-sm leading-6 text-foreground/55">
            Every event includes the Free plan with space for 50 guests. Upgrade only when
            you need more room.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 text-xs text-foreground/50">
          <Smartphone className="h-4 w-4 text-brand-400" aria-hidden="true" />
          Upgrades continue in the mobile app
        </div>
      </div>

      <section className="overflow-hidden rounded-3xl border border-brand-400/20 bg-gradient-to-br from-brand-400/15 via-brand-400/5 to-transparent p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-400/15 text-brand-400">
              <Users className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-400">
                Current plan
              </p>
              <h3 className="mt-1 text-xl font-semibold">{currentPlan.name}</h3>
            </div>
          </div>
          <div className="sm:text-right">
            {loading ? (
              <div className="h-8 w-28 animate-pulse rounded-xl bg-foreground/10" />
            ) : (
              <p className="text-2xl font-semibold">
                {hasLiveUsage ? currentGuests : "—"}
                <span className="text-base font-medium text-foreground/45"> / {guestLimit}</span>
              </p>
            )}
            <p className="text-xs text-foreground/50">guests added</p>
          </div>
        </div>

        <div className="mt-6">
          <div
            className="h-3 overflow-hidden rounded-full bg-foreground/10"
            role="progressbar"
            aria-label={`${currentPlan.name} guest usage`}
            aria-valuemin={0}
            aria-valuemax={guestLimit}
            aria-valuenow={hasLiveUsage ? currentGuests : undefined}
          >
            <div
              className="h-full rounded-full bg-brand-400 shadow-[0_0_18px_rgba(79,214,190,0.35)] transition-[width] duration-500"
              style={{ width: loading || !hasLiveUsage ? "0%" : `${progress}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 text-xs text-foreground/50">
            <span>
              {loading
                ? "Loading guest usage…"
                : hasLiveUsage
                  ? `${guestsRemaining} guest spaces remaining`
                  : "Guest usage unavailable"}
            </span>
            <span>{loading || !hasLiveUsage ? "" : `${Math.round(progress)}% used`}</span>
          </div>
          {error && (
            <p className="mt-3 text-xs text-amber-300/80">
              Live guest usage is unavailable. Your {guestLimit}-guest plan limit is still shown.
            </p>
          )}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        {PLAN_DEFINITIONS.map((plan) => {
          const isCurrent = plan.tier === currentTier;
          const isIncludedFreePlan = plan.tier === "free" && !isCurrent;
          const gradient =
            plan.tier === "pro"
              ? "from-brand-400/20 via-brand-400/8 to-transparent"
              : plan.tier === "basic"
                ? "from-brand-400/12 via-brand-400/5 to-transparent"
                : "from-foreground/8 to-transparent";

          return (
            <button
              key={plan.tier}
              type="button"
              onClick={() => onSelectPlan(plan)}
              aria-label={`View ${plan.name} plan details`}
              className={`group flex min-h-[280px] flex-col rounded-3xl border bg-gradient-to-br p-5 text-left transition sm:p-6 ${gradient} ${
                isCurrent
                  ? "border-brand-400/35 ring-1 ring-brand-400/10"
                  : "border-brand-400/10 hover:-translate-y-1 hover:border-brand-400/35 hover:shadow-[0_18px_45px_rgba(0,0,0,0.16)]"
              }`}
            >
              <div className="flex w-full items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold">{plan.name}</p>
                  <p className="mt-2 text-2xl font-semibold text-brand-400">
                    {plan.tier === "free" ? "Free" : "Store price"}
                  </p>
                  {plan.tier !== "free" && (
                    <p className="mt-0.5 text-[11px] text-foreground/40">live price in the mobile app</p>
                  )}
                </div>
                {isCurrent ? (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-400 text-brand-950">
                    <Check className="h-4 w-4" aria-hidden="true" />
                  </span>
                ) : (
                  <ChevronRight className="h-5 w-5 text-foreground/30 transition group-hover:translate-x-0.5 group-hover:text-brand-400" aria-hidden="true" />
                )}
              </div>

              <p className="mt-7 text-4xl font-semibold tracking-tight">{plan.guestLimit}</p>
              <p className="mt-1 text-sm text-foreground/50">guests per event</p>
              <p className="mt-5 text-sm leading-6 text-foreground/60">{plan.description}</p>

              <div className="mt-auto pt-6 text-xs font-semibold text-brand-400">
                {isCurrent
                  ? "Current plan"
                  : isIncludedFreePlan
                    ? "Included default plan"
                    : "View upgrade details"}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PlanInfoSheet({
  plan,
  currentTier,
  onClose,
  onUpgrade,
}: {
  plan: PlanDefinition | null;
  currentTier: UserTier;
  onClose: () => void;
  onUpgrade: () => void;
}) {
  if (!plan) return null;

  const isCurrent = plan.tier === currentTier;
  const canUpgrade = !isCurrent && plan.tier !== "free";

  return (
    <div
      className="fixed inset-0 z-[95] flex items-end justify-center p-3 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-info-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm modal-backdrop-animate"
        onClick={onClose}
        aria-label="Close plan details"
      />
      <div className="relative w-full max-w-sm rounded-3xl border border-brand-400/15 bg-background p-5 shadow-2xl modal-card-animate sm:p-6">
        <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-foreground/15 sm:hidden" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-400">
              {isCurrent ? "Your subscription" : "Plan details"}
            </p>
            <h2 id="plan-info-title" className="mt-2 text-xl font-semibold">
              {plan.name}
            </h2>
          </div>
          <p className="text-xl font-semibold text-brand-400">
            {plan.tier === "free" ? "Free" : "Store price"}
          </p>
        </div>

        <div className="mt-5 rounded-2xl border border-brand-400/10 bg-gradient-to-br from-brand-400/10 to-transparent p-4">
          <p className="text-3xl font-semibold">{plan.guestLimit}</p>
          <p className="mt-1 text-sm text-foreground/55">guests per event</p>
          <p className="mt-4 text-sm leading-6 text-foreground/65">{plan.description}</p>
        </div>

        <ul className="mt-5 space-y-3 text-sm text-foreground/70">
          {["Digital invitations and QR passes", "Guest list and check-in tools", "Event activity and attendance insights"].map((feature) => (
            <li key={feature} className="flex items-center gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-400/10 text-brand-400">
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              {feature}
            </li>
          ))}
        </ul>

        {isCurrent ? (
          <div className="mt-6 rounded-full bg-brand-400/10 px-4 py-2.5 text-center text-sm font-semibold text-brand-400">
            Current plan
          </div>
        ) : canUpgrade ? (
          <>
            <p className="mt-5 text-xs leading-5 text-foreground/50">
              You’ll continue in the GatherVia mobile app to confirm this plan.
            </p>
            <button
              type="button"
              onClick={onUpgrade}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-brand-400 px-5 text-sm font-semibold text-brand-950 transition hover:-translate-y-0.5 hover:bg-brand-500"
            >
              <Smartphone className="h-4 w-4" aria-hidden="true" />
              Upgrade on mobile
            </button>
          </>
        ) : (
          <div className="mt-6 rounded-2xl border border-brand-400/10 bg-brand-400/5 px-4 py-3 text-center text-sm text-foreground/65">
            Free is the included 50-guest plan. No purchase is required.
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-3 min-h-11 w-full rounded-full border border-brand-400/15 px-4 text-sm transition hover:bg-brand-400/5"
        >
          {isCurrent || !canUpgrade ? "Close" : "Maybe later"}
        </button>
      </div>
    </div>
  );
}

function TimePickerCard({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [is24Hour, setIs24Hour] = useState(false);
  const parsed = parseTimeValue(value);
  const [tempHour, setTempHour] = useState(parsed.hour);
  const [tempMinute, setTempMinute] = useState(parsed.minute);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      const parsedValue = parseTimeValue(value);
      setTempHour(parsedValue.hour);
      setTempMinute(parsedValue.minute);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, value]);

  // Derived 12-hour values for internal state checks
  const currentAmPm = tempHour >= 12 ? "PM" : "AM";
  const current12h = tempHour % 12 || 12;

  const updateHour12 = (h: number) => {
    let newHour = h;
    if (currentAmPm === "PM" && h < 12) newHour += 12;
    if (currentAmPm === "AM" && h === 12) newHour = 0;
    setTempHour(newHour);
    onChange(formatTimeValue(newHour, tempMinute));
  };

  const updateAmPm = (meridiem: string) => {
    if (meridiem === currentAmPm) return;
    let newHour = tempHour;
    if (meridiem === "PM" && tempHour < 12) newHour += 12;
    if (meridiem === "AM" && tempHour >= 12) newHour -= 12;
    setTempHour(newHour);
    onChange(formatTimeValue(newHour, tempMinute));
  };

  const updateHour24 = (h: number) => {
    setTempHour(h);
    onChange(formatTimeValue(h, tempMinute));
  };

  const updateMinute = (m: number) => {
    setTempMinute(m);
    onChange(formatTimeValue(tempHour, m));
  };

  return (
    <>
      <div className="flex flex-col justify-between rounded-xl border border-brand-400/10 bg-brand-400/5 p-4">
        <span className="mb-2 flex items-center gap-2 text-sm font-medium">
          <Clock3 className="h-4 w-4 text-brand-400" />
          Start time <span className="text-[10px] font-normal text-foreground/45">Optional</span>
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full rounded-xl border border-brand-400/20 bg-background px-3 py-2.5 text-left text-sm outline-none transition hover:border-brand-400/50 focus:border-brand-400/50"
        >
          <span className={value ? "" : "text-foreground/50"}>
            {value ? formatTimeDisplay(value, is24Hour) : "Select time"}
          </span>
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close time picker"
            onClick={() => setOpen(false)}
          />
          <div className="relative w-full max-w-sm rounded-2xl border border-brand-400/20 bg-background p-4 shadow-2xl modal-card-animate">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Choose event time</p>
                <p className="text-xs text-foreground/50">
                  {value ? formatTimeDisplay(value, is24Hour) : "No time selected"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-brand-400/20 px-3 py-1 text-xs text-foreground/60 hover:bg-brand-400/10"
              >
                Close
              </button>
            </div>
            
            <div className="space-y-4 rounded-xl border border-brand-400/10 bg-brand-400/5 p-3">
              
              {/* Format Toggle */}
              <div className="flex rounded-lg border border-brand-400/20 bg-background p-1">
                <button
                  type="button"
                  onClick={() => setIs24Hour(false)}
                  className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition ${
                    !is24Hour
                      ? "bg-brand-400 text-black shadow"
                      : "text-foreground/60 hover:bg-brand-400/10"
                  }`}
                >
                  12-hour
                </button>
                <button
                  type="button"
                  onClick={() => setIs24Hour(true)}
                  className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition ${
                    is24Hour
                      ? "bg-brand-400 text-black shadow"
                      : "text-foreground/60 hover:bg-brand-400/10"
                  }`}
                >
                  24-hour
                </button>
              </div>

              {/* AM/PM Toggle for 12-hour format */}
              {!is24Hour && (
                <div className="flex rounded-lg border border-brand-400/20 bg-background p-1">
                  {["AM", "PM"].map((meridiem) => (
                    <button
                      key={meridiem}
                      type="button"
                      onClick={() => updateAmPm(meridiem)}
                      className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition ${
                        currentAmPm === meridiem
                          ? "bg-brand-400 text-black shadow"
                          : "text-foreground/60 hover:bg-brand-400/10"
                      }`}
                    >
                      {meridiem}
                    </button>
                  ))}
                </div>
              )}

              {/* Hours Grid */}
              <div>
                <p className="mb-2 text-center text-[10px] font-semibold uppercase text-foreground/40">Hour</p>
                <div className="grid grid-cols-6 gap-1">
                  {is24Hour ? (
                    // 24-hour hour blocks (0-23)
                    Array.from({ length: 24 }, (_, i) => i).map((h) => (
                      <button
                        key={`h24-${h}`}
                        type="button"
                        onClick={() => updateHour24(h)}
                        className={`aspect-square rounded-lg border border-transparent text-xs font-semibold transition ${
                          tempHour === h
                            ? "bg-brand-400 text-black"
                            : "text-foreground/80 hover:border-brand-400/40 hover:bg-brand-400/10"
                        }`}
                      >
                        {String(h).padStart(2, "0")}
                      </button>
                    ))
                  ) : (
                    // 12-hour hour blocks (1-12)
                    Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                      <button
                        key={`h12-${h}`}
                        type="button"
                        onClick={() => updateHour12(h)}
                        className={`aspect-square rounded-lg border border-transparent text-xs font-semibold transition ${
                          current12h === h
                            ? "bg-brand-400 text-black"
                            : "text-foreground/80 hover:border-brand-400/40 hover:bg-brand-400/10"
                        }`}
                      >
                        {h}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Minutes Grid */}
              <div>
                <p className="mb-2 text-center text-[10px] font-semibold uppercase text-foreground/40">Minute</p>
                <div className="grid grid-cols-6 gap-1">
                  {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
                    <button
                      key={`m-${m}`}
                      type="button"
                      onClick={() => updateMinute(m)}
                      className={`aspect-square rounded-lg border border-transparent text-xs font-semibold transition ${
                        tempMinute === m
                          ? "bg-brand-400 text-black"
                          : "text-foreground/80 hover:border-brand-400/40 hover:bg-brand-400/10"
                      }`}
                    >
                      {String(m).padStart(2, "0")}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                  }}
                  className="flex-1 rounded-xl border border-brand-400/20 py-2 text-xs font-semibold text-foreground/70 transition hover:bg-brand-400/10"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!value) onChange(formatTimeValue(tempHour, tempMinute));
                    setOpen(false);
                  }}
                  className="flex-1 rounded-xl bg-brand-400 py-2 text-xs font-semibold text-black transition hover:shadow-[0_4px_12px_rgba(79,214,190,0.3)]"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function CalendarDateCard({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const selectedDate = parseDateValue(value);
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(selectedDate ?? new Date())
  );
  const days = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth]);
  const missingDate = !value;
  const relativeLabel = value ? formatEventCountdown(value) : "Date required";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition hover:border-brand-400/40 ${
          missingDate
            ? "border-red-400/30 bg-red-400/5"
            : "border-brand-400/20 bg-brand-400/10"
        }`}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background">
          <CalendarDays className={`h-5 w-5 ${missingDate ? "text-red-300" : "text-brand-400"}`} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Event date</span>
          <span className={`block truncate text-xs ${missingDate ? "text-red-300" : "text-foreground/60"}`}>
            {missingDate ? "Required before Guests, Admins, and Analytics." : formatDateLong(value)}
          </span>
        </span>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-semibold ${
            missingDate ? "bg-red-400/10 text-red-300" : "bg-brand-400/15 text-brand-400"
          }`}
        >
          {relativeLabel}
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close calendar"
            onClick={() => setOpen(false)}
          />
          <div className="relative w-full max-w-sm rounded-2xl border border-brand-400/20 bg-background p-4 shadow-2xl modal-card-animate">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Choose event date</p>
                <p className="text-xs text-foreground/50">{value ? formatDateLong(value) : "No date selected"}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-brand-400/20 px-3 py-1 text-xs text-foreground/60 hover:bg-brand-400/10"
              >
                Close
              </button>
            </div>
            <div className="rounded-xl border border-brand-400/10 bg-brand-400/5 p-3">
              <div className="mb-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setVisibleMonth(addMonths(visibleMonth, -1))}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-brand-400/20 text-foreground/60 hover:bg-brand-400/10"
                  aria-label="Previous month"
                >
                  ‹
                </button>
                <span className="text-sm font-semibold">
                  {visibleMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                </span>
                <button
                  type="button"
                  onClick={() => setVisibleMonth(addMonths(visibleMonth, 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-brand-400/20 text-foreground/60 hover:bg-brand-400/10"
                  aria-label="Next month"
                >
                  ›
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-foreground/40">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day}>{day}</span>)}
              </div>
              <div className="mt-2 grid grid-cols-7 gap-1">
                {days.map((day) => {
                  const dayValue = formatDateValue(day.date);
                  const isCurrentMonth = day.date.getMonth() === visibleMonth.getMonth();
                  const isSelected = value === dayValue;
                  const isToday = dayValue === formatDateValue(new Date());
                  return (
                    <button
                      key={dayValue}
                      type="button"
                      onClick={() => {
                        onChange(dayValue);
                        setOpen(false);
                      }}
                      className={`aspect-square rounded-lg text-xs font-semibold transition ${
                        isSelected
                          ? "bg-brand-400 text-black"
                          : isToday
                            ? "border border-brand-400/40 text-brand-400 hover:bg-brand-400/10"
                            : isCurrentMonth
                              ? "text-foreground/80 hover:bg-brand-400/10"
                              : "text-foreground/25 hover:bg-brand-400/5"
                      }`}
                    >
                      {day.date.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ----------------------------------------------------------------------
// Time formatting and parsing helpers
// ----------------------------------------------------------------------

function parseTimeValue(value: string) {
  if (!value) return { hour: 0, minute: 0 };
  const [h, m] = value.split(":").map(Number);
  return { hour: h || 0, minute: m || 0 };
}

function formatTimeValue(hour: number, minute: number) {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatTimeDisplay(value: string, is24h: boolean) {
  if (!value) return "No time selected";
  const { hour, minute } = parseTimeValue(value);
  if (is24h) {
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  } else {
    const ampm = hour >= 12 ? "PM" : "AM";
    const h12 = hour % 12 || 12;
    return `${h12}:${String(minute).padStart(2, "0")} ${ampm}`;
  }
}

// ----------------------------------------------------------------------
// Date formatting and calendar helpers
// ----------------------------------------------------------------------

function parseDateValue(value: string) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function formatDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateLong(value: string) {
  const date = parseDateValue(value);
  if (!date) return "No date selected";
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatEventCountdown(value: string) {
  const eventDate = parseDateValue(value);
  if (!eventDate) return "Date required";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((eventDate.getTime() - today.getTime()) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 0 && days < 31) return `In ${days} days`;
  if (days >= 31) {
    const months = Math.max(1, Math.round(days / 30));
    return `In ${months} ${months === 1 ? "month" : "months"}`;
  }
  return `${Math.abs(days)} days ago`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function buildCalendarDays(month: Date) {
  const firstDay = startOfMonth(month);
  const startDate = new Date(firstDay);
  startDate.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    return { date };
  });
}
