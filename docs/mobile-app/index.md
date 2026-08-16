---
title: Mobile App
description: The friendchise-mobile-app Expo client and how it talks to the web backend
order: 3
---

FriendChise ships a companion mobile app (`friendchise-mobile-app/`) built with **Expo** and **Expo Router**. It is intentionally a thin client: it has no server of its own and reads/writes through the same backend used by the web app.

## How it fits together

- The mobile app calls the FriendChise web backend directly — there is no separate mobile API. All product logic (tasks, timetable, orgs, RBAC) lives in the web app's `app/api/*` and server actions.
- `EXPO_PUBLIC_API_URL` is the only thing that points the app at a backend. Use `http://localhost:3000` only for the iOS Simulator or Android Emulator; on Android Emulator you can also use `http://10.0.2.2:3000` or `adb reverse` to reach a host machine backend. Production builds use `https://friendchise.app` through the EAS profile in `eas.json`.
- Auth uses bearer tokens issued and verified by the backend. The shared `AUTH_SECRET` stays server-side. See [Authentication](/doc/mobile-app/authentication).

## Tech

- Expo + Expo Router (file-based routing under `app/(app)` and `app/(auth)`)
- Zustand for local auth/session state
- Expo SecureStore for persisting the auth token on-device
- A hand-rolled `StyleSheet`-based design system (no NativeWind/Tailwind) — tokens live in `src/lib/theme.ts`

## Key directories

- `app/(auth)`: sign-in, dev user picker (development only), and related screens.
- `app/(app)`: the authenticated app shell and feature screens.
- `src/features/`: feature modules (auth, tasks, etc.), each owning its own API calls and hooks.
- `src/lib/`: shared theme, env access, and low-level helpers.
- `components/ui/`: shared primitives (`Text`, `Button`, `Card`, `ListRow`, `Screen`, `ScreenHeader`, etc.).

## Feature parity with web

- Account deletion: the mobile app calls the same `/api/account/delete` endpoint used by the web settings page (see `components/layout/profile-panel/settings-sheet.tsx`).
- Session expiry: a `SessionWatcher` component reads the JWT's `exp` claim and automatically signs the user out when it lapses — this applies uniformly to normal, dev, and demo sessions.

## TODO

- [ ] Document push notification support once implemented.
- [ ] Document offline/error-state behavior conventions once formalized.
- [ ] Link to the mobile design system reference once it's published as its own doc page.
