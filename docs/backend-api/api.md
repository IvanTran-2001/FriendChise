---
title: API Route Reference
description: Complete public inventory of app/api routes, methods, and auth requirements
order: 18.5
---

Complete public inventory of HTTP routes in `app/api`. Internal admin routes are excluded. For full request/response documentation, see the linked endpoint pages.

## Mobile authentication

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/mobile-auth/oauth-start/[provider]` | None | Start OAuth flow for mobile. `provider`: `google` or `linkedin`. Requires `callbackUrl` query param. |
| `GET` | `/api/mobile-auth/complete` | Session cookie | Complete OAuth; requires `callbackUrl`, encodes the session into JWT, and redirects with `?token=<jwt>`. |
| `GET` | `/api/mobile-auth/demo` | None | Dev only (404 in production). Provision a demo session. |
| `GET` | `/api/mobile-auth/dev` | None | Dev only (404 in production). Sign in as a seeded dev user. |
| `GET` | `/api/mobile-auth/dev-users` | None | Dev only (404 in production). List available dev users. |

Full docs: [Mobile Authentication](/doc/backend-api/endpoints-mobile-auth)

## Mobile identity

These routes use bearer token authentication (`Authorization: Bearer <token>`).

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/mobile/me` | Bearer | Current user profile (`id`, `name`, `email`, `image`). |
| `GET` | `/api/mobile/me/organizations` | Bearer | All orgs the user is a member of. |
| `GET` | `/api/mobile/me/organization` | Bearer | First org by name (default org for new sessions). |

Full docs: [Users and Accounts](/doc/backend-api/endpoints-users)

## Account management

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| `DELETE` | `/api/account/delete` | Bearer or session | Permanently delete the current user's account. Body: `{ confirmText: <user email> }`. |

Full docs: [Users and Accounts](/doc/backend-api/endpoints-users)

## Web identity

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/me/organizations` | Session | Paginated org list for the current web session user. |
| `POST` | `/api/me/organizations` | Session | Create a new standalone organization. |

Full docs: [Users and Accounts](/doc/backend-api/endpoints-users)

## Tasks

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/orgs/[orgId]/tasks` | `MANAGE_TASKS` | Create a new task (recipe, procedure, checklist). |
| `GET` | `/api/orgs/[orgId]/tasks/[taskId]` | Member | Get a single task by ID. |
| `PATCH` | `/api/orgs/[orgId]/tasks/[taskId]` | Member (franchise-scoped) | Partially update a task. |
| `GET` | `/api/orgs/[orgId]/tasks/paginated` | Member | Cursor-based task list for infinite scroll. |
| `GET` | `/api/orgs/[orgId]/tasks/simple` | Member | Lightweight task list for pickers. |

Full docs: [Tasks](/doc/backend-api/endpoints-tasks)

## Organizations

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/orgs/[orgId]/memberships` | Member | Paginated member list with roles. |
| `GET` | `/api/orgs/[orgId]/announcements` | Member | Paginated org announcements. |
| `GET` | `/api/orgs/[orgId]/roster-entries` | Member | Roster entries for requested week-start dates. |
| `POST` | `/api/orgs/[orgId]/roster-entries` | `MANAGE_MEMBERS` | Replace every member assigned to one roster cell. Body: `{ weekStart, dayIndex, members }`. |
| `GET` | `/api/orgs/[orgId]/is-parent-owner` | Signed in | Check if current user is the franchisor owner. |

Full docs: [Organizations](/doc/backend-api/endpoints-orgs)

## Images and storage

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/orgs/[orgId]/images/upload-url` | Member | Get a presigned URL for uploading an image to storage. |
| `POST` | `/api/orgs/[orgId]/storage/read-url` | Member | Get a signed read URL for a private storage object. |
| `GET` | `/api/orgs/[orgId]/images` | Member | Paginated org image library. |
| `POST` | `/api/orgs/[orgId]/images` | Member | Save an uploaded image to the org image library. |
| `DELETE` | `/api/orgs/[orgId]/images/[imageId]` | Member | Delete an image from the org image library. |

Full docs: [Images and File Uploads](/doc/backend-api/endpoints-images)

## Tools

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/orgs/[orgId]/task-tools?kind=` | Member | List tools of a given kind: `conversion`, `item-list`, or `roster`. |
| `GET` | `/api/orgs/[orgId]/tools/item-list` | Member | Paginated item-list tool items with signed image URLs. |
| `GET` | `/api/orgs/[orgId]/tools/scan-to-task/history` | `MANAGE_TASKS` | Cursor-paged scan-to-task results with AI-extracted drafts and duplicate candidates. |
| `POST` | `/api/orgs/[orgId]/tools/scan-to-task/upload-url` | `MANAGE_TASKS` | Create a short-lived upload URL for a scan source. |
| `POST` | `/api/orgs/[orgId]/tools/scan-to-task` | `MANAGE_TASKS` | Scan uploaded files into draft task suggestions. |
| `POST` | `/api/orgs/[orgId]/tools/scan-to-task/confirm` | `MANAGE_TASKS` | Confirm a reviewed scan result and create a task. |
| `POST` | `/api/orgs/[orgId]/tools/scan-to-task/clear` | `MANAGE_TASKS` | Clear a scan result from the active queue. |
| `GET` | `/api/orgs/[orgId]/tools/menu/[menuId]` | Member | Get a menu by ID. |
| `GET` | `/api/orgs/[orgId]/tools/menu/[menuId]/items` | Member | Items on a menu. |

Full docs: [Tools](/doc/backend-api/endpoints-tools)

## Public routes

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/menu/[token]/items` | None | Public menu items for a shared menu token. |

Full docs: [Tools — Menu items (public)](/doc/backend-api/endpoints-tools)

## Framework routes

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| `GET` / `POST` | `/api/auth/[...nextauth]` | — | Auth.js handler. No custom app logic. |
| `GET` | `/api/test/login` | None | Playwright test login. Only active when `TEST_MODE=1`. |

## Admin routes (internal)

These routes are for internal admin tooling only and are intentionally excluded from the public API inventory above.
