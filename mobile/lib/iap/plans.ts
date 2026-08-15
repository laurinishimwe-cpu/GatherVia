import { Platform } from "react-native";
import Purchases, {
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
  STORE_REPLACEMENT_MODE,
  type PurchasesError,
  type PurchasesPackage,
  type StoreProductChangeInfo,
} from "react-native-purchases";

export type PurchasablePlanTier = "basic" | "pro";

export interface MobilePlanAvailability {
  available: boolean;
  store: "google_play" | "app_store" | null;
  reason: string | null;
}

export interface MobilePlanOffering {
  tier: PurchasablePlanTier;
  price: string;
  regularPrice: string;
  hasIntroOffer: boolean;
  billingPeriod: string | null;
  package: PurchasesPackage;
}

const ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? "";
const IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? "";
const BASIC_PACKAGE_ID =
  process.env.EXPO_PUBLIC_REVENUECAT_BASIC_PACKAGE_ID ?? "basic_monthly";
const PRO_PACKAGE_ID =
  process.env.EXPO_PUBLIC_REVENUECAT_PRO_PACKAGE_ID ?? "pro_monthly";
const GOOGLE_PLAY_ENABLED =
  process.env.EXPO_PUBLIC_GOOGLE_PLAY_PLANS_ENABLED === "true";
const APP_STORE_ENABLED =
  process.env.EXPO_PUBLIC_APP_STORE_PLANS_ENABLED === "true";

let configuredUserId: string | null = null;

export function getMobilePlanAvailability(): MobilePlanAvailability {
  if (Platform.OS === "android") {
    if (!GOOGLE_PLAY_ENABLED) {
      return {
        available: false,
        store: "google_play",
        reason: "Plan upgrades are disabled in this test build.",
      };
    }
    if (!ANDROID_API_KEY) {
      return {
        available: false,
        store: "google_play",
        reason: "Google Play subscriptions still need their RevenueCat key.",
      };
    }
    return { available: true, store: "google_play", reason: null };
  }

  if (Platform.OS === "ios") {
    if (!APP_STORE_ENABLED || !IOS_API_KEY) {
      return {
        available: false,
        store: "app_store",
        reason: "App Store subscriptions are coming later. No purchase is needed now.",
      };
    }
    return { available: true, store: "app_store", reason: null };
  }

  return {
    available: false,
    store: null,
    reason: "Plan purchases are available only in the Android or iOS app.",
  };
}

export async function configurePlanPurchases(userId: string): Promise<boolean> {
  const availability = getMobilePlanAvailability();
  if (!availability.available) return false;

  const configured = await Purchases.isConfigured();
  if (!configured) {
    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO);
    Purchases.configure({
      apiKey: Platform.OS === "android" ? ANDROID_API_KEY : IOS_API_KEY,
      appUserID: userId,
    });
  } else if (configuredUserId !== userId) {
    await Purchases.logIn(userId);
  }
  configuredUserId = userId;
  return true;
}

function packageMatches(aPackage: PurchasesPackage, configuredId: string): boolean {
  return (
    aPackage.identifier === configuredId ||
    aPackage.product.identifier === configuredId ||
    aPackage.product.identifier.startsWith(`${configuredId}:`)
  );
}

export async function loadMobilePlanOfferings(
  userId: string,
): Promise<Partial<Record<PurchasablePlanTier, MobilePlanOffering>>> {
  if (!(await configurePlanPurchases(userId))) return {};

  const currentOffering = (await Purchases.getOfferings()).current;
  if (!currentOffering) {
    throw new Error("No current RevenueCat offering is configured.");
  }

  const definitions: Array<[PurchasablePlanTier, string]> = [
    ["basic", BASIC_PACKAGE_ID],
    ["pro", PRO_PACKAGE_ID],
  ];
  return Object.fromEntries(
    definitions.flatMap(([tier, configuredId]) => {
      const aPackage = currentOffering.availablePackages.find((candidate) =>
        packageMatches(candidate, configuredId),
      );
      if (!aPackage) return [];
      const billingPeriod =
        aPackage.product.defaultOption?.billingPeriod?.iso8601 ??
        aPackage.product.subscriptionPeriod;
      if (billingPeriod !== "P1M") {
        throw new Error(
          `${tier === "basic" ? "Basic" : "Pro"} must use a one-month Google Play base plan.`,
        );
      }
      return [
        [
          tier,
          {
            tier,
            price:
              aPackage.product.defaultOption?.pricingPhases[0]?.price.formatted ??
              aPackage.product.priceString,
            regularPrice:
              aPackage.product.defaultOption?.fullPricePhase?.price.formatted ??
              aPackage.product.priceString,
            hasIntroOffer: Boolean(
              aPackage.product.defaultOption?.freePhase ||
              aPackage.product.defaultOption?.introPhase,
            ),
            billingPeriod,
            package: aPackage,
          },
        ],
      ];
    }),
  );
}

export async function purchasePlanPackage(
  userId: string,
  tier: PurchasablePlanTier,
): Promise<void> {
  const offerings = await loadMobilePlanOfferings(userId);
  const selected = offerings[tier];
  if (!selected) {
    throw new Error(
      `${tier === "basic" ? "Basic" : "Pro"} monthly is not configured in the current RevenueCat offering.`,
    );
  }
  const customerInfo = await Purchases.getCustomerInfo();
  const oldProductIdentifier = customerInfo.activeSubscriptions.find(
    (identifier) => identifier !== selected.package.product.identifier,
  );
  const productChangeInfo: StoreProductChangeInfo | null = oldProductIdentifier
    ? {
        oldProductIdentifier,
        replacementMode: STORE_REPLACEMENT_MODE.WITH_TIME_PRORATION,
      }
    : null;
  await Purchases.purchasePackage(selected.package, null, productChangeInfo);
}

export async function restorePlanPurchases(userId: string): Promise<void> {
  if (!(await configurePlanPurchases(userId))) {
    throw new Error(getMobilePlanAvailability().reason ?? "Purchases are unavailable.");
  }
  await Purchases.restorePurchases();
}

export async function resetPlanPurchasesUser(): Promise<void> {
  if (await Purchases.isConfigured()) {
    await Purchases.logOut();
  }
  configuredUserId = null;
}

export function isPurchaseCancelled(error: unknown): boolean {
  const purchasesError = error as Partial<PurchasesError>;
  return (
    purchasesError.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR ||
    purchasesError.userCancelled === true
  );
}
