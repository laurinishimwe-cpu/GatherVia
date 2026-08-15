# Android-first monthly plans

GatherVia treats Google Play, through RevenueCat, as the only authority for paid
prices, discounts, renewal dates, and entitlement status. The backend never
accepts a paid tier directly from the mobile client.

## Google Play Console

1. Create two subscription products: Basic and Pro.
2. Give each product an auto-renewing base plan with a one-month billing period.
3. Configure regional prices and any introductory offers in Google Play. The app
   reads the localized price and active introductory pricing from the store.
4. Add license testers and publish the products to the testing track used by the
   app build.

## RevenueCat

1. Connect the Android app `com.laurinishimwe.gathervia` to Google Play.
2. Import both monthly subscription products.
3. Create entitlements named `basic` and `pro`, then attach the matching product.
4. Create a current offering with custom package identifiers `basic_monthly` and
   `pro_monthly`.
5. Configure the webhook URL:
   `https://YOUR_API/api/v1/plans/revenuecat/webhook`.
6. Set the webhook Authorization header to the same full value as
   `REVENUECAT_WEBHOOK_AUTHORIZATION` on the backend.

## Mobile environment

Set these values in EAS/production environment variables:

```text
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=goog_...
EXPO_PUBLIC_REVENUECAT_BASIC_PACKAGE_ID=basic_monthly
EXPO_PUBLIC_REVENUECAT_PRO_PACKAGE_ID=pro_monthly
EXPO_PUBLIC_GOOGLE_PLAY_PLANS_ENABLED=true
EXPO_PUBLIC_APP_STORE_PLANS_ENABLED=false
```

Real purchases require an Expo development build or store build; Expo Go uses
RevenueCat preview behavior and cannot complete a real transaction.

## Backend environment

```text
REVENUECAT_SECRET_API_KEY=sk_...
REVENUECAT_WEBHOOK_AUTHORIZATION=Bearer YOUR_RANDOM_WEBHOOK_SECRET
REVENUECAT_BASIC_ENTITLEMENT_ID=basic
REVENUECAT_PRO_ENTITLEMENT_ID=pro
GOOGLE_PLAY_PLANS_ENABLED=true
APP_STORE_PLANS_ENABLED=false
```

Keep `REVENUECAT_SECRET_API_KEY` on the backend only. When App Store support is
ready, connect the iOS app in RevenueCat, add its public SDK key to the mobile
environment, and change both App Store feature flags to `true`.

## Lifecycle endpoints

- `GET /api/v1/plans/catalog` — plan capacities and store availability; no paid prices.
- `GET /api/v1/plans/status` — authenticated effective tier and expiration.
- `POST /api/v1/plans/sync` — authenticated server verification after purchase or restore.
- `POST /api/v1/plans/revenuecat/webhook` — secured renewal, cancellation, transfer,
  billing issue, and expiration synchronization.

Cancellation keeps access until the current Google Play period expires. Renewal
extends the expiration naturally. Expiration returns the account to Free and each
event to its 50-guest limit.
