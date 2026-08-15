import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  Check,
  CreditCard,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Users,
} from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { useThemeMode } from "@/context/ThemeContext";
import { useToast } from "@/context/ToastContext";
import {
  checkGuestLimit,
  fetchPlanCatalog,
  fetchSubscriptionStatus,
  syncPlanSubscription,
  type GuestLimitStatus,
  type MobilePlanCatalogItem,
  type SubscriptionStatus,
} from "@/lib/api/plans";
import {
  getMobilePlanAvailability,
  isPurchaseCancelled,
  loadMobilePlanOfferings,
  purchasePlanPackage,
  restorePlanPurchases,
  type MobilePlanOffering,
  type PurchasablePlanTier,
} from "@/lib/iap/plans";


const FALLBACK_PLANS: MobilePlanCatalogItem[] = [
  {
    tier: "free",
    name: "Free",
    guest_limit: 50,
    billing_period: "P1M",
    description: "Included for every event. No purchase required.",
  },
  {
    tier: "basic",
    name: "Basic",
    guest_limit: 150,
    billing_period: "P1M",
    description: "More room for growing guest lists.",
  },
  {
    tier: "pro",
    name: "Pro",
    guest_limit: 500,
    billing_period: "P1M",
    description: "Maximum capacity for large events.",
  },
];

export function MobilePlansPanel({ eventId }: { eventId: string }) {
  const { user, refreshUser } = useAuth();
  const { resolvedMode } = useThemeMode();
  const { showToast } = useToast();
  const light = resolvedMode === "light";
  const colors = light
    ? { panel: "#ffffff", border: "#d5e2de", text: "#10211d", muted: "#657772", soft: "#edf7f4" }
    : { panel: "#10221e", border: "#24483f", text: "#f5f8f7", muted: "#89a099", soft: "#0b1916" };
  const [plans, setPlans] = useState<MobilePlanCatalogItem[]>(FALLBACK_PLANS);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [guestLimit, setGuestLimit] = useState<GuestLimitStatus | null>(null);
  const [offerings, setOfferings] = useState<
    Partial<Record<PurchasablePlanTier, MobilePlanOffering>>
  >({});
  const [loading, setLoading] = useState(true);
  const [busyTier, setBusyTier] = useState<PurchasablePlanTier | "restore" | null>(null);
  const availability = getMobilePlanAvailability();

  const loadPlanData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [catalog, status, limit] = await Promise.all([
        fetchPlanCatalog(),
        fetchSubscriptionStatus(),
        checkGuestLimit(eventId),
      ]);
      setPlans(catalog.plans);
      setSubscription(status);
      setGuestLimit(limit);
      if (availability.available) {
        setOfferings(await loadMobilePlanOfferings(user.id));
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not load plans.", {
        tone: "error",
        duration: 3200,
      });
    } finally {
      setLoading(false);
    }
  }, [availability.available, eventId, showToast, user?.id]);

  useEffect(() => {
    void loadPlanData();
  }, [loadPlanData]);

  const currentTier = subscription?.tier ?? user?.tier ?? "free";
  const currentPlan = plans.find((plan) => plan.tier === currentTier) ?? plans[0];
  const currentGuests = guestLimit?.current ?? 0;
  const capacity = guestLimit?.limit ?? currentPlan.guest_limit;
  const progress = Math.min(100, capacity > 0 ? (currentGuests / capacity) * 100 : 0);
  const expiresLabel = useMemo(() => {
    if (!subscription?.expires_at) return null;
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(subscription.expires_at));
  }, [subscription?.expires_at]);

  const purchase = async (tier: PurchasablePlanTier) => {
    if (!user?.id || !availability.available) {
      showToast(availability.reason ?? "Purchases are unavailable.", { tone: "info" });
      return;
    }
    setBusyTier(tier);
    try {
      await purchasePlanPackage(user.id, tier);
      const status = await syncPlanSubscription();
      setSubscription(status);
      setGuestLimit(await checkGuestLimit(eventId));
      await refreshUser();
      showToast(`${tier === "basic" ? "Basic" : "Pro"} is active for one month.`, {
        tone: "success",
        duration: 3200,
      });
    } catch (error) {
      if (!isPurchaseCancelled(error)) {
        showToast(error instanceof Error ? error.message : "Purchase could not be completed.", {
          tone: "error",
          duration: 3800,
        });
      }
    } finally {
      setBusyTier(null);
    }
  };

  const restore = async () => {
    if (!user?.id) return;
    setBusyTier("restore");
    try {
      await restorePlanPurchases(user.id);
      const status = await syncPlanSubscription();
      setSubscription(status);
      setGuestLimit(await checkGuestLimit(eventId));
      await refreshUser();
      showToast(status.active ? "Your subscription was restored." : "No active plan was found.", {
        tone: status.active ? "success" : "info",
      });
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not restore purchases.", {
        tone: "error",
        duration: 3200,
      });
    } finally {
      setBusyTier(null);
    }
  };

  return (
    <View>
      <Text style={[styles.heading, { color: colors.text }]}>Plans</Text>
      <Text style={[styles.subheading, { color: colors.muted }]}>Monthly capacity that renews through your mobile store.</Text>

      <View style={[styles.usageCard, { backgroundColor: colors.panel, borderColor: colors.border }]}>
        <View style={styles.usageHeader}>
          <View style={styles.usageIcon}><Users color="#4fd6be" size={20} /></View>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>CURRENT PLAN</Text>
            <Text style={[styles.currentName, { color: colors.text }]}>{currentPlan.name}</Text>
          </View>
          {loading ? <ActivityIndicator color="#4fd6be" /> : (
            <Text style={[styles.count, { color: colors.text }]}>{currentGuests}<Text style={{ color: colors.muted }}> / {capacity}</Text></Text>
          )}
        </View>
        <View style={[styles.progressTrack, { backgroundColor: colors.soft }]}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <View style={styles.progressLabels}>
          <Text style={[styles.meta, { color: colors.muted }]}>{Math.max(capacity - currentGuests, 0)} spaces remaining</Text>
          <Text style={[styles.meta, { color: colors.muted }]}>{Math.round(progress)}% used</Text>
        </View>
        {expiresLabel ? (
          <View style={[styles.renewalRow, { borderTopColor: colors.border }]}>
            <RefreshCw color="#4fd6be" size={14} />
            <Text style={[styles.renewalText, { color: colors.muted }]}>
              {subscription?.auto_renews ? `Renews monthly on ${expiresLabel}` : `Access ends ${expiresLabel}`}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.storeBanner, { backgroundColor: colors.soft, borderColor: colors.border }]}>
        {availability.available ? <ShieldCheck color="#4fd6be" size={18} /> : <Smartphone color="#d9a95b" size={18} />}
        <Text style={[styles.storeText, { color: colors.muted }]}>
          {availability.available
            ? "Checkout opens securely in Google Play. No QR code is needed."
            : availability.reason}
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.planRow}>
        {plans.map((plan) => {
          const isCurrent = plan.tier === currentTier;
          const purchasable = plan.tier === "basic" || plan.tier === "pro";
          const storeOffering =
            plan.tier === "basic" || plan.tier === "pro"
              ? offerings[plan.tier]
              : undefined;
          const price = plan.tier === "free"
            ? "Free"
            : storeOffering?.price ?? (Platform.OS === "ios" ? "Coming later" : "Google Play price");
          const busy = busyTier === plan.tier;
          const unavailable = purchasable && (!availability.available || !storeOffering);

          return (
            <View
              key={plan.tier}
              style={[
                styles.planCard,
                { backgroundColor: colors.panel, borderColor: isCurrent ? "#4fd6be" : colors.border },
              ]}
            >
              <View style={styles.planHeader}>
                <Text style={[styles.planName, { color: colors.text }]}>{plan.name}</Text>
                {isCurrent ? <View style={styles.check}><Check color="#07110f" size={14} /></View> : null}
              </View>
              <Text style={styles.price}>{price}<Text style={[styles.perMonth, { color: colors.muted }]}>{plan.tier === "free" ? "" : " / month"}</Text></Text>
              {storeOffering?.hasIntroOffer ? (
                <Text style={[styles.offerText, { color: colors.muted }]}>Then {storeOffering.regularPrice} / month</Text>
              ) : null}
              <Text style={[styles.capacity, { color: colors.text }]}>{plan.guest_limit}</Text>
              <Text style={[styles.capacityLabel, { color: colors.muted }]}>guests per event</Text>
              <Text style={[styles.description, { color: colors.muted }]}>{plan.description}</Text>

              {isCurrent ? (
                <View style={[styles.currentPill, { backgroundColor: colors.soft }]}><Text style={styles.currentPillText}>Current plan</Text></View>
              ) : plan.tier === "free" ? (
                <View style={[styles.currentPill, { backgroundColor: colors.soft }]}><Text style={[styles.includedText, { color: colors.muted }]}>Always included</Text></View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  disabled={Boolean(busyTier) || unavailable}
                  onPress={() => void purchase(plan.tier as PurchasablePlanTier)}
                  style={[styles.buyButton, (Boolean(busyTier) || unavailable) && styles.disabled]}
                >
                  {busy ? <ActivityIndicator color="#07110f" size="small" /> : (
                    <><CreditCard color="#07110f" size={16} /><Text style={styles.buyText}>{Platform.OS === "ios" && unavailable ? "Coming later" : !storeOffering ? "Store setup needed" : "Choose plan"}</Text></>
                  )}
                </Pressable>
              )}
            </View>
          );
        })}
      </ScrollView>

      {availability.available ? (
        <Pressable disabled={Boolean(busyTier)} onPress={() => void restore()} style={styles.restoreButton}>
          {busyTier === "restore" ? <ActivityIndicator color="#4fd6be" size="small" /> : <RefreshCw color="#4fd6be" size={15} />}
          <Text style={styles.restoreText}>Restore purchases</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  heading: { fontSize: 20, fontWeight: "800" },
  subheading: { marginTop: 4, marginBottom: 15, fontSize: 11, lineHeight: 17 },
  usageCard: { borderWidth: 1, borderRadius: 22, padding: 16 },
  usageHeader: { flexDirection: "row", alignItems: "center", gap: 11 },
  usageIcon: { width: 42, height: 42, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "#15372f" },
  eyebrow: { color: "#4fd6be", fontSize: 8, fontWeight: "800", letterSpacing: 1.2 },
  currentName: { marginTop: 3, fontSize: 17, fontWeight: "800" },
  count: { fontSize: 18, fontWeight: "800" },
  progressTrack: { marginTop: 17, height: 10, borderRadius: 5, overflow: "hidden" },
  progressFill: { height: 10, borderRadius: 5, backgroundColor: "#4fd6be" },
  progressLabels: { marginTop: 7, flexDirection: "row", justifyContent: "space-between" },
  meta: { fontSize: 9 },
  renewalRow: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, flexDirection: "row", alignItems: "center", gap: 7 },
  renewalText: { flex: 1, fontSize: 9, fontWeight: "600" },
  storeBanner: { marginTop: 12, padding: 12, borderWidth: 1, borderRadius: 16, flexDirection: "row", alignItems: "center", gap: 9 },
  storeText: { flex: 1, fontSize: 10, lineHeight: 15, fontWeight: "600" },
  planRow: { paddingTop: 14, paddingBottom: 6, gap: 12 },
  planCard: { width: 258, minHeight: 330, padding: 17, borderWidth: 1, borderRadius: 22 },
  planHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  planName: { fontSize: 17, fontWeight: "800" },
  check: { width: 27, height: 27, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#4fd6be" },
  price: { marginTop: 12, color: "#4fd6be", fontSize: 23, fontWeight: "800" },
  perMonth: { fontSize: 10, fontWeight: "600" },
  offerText: { marginTop: 3, fontSize: 9, fontWeight: "600" },
  capacity: { marginTop: 24, fontSize: 35, fontWeight: "800" },
  capacityLabel: { marginTop: 2, fontSize: 10 },
  description: { marginTop: 17, fontSize: 11, lineHeight: 17 },
  currentPill: { marginTop: "auto", minHeight: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  currentPillText: { color: "#4fd6be", fontSize: 11, fontWeight: "800" },
  includedText: { fontSize: 11, fontWeight: "700" },
  buyButton: { marginTop: "auto", minHeight: 44, borderRadius: 22, backgroundColor: "#4fd6be", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  buyText: { color: "#07110f", fontSize: 11, fontWeight: "800" },
  disabled: { opacity: 0.45 },
  restoreButton: { minHeight: 44, marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  restoreText: { color: "#4fd6be", fontSize: 11, fontWeight: "800" },
});
