# GatherVia

GatherVia is a cross-platform event workspace for creating invitations, collecting RSVPs, issuing guest QR passes, and checking guests in at an event.

The product has three clients that use one API and one persisted event model:

- **Web workspace** for full invitation design and event operations.
- **Mobile app** for event management, QR scanning, guest actions, and a touch-first editor.
- **Public pages** for invitations, RSVPs, and staff scanner access.

The FastAPI backend is the source of truth for users, events, designs, guests, plans, and access rules. This avoids the web and mobile clients drifting apart.

## What it does

- Create draft events from templates or an uploaded flyer.
- Edit layered invitation designs: text, images, shapes, vectors, gradients, shadows, QR, and ticket stubs.
- Publish an invitation only after editor validation; a published invitation is treated as an operational event.
- Collect public RSVPs and add guests manually.
- Generate a guest-specific QR pass and let authorised staff scan, check in, scan out, or search by name.
- Show guest, check-in, and activity analytics.
- Keep browser, mobile, and generated invitation rendering aligned through shared design data and bundled fonts.
- Enforce per-owner guest limits: Free 50, Basic 150, and Pro 500.
- Offer plan management in mobile through Google Play/RevenueCat; the web app directs users to mobile rather than accepting payments.

## Architecture at a glance

```text
                      ┌────────────────────────────┐
                      │       GatherVia Web         │
                      │ Next.js 16 / React / Tailwind│
                      └──────────────┬─────────────┘
                                     │ HTTPS + bearer token
┌──────────────────────────┐         │         ┌──────────────────────────┐
│   GatherVia Mobile       │─────────┼────────▶│       FastAPI API         │
│ Expo / React Native      │         │         │ routes → services → Mongo │
│ SecureStore + native IAP │         │         └────────┬─────────┬────────┘
└──────────────────────────┘         │                  │         │
                                     │                  │         │
                              ┌──────▼──────┐    ┌──────▼────┐ ┌─▼───────────┐
                              │ Public RSVP │    │ MongoDB   │ │ Supabase    │
                              │ / scanner   │    │ Atlas     │ │ Storage     │
                              └─────────────┘    └───────────┘ └─────────────┘
                                                           │
                                                     ┌─────▼─────┐
                                                     │ RevenueCat │
                                                     │ webhook/API│
                                                     └───────────┘
```

More detail and the reasoning behind major choices live in [Architecture Decisions](docs/architecture/README.md).

## Repository layout

```text
app/                         FastAPI application
  core/                      configuration, database, auth dependencies
  models/                    Mongo/Pydantic domain models and API schemas
  routes/                    HTTP boundary, validation, authorisation
  services/                  business rules and integrations
  services/invitation_rendering/
                              server-side guest pass renderer
frontend/                    Next.js web application
  app/                       routes and layouts
  components/                dashboard, workspace, invitation UI
  context/                   auth, event, editor state
  lib/                       API clients, caching, flyer helpers
mobile/                      Expo / React Native application
  app/                       Expo Router screens
  components/                dashboard, workspace, scanner, editor controls
  context/                   auth, events, drafts, theme, toasts
  lib/                       API, cache, secure session, flyer helpers
shared/font-registry.json    canonical bundled-font registry
assets/fonts/                backend font files used for pass rendering
tests/                       backend, normalisation, and rendering tests
scripts/                     migrations and rendering utilities
docs/architecture/           architecture decision records
```

## Technology

| Area | Current technology |
| --- | --- |
| Web | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Mobile | Expo SDK 54, React Native, Expo Router, NativeWind |
| API | FastAPI, Pydantic, Motor |
| Primary data | MongoDB / MongoDB Atlas |
| File storage | Supabase Storage, accessed only by the backend service role |
| Authentication | Short-lived JWT access token + rotating persistent refresh session |
| QR rendering | `qrcode`, Pillow, CairoSVG/resvg, shared canvas configuration |
| Mobile subscriptions | RevenueCat with Google Play enabled first; App Store capability is feature-flagged |

## Local development

### Prerequisites

- Python 3.11 or later
- Node.js 20 LTS or later
- MongoDB locally or a MongoDB Atlas connection string
- A Supabase project/bucket if testing asset uploads
- Android Studio and an Android device/emulator for native mobile builds

### 1. Configure environment variables

Never commit `.env`, `.env.local`, API secrets, service-role keys, or store credentials.

```powershell
Copy-Item .env.example .env
Copy-Item frontend/.env.local.example frontend/.env.local
Copy-Item mobile/.env.example mobile/.env
```

Required backend values are `MONGODB_URL`, `DATABASE_NAME`, and a 32+ character `JWT_SECRET_KEY`. Set `PUBLIC_APP_URL` to the web origin used for public invitation and staff links.

For a physical phone, set `EXPO_PUBLIC_API_URL` in `mobile/.env` to either the deployed API URL or the computer's LAN IP. Do not use `127.0.0.1` on a physical device.

### 2. Start the API

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Health check: `http://127.0.0.1:8000/api/v1/health`

### 3. Start the web app

```powershell
Set-Location frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

### 4. Start the mobile app

```powershell
Set-Location mobile
npm install
npm run typecheck
npm run start:lan
```

For an installed Android development build:

```powershell
npm run android
```

For a release APK used for manual testing, follow the Android build workflow from the `mobile` directory:

```powershell
Set-Location android
.\gradlew.bat assembleRelease
```

The APK is written to `mobile/android/app/build/outputs/apk/release/app-release.apk`.

## Quality checks

Run the checks relevant to the area you changed:

```powershell
# API and invitation-renderer regression suite
python -m unittest discover -s tests

# Mobile TypeScript
Set-Location mobile
npm run typecheck

# Web TypeScript and lint
Set-Location frontend
.\node_modules\.bin\tsc.cmd --noEmit
npm run lint
```

When changing the invitation renderer, also generate a visual reference:

```powershell
python scripts/render_invitation_fixture.py
```

See [the renderer README](app/services/invitation_rendering/README.md) for its contracts and parity expectations.

## API boundaries

All API endpoints live below `/api/v1`.

| Area | Route group | Responsibility |
| --- | --- | --- |
| Authentication | `/auth` | email/password, Google OAuth assertion, refresh rotation, logout, sessions |
| Events | `/events` | drafts, publishing lifecycle, event settings, templates |
| Flyers | `/flyers` | persisted design layers, assets, preview and saved-pass rendering |
| Guests | `/guests` | public RSVP, owner list/actions, capacity, QR and staff scans |
| Communications | `/communications` | invitation, share, and staff access links |
| Plans | `/plans` | catalogue, subscription status, RevenueCat sync/webhook |
| Admin templates | `/admin/templates` | protected template administration |

The route layer owns HTTP semantics and authorisation. Services own business rules. No client should rely on a local guess for a rule that the API can enforce.

## Deployment

- **Frontend:** Vercel, with `NEXT_PUBLIC_API_URL` pointing to the API.
- **Backend:** Render, with production MongoDB, Supabase, CORS origins, and `PUBLIC_APP_URL=https://gathervia.vercel.app` (or the current production web origin).
- **Database:** MongoDB Atlas.
- **Storage:** Supabase Storage; only the backend holds the service-role key.
- **Mobile:** Android/Google Play first. Configure RevenueCat public SDK keys in `mobile/.env` and backend RevenueCat secret/webhook values in Render.

Before releasing, verify the production API, web origin, OAuth redirect URI, Google Play package name, and RevenueCat entitlement IDs match their environment configuration.

## Product lifecycle rules

1. Events begin as **drafts**.
2. Publishing validates the editor design and makes the invitation operational.
3. Guest lists and analytics are available only for a published invitation.
4. Returning a published invitation to the editor is destructive: related guests, staff access, and check-in history are removed after confirmation.
5. Guest capacity is evaluated on the backend using the real database count and the event owner's current entitlement.
6. Generated passes are ephemeral, private responses; durable flyer assets are the only stored render inputs.

## Contributing

- Preserve the API as the source of truth.
- Keep web, mobile, and backend normalisation in sync when changing canvas schema, text, paint, fonts, or generated passes.
- Add or update tests with service-layer and renderer changes.
- Prefer focused cache invalidation after mutations instead of permanent client-side copies.
- Record a significant cross-cutting decision in [the ADR index](docs/architecture/README.md).

## Security notes

- Store refresh tokens in SecureStore on mobile; do not put them in AsyncStorage.
- Do not expose Supabase service-role or RevenueCat secret keys to web or mobile clients.
- RevenueCat webhook processing verifies its configured authorization header and synchronises entitlements into the user record.
- Treat public RSVP and staff scanner routes as hostile inputs: validate, rate-limit sensitive operations, and audit staff scans.

## License

Private project. Add an explicit license before public distribution.
