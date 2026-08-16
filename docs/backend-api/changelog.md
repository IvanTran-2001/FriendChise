---
title: API Changelog
description: A record of significant API changes, additions, and removals
order: 11
---

Changes that affect request/response shapes, authentication requirements, or route paths are recorded here.

---

## 2026

### August 2026

**Added** — `DELETE /api/account/delete` — allows authenticated users to permanently delete their own account. Requires `confirmText` matching the user's email. Added as part of GDPR/data deletion support for the mobile settings flow.

**Added** — `/api/mobile/*` route group — dedicated endpoints for the mobile app using bearer-token authentication: `GET /api/mobile/me`, `GET /api/mobile/me/organizations`, `GET /api/mobile/me/organization`.

**Added** — `/api/mobile-auth/*` route group — custom OAuth handshake for the mobile app: `oauth-start/[provider]`, `complete`. Enables the mobile app to obtain a bearer token after signing in via the system browser without CSRF token issues.

---

## Architecture note

Earlier versions of FriendChise exposed a broader CRUD REST API for tasks, orgs, memberships, and timetable entries. Those routes have been removed. State mutations now happen through **Next.js server actions** (`app/actions/*`) rather than HTTP endpoints. The current API surface is intentionally narrow:

- Mobile-specific identity and auth routes (`/api/mobile/*`, `/api/mobile-auth/*`)
- Lazy-loading helpers the web client cannot express as server actions (paginated tasks, roster entries, memberships)
- Image and storage URL helpers
- Account management (`/api/account/*`)
- Framework handlers (Auth.js, Playwright test login)

New features that require mobile API access are added to the `/api/mobile/*` or `/api/orgs/[orgId]/*` groups as needed.
