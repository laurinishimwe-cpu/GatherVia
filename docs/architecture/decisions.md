# Architecture Decision Records

## ADR-001: FastAPI is the authoritative application API

**Status:** Accepted  
**Date:** 2026-08-15

### Context

GatherVia has a Next.js web client and an Expo mobile client. Both need the same event, guest, plan, and invitation rules. Letting either client own those rules would create inconsistent RSVP, capacity, publishing, and subscription behavior.

### Decision

FastAPI is the authoritative application API. MongoDB holds application records, and `app/routes` exposes HTTP boundaries while `app/services` owns domain rules. Web and mobile use typed API clients; they may cache responses but must not become the authority for business decisions.

### Consequences

- Guest capacity, publishing, plans, and permissions can be enforced once.
- New clients can use the same API contracts.
- Client screens need resilient loading/error states because data is remote.
- Service and route changes require backward-compatible client coordination.

---

## ADR-002: A persisted canonical flyer payload drives every renderer

**Status:** Accepted  
**Date:** 2026-08-15

### Context

An invitation must look recognisably the same in the web editor, mobile editor, public invitation, and downloadable guest pass. Separate platform-specific design formats would quickly drift.

### Decision

Persist a canonical canvas-layer and flyer-configuration payload. Normalisation code on web and mobile translates legacy/invalid names into valid fields before rendering. The backend reads the same payload to render final passes at fixed output resolution.

The renderers have different technology constraints, but they share semantic data: geometry, paint, typography, image references, QR content, ticket stub settings, and ordering.

### Consequences

- Design payloads remain portable between clients.
- New visual capabilities require coordinated support in normalisation and all renderers.
- Rendering parity tests and fixtures are required for material visual changes.
- The backend renderer must remain deterministic and must not mutate saved event data while rendering.

---

## ADR-003: Bundle a small, shared font registry

**Status:** Accepted  
**Date:** 2026-08-15

### Context

System fonts vary by browser, Android device, iOS device, and render worker. Relying on a font name alone causes line wrapping and invitation layouts to change between platforms.

### Decision

Maintain `shared/font-registry.json` as the canonical list of supported flyer fonts. Bundle matching font files into:

- `assets/fonts` for backend rendering;
- `frontend/public/fonts` for browser rendering;
- `mobile/assets/fonts` for Expo font loading.

The current initial pack is Inter, Source Serif 4, Dancing Script, Montserrat, Playfair Display, and League Spartan. Alias normalisation falls back to Inter rather than allowing an arbitrary unavailable font.

### Consequences

- The editor only exposes cross-platform fonts.
- Adding a font increases app and web payload size, so the registry stays deliberately small.
- A new font must include licensed files, all required faces, registry entries, and parity checks.

---

## ADR-004: Use rotating persistent refresh sessions

**Status:** Accepted  
**Date:** 2026-08-15

### Context

Mobile users expect to stay signed in until they explicitly sign out, revoke a device, or remove application data. Long-lived access tokens would make revocation and theft handling weak.

### Decision

Use short-lived JWT access tokens plus server-stored, rotating refresh sessions. The server stores only a hash of each refresh credential, binds a session to an installation when provided, detects replay, and extends the idle expiry on successful rotation. Mobile stores session credentials in Expo SecureStore.

### Consequences

- A valid active device can remain signed in through the configured inactivity period (`REFRESH_SESSION_IDLE_DAYS`, currently 180 by default).
- Logout, logout-all, and device revocation are possible.
- Both clients must refresh before retrying an expired authenticated request.
- Refresh credentials are sensitive and must never be logged, stored in browser local storage, or sent to analytics.

---

## ADR-005: Make RevenueCat the subscription authority

**Status:** Accepted  
**Date:** 2026-08-15

### Context

Mobile purchases are handled through Apple/Google stores. Duplicating receipt interpretation in every client risks entitlement mismatches and complicates refunds, renewals, and cancellations.

### Decision

RevenueCat is the source of subscription entitlement truth. The mobile app initiates purchases through the RevenueCat SDK. The backend verifies webhook authorization and synchronises active entitlements into the user record, which exposes a simple tier/status to the rest of GatherVia.

Google Play is enabled first. App Store availability is feature-flagged and remains disabled until configured. The web app displays plan information and directs the user to mobile; it does not accept a competing web payment flow.

### Consequences

- The plan stored on `User` is a backend projection of the store entitlement, not a user-editable value.
- Web and mobile can display a consistent plan state.
- RevenueCat secret keys remain backend-only; mobile uses only public SDK keys.
- Billing configuration must include correct package, entitlement, webhook, and environment identifiers before release.

---

## ADR-006: Enforce guest capacity in the API

**Status:** Accepted  
**Date:** 2026-08-15

### Context

Client-side limits are helpful for UX but can be stale, bypassed, or wrong when multiple devices add guests simultaneously.

### Decision

The backend counts the event's persisted guests and resolves the event owner's current tier before allowing registration or owner-created guests. Limits are Free 50, Basic 150, and Pro 500. A read endpoint exposes the current count and capacity for UX, but the write path is authoritative.

### Consequences

- The UI can show progress and upgrade prompts without trusting its own count.
- The same policy applies to public RSVP and manually added guests.
- Capacity requires a database query at write time, which is preferred over accepting an incorrect guest list.

---

## ADR-007: Treat published events as an operational boundary

**Status:** Accepted  
**Date:** 2026-08-15

### Context

Editing a live invitation after guests have received QR passes or staff links can invalidate the event's operational state.

### Decision

Events start as drafts. Publishing performs editor validation and allows guest management, public RSVP, and analytics. Returning an event to editor mode requires explicit confirmation and removes dependent operational data such as guests, staff admins, and scan history.

### Consequences

- The user sees a clear transition from design work to an active event.
- Guest and analytics routes reject drafts.
- Returning to editing is intentionally destructive and must remain explicit in every client.

---

## ADR-008: Use short-lived, invalidatable query caches

**Status:** Accepted  
**Date:** 2026-08-15

### Context

The dashboard and workspace need to feel responsive, while plans, guests, and event details can change from another device or after an API mutation.

### Decision

Web and mobile maintain a small in-memory query cache with short TTLs and request de-duplication. Important workspace data may be prefetched. A successful create, update, delete, plan change, or status change invalidates the affected cache prefix so the next read is authoritative.

### Consequences

- Navigation avoids unnecessary repeated reads.
- Cache data is not durable user data and is safe to discard.
- Mutation code must invalidate related keys deliberately.
- The app still fetches fresh data after the TTL or an explicit refresh.

---

## ADR-009: Keep durable assets separate from generated passes

**Status:** Accepted  
**Date:** 2026-08-15

### Context

Flyer images and uploaded assets need to be retained for future editing. Individual guest passes contain private data and are generated on demand; persisting each one creates unnecessary storage, privacy, and cleanup burden.

### Decision

Store durable input assets in Supabase Storage via the backend. Generate final guest invitation/pass bytes in memory from the latest saved event design and guest data. Responses are private and non-cacheable; they include an `X-GatherVia-Asset-Lifecycle: ephemeral` diagnostic header.

### Consequences

- No generated guest-pass objects need lifecycle cleanup.
- A new pass always reflects the saved canonical design and guest state.
- Asset uploads need backend credentials and availability monitoring.
- Rendering capacity is bounded per worker to protect memory under load.

## Review rule

Review these decisions when introducing another client, a new renderer feature, a payment provider, persistent offline editing, or a data migration. Update the status or add a new ADR rather than silently changing a foundational rule.
