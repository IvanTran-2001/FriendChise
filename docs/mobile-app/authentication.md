---
title: Mobile Authentication
description: How the Expo app signs in against the same Auth.js backend as the web app
order: 1
---

The mobile app does not run its own auth system. It authenticates against the FriendChise web backend and stores the resulting token on-device.

## Flow

1. The user signs in through the standard OAuth flow (or, in development, the seeded dev-user picker) against the web backend.
2. The backend issues a signed JWT (the same token shape used for the web session) using `AUTH_SECRET`. The mobile app never contains that secret.
3. The mobile app stores the token in **Expo SecureStore**.
4. Subsequent API requests attach the token as a bearer `Authorization` header via a shared `apiFetch` helper.

## Demo sessions

The web app exposes `GET /api/mobile-auth/demo`, a development-only endpoint that provisions an isolated demo org and redirects back to the app with a token via `callbackUrl`. See [Task System](/doc/task-system) and the web [Authentication](/doc/authentication) page for how demo/dev credential flows are gated to non-production environments.

## Session expiry

- `src/features/auth/jwt-utils.ts` exposes `getJwtExpiryMs()` / `isJwtExpired()` to read the token's `exp` claim client-side.
- `src/features/auth/session-watcher.tsx` renders a `SessionWatcher` that sets a timer for the token's expiry and signs the user out automatically when it lapses — no separate mobile-specific expiry logic is needed since it works off the standard JWT claim.
- `src/features/auth/token-store.ts` wraps SecureStore reads/writes for the token.

## Common failure

- The most common local-dev auth failure is a missing or incorrect `EXPO_PUBLIC_API_URL` in the mobile app's environment — it must point at a reachable instance of the web backend (see [Environment Variables](/doc/environment-variables)).
- The backend issuer and verifier must share the same `AUTH_SECRET`; a mismatch causes token verification to fail silently (requests come back unauthorized).

## TODO

- [ ] Document token refresh behavior (if/when refresh tokens are introduced) — today the app relies on session expiry + re-login rather than silent refresh.
