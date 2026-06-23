---

title: Authentication

order: 18.5

---
Authentication is handled by **Auth.js v5 (NextAuth)** with **Google OAuth** and **LinkedIn OAuth** as the providers.

- Route: `GET|POST /api/auth/[...nextauth]` (handled automatically by Auth.js)
- Session strategy: **JWT** (tokens signed with `AUTH_SECRET`, stored in a cookie — no DB reads for session lookup itself; authorization checks like `requireOrgPermission` still query the DB to verify membership on each request)
- The Prisma adapter stores `User` and `Account` records in Postgres for OAuth account linking
- The signed-in user's database `id` is mapped from `token.sub` into `session.user.id` so API routes and server actions can look up `Membership` records for authorization

Configure your OAuth apps and set the redirect URIs to the matching Auth.js callback paths, for example `http://localhost:3000/api/auth/callback/google` and `http://localhost:3000/api/auth/callback/linkedin`.

### Demo and dev sign-in

In `NODE_ENV === "development"`, two credentials flows are registered:

- `demo` — used by the demo button to launch an isolated demo session
- `dev` — accepts any seeded user email with no password

The sign-in page renders a `DevUserPicker` component — a searchable, scrollable list of the seeded test accounts — and a `TryDemoButton` so engineers can switch seeded users or launch the demo session without OAuth.

| File                                      | Purpose                                                     |
| ----------------------------------------- | ----------------------------------------------------------- |
| `app/(auth)/signin/dev-user-picker.tsx`   | Client component; renders the picker UI                     |
| `app/(auth)/signin/dev-sign-in-action.ts` | Server action; calls `signIn("dev", { email, redirectTo })` |
| `app/(auth)/signin/try-demo-button.tsx`   | Client component; shows the demo loading state              |

Both the `demo` and `dev` credential flows are registered in `auth.ts` and excluded from production builds via a `process.env.NODE_ENV` guard.

### Auth config split

Auth.js config is intentionally split into two files:

| File             | Purpose                                                                                             |
| ---------------- | --------------------------------------------------------------------------------------------------- |
| `auth.config.ts` | Edge-compatible config (no Prisma). Used by middleware for fast auth checks.                        |
| `auth.ts`        | Full config with Prisma adapter and JWT session callback. Used by API routes and server components. |

This is required because Next.js middleware runs on the **Edge runtime**, which cannot import Node.js modules like `@prisma/client`.

`proxy.ts` is the auth middleware. It uses the edge-compatible `authConfig` to protect matched routes without hitting the database, and forwards the current pathname as an `x-pathname` request header so the server-rendered breadcrumb can read it without `usePathname()`.

### Authorization model

Auth guards live in `lib/authz/` — a directory split by calling context. All three contexts share low-level DB helpers in `_shared.ts`.

| File                  | Used by                | Returns on failure                                |
| --------------------- | ---------------------- | ------------------------------------------------- |
| `lib/authz/api.ts`    | API route handlers     | `{ ok: false, response: NextResponse }` (401/403) |
| `lib/authz/page.ts`   | Server page components | Calls `redirect()` directly                       |
| `lib/authz/action.ts` | Server actions         | `{ ok: false }` — no side effects                 |

Each context exposes three guards at increasing strictness:

| Guard                             | Requirement                                                        |
| --------------------------------- | ------------------------------------------------------------------ |
| `requireUser*()`                  | Caller must be signed in                                           |
| `requireOrgMember*(orgId)`        | Caller must be signed in and hold a `Membership` in the org        |
| `requireOrgPermission*(orgId, p)` | Caller must be a member whose role(s) grant `PermissionAction` `p` |
| `requireSuperAdmin*()`            | Caller's email must exist in the `AdminUser` table                 |

`requireParentOrgOwner*(orgId)` is also available in `page` and `action` contexts — it requires the caller to be the owner of an org with no `parentId` (i.e. a franchisor).
