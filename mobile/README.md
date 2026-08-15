# GatherVia Mobile

The GatherVia mobile app is an Expo SDK 54 / React Native client for dashboard access, event operations, QR scanning, plan management, and a touch-first invitation editor.

It consumes the same FastAPI API and canonical flyer payload as the web app. Read the [project README](../README.md) and [architecture decisions](../docs/architecture/README.md) for the cross-platform rules.

## Local setup

```powershell
Copy-Item .env.example .env
npm install
npm run typecheck
npm run check:expo
```

For a physical device, set `EXPO_PUBLIC_API_URL` to the deployed API or your computer's LAN IP. `127.0.0.1` only works on the same machine; Android Emulator normally uses `http://10.0.2.2:8000`.

```powershell
npm run start:lan
```

Use `npx expo start --tunnel --clear` only as a temporary fallback when the local network prevents LAN discovery.

## Commands

```powershell
npm run typecheck
npm run check:expo
npm run android
npm run ios
npm run start:lan
```

To generate a local Android release APK for manual testing:

```powershell
Set-Location android
.\gradlew.bat assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release.apk`.

## Security and app state

- Refresh tokens are stored in Expo SecureStore, not AsyncStorage.
- AsyncStorage may cache a non-sensitive user profile and installation ID.
- The app refreshes rotating sessions to keep an active signed-in device authenticated.
- `EXPO_PUBLIC_BYPASS_AUTH=true` is for local screen development only and must never be enabled in a production build.

## Plans

RevenueCat is the mobile purchase interface. Public RevenueCat SDK keys may be set in `.env`; the RevenueCat secret key and webhook authorization belong only in backend deployment configuration. Google Play is enabled first, while App Store availability remains feature-flagged.

## Editor consistency

The mobile editor normalises flyer layers, uses the bundled font registry, and renders the same semantic design payload as web and backend. Do not add a device-only font or a mobile-only canvas field without making the corresponding shared compatibility decision.
