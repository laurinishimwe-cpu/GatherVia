# GatherVia Web

The GatherVia web client is a Next.js 16 application for the public invitation experience, event dashboard, and full workspace editor.

It is a client of the FastAPI API; it does not own event, guest, plan, or publishing rules. See the [project README](../README.md) and [architecture decisions](../docs/architecture/README.md) before changing a cross-platform flow.

## Run locally

```powershell
Copy-Item .env.local.example .env.local
npm install
npm run dev
```

Required values:

```text
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Open `http://localhost:3000`.

## Commands

```powershell
npm run dev
.\node_modules\.bin\tsc.cmd --noEmit
npm run lint
npm run build
```

## Important boundaries

- API access lives under `lib/api`; preserve its auth, retry, and cache invalidation behaviour.
- `context/` owns client interaction state; persisted records remain backend-owned.
- Flyer payloads use the shared layer/configuration contract. Update normalisation and rendering parity work when changing that contract.
- Only fonts listed in `lib/flyer/font-registry.json` are selectable because those fonts are also bundled for mobile and backend pass rendering.
- Public URLs must be created with the shared URL helpers rather than `localhost` string concatenation.

## Deployment

Deploy to Vercel with `NEXT_PUBLIC_API_URL` set to the Render API origin. The backend CORS configuration must include the deployed Vercel origin, and the backend `PUBLIC_APP_URL` must point to the same public web origin.
