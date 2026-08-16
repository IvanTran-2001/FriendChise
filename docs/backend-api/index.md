---
title: Backend / API
description: API reference, architecture notes, and data documentation for FriendChise
order: 4
---

FriendChise is a single Next.js app. There is no separate backend service. "Backend" here means everything under `app/api`, `app/actions`, `lib/services`, and `prisma`.

## API reference

- [Base URL and Environments](/doc/backend-api/environments) — production and local dev API URLs
- [Authentication](/doc/backend-api/authentication) — session cookies (web) and bearer tokens (mobile)
- [Error Handling](/doc/backend-api/error-handling) — HTTP status codes and error response format
- [Request and Response Format](/doc/backend-api/request-response) — content types, pagination, time values
- [Mobile Authentication Endpoints](/doc/backend-api/endpoints-mobile-auth) — the OAuth handshake that produces a mobile bearer token
- [Users and Accounts Endpoints](/doc/backend-api/endpoints-users) — current user profile, org list, account deletion
- [Tasks Endpoints](/doc/backend-api/endpoints-tasks) — create, read, update, list (tasks, recipes, procedures)
- [Organizations Endpoints](/doc/backend-api/endpoints-orgs) — memberships, announcements, roster, parent-owner check
- [Images and File Uploads Endpoints](/doc/backend-api/endpoints-images) — presigned upload URLs, signed read URLs, org image library
- [Tools Endpoints](/doc/backend-api/endpoints-tools) — item lists, conversions, roster templates, scan-to-task history
- [API Changelog](/doc/backend-api/changelog) — history of API additions and removals

## Architecture and internals

- [API Route Reference](/doc/backend-api/api) — complete route inventory (all `app/api/*` paths)
- [Services and Actions](/doc/backend-api/services-and-actions) — why mutations go through server actions, not REST endpoints
- [Operations](/doc/backend-api/operations) — audit logging, monitoring, rate limiting, and cleanup
- [Database](/doc/backend-api/database) — Prisma schema, enums, and seeding

## Shape of a write

Most state changes do **not** go through `app/api`. Instead:

1. A client component calls a **server action** in `app/actions/*`.
2. The action authenticates the caller (via `lib/authz/action.ts`), validates input, and calls into a **service** in `lib/services/*`.
3. The service performs the actual database work (often in a transaction), writes an audit log entry where relevant, and returns a typed result.
4. The action calls `revalidatePath`/redirects as needed for the UI.

`app/api` is reserved for cases a server action cannot cover: mobile authentication, bearer-token-scoped identity endpoints, lazy-loading helpers (pagination, roster weeks, memberships), image and storage URL helpers, and account management.

## Authorization

See [Authentication](/doc/authentication) for the full guard layer (`lib/authz/api.ts`, `page.ts`, `action.ts`) and [RBAC](/doc/authentication/rbac) for the permission model.
