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

**Added** — `POST /api/mobile/me/organizations` and `POST /api/mobile/me/organizations/join` — bearer-token org creation and franchise join flows for the mobile app.

**Added** — `/api/mobile-auth/*` route group — custom OAuth handshake for the mobile app: `oauth-start/[provider]`, `complete`. Enables the mobile app to obtain a bearer token after signing in via the system browser without CSRF token issues.

**Added** — `/api/orgs/[orgId]/tools/scan-to-task/*` route group — mobile scan-to-task workflow for upload URL creation, scan processing, result confirmation, and result clearing.

---

## Architecture note

Earlier versions of FriendChise exposed a broader CRUD REST API for tasks, orgs, memberships, and timetable entries. Most write paths now happen through **Next.js server actions** (`app/actions/*`), but a small set of org-scoped HTTP routes still support task and mobile workflows. The current API surface is intentionally narrow:

- Mobile-specific identity and auth routes (`/api/mobile/*`, `/api/mobile-auth/*`)
- Org-scoped task routes that still serve the web client and mobile tooling (`POST /api/orgs/[orgId]/tasks`, `PATCH /api/orgs/[orgId]/tasks/[taskId]`, `GET /api/orgs/[orgId]/tasks/paginated`, `GET /api/orgs/[orgId]/tasks/simple`)
- Mobile scan-to-task routes (`/api/orgs/[orgId]/tools/scan-to-task/*`)
- Image and storage URL helpers
- Account management (`/api/account/*`)
- Framework handlers (Auth.js, Playwright test login)

New features that require mobile API access are added to the `/api/mobile/*` or `/api/orgs/[orgId]/*` groups as needed.
