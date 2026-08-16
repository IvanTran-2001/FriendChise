---
title: Authentication
description: How the API authenticates requests from the web app and the mobile app
order: 2
---

FriendChise uses two authentication mechanisms depending on the client.

## Web app: session cookies

The web app uses [Auth.js v5](https://authjs.dev) managed through Next.js middleware. After a user signs in via OAuth (Google or LinkedIn), Auth.js sets a signed session cookie. Server components, server actions, and `app/api` routes read this cookie via the `auth()` helper.

Web-facing API routes that need authentication call one of:

- `requireUser()` — requires any signed-in user
- `requireOrgMember(orgId)` — requires the user to be a member of the org
- `requireOrgPermission(orgId, action)` — requires a specific permission inside the org

If the session is missing or invalid, these return a `401 Unauthorized` response automatically.

## Mobile app: bearer token

The mobile app cannot use cookies for API calls across different network contexts, so it uses a short-lived JWT bearer token instead.

The token is obtained through the [mobile auth flow](/doc/backend-api/endpoints-mobile-auth) and must be sent on every request in the `Authorization` header:

```http
Authorization: Bearer <token>
```

Mobile API routes under `/api/mobile/*` validate bearer tokens using `getAuthUserId()` from `lib/authz/_shared`. That helper decodes the JWT using the shared `AUTH_SECRET`.

Routes under `/api/account/*` use `requireUser()` instead. They accept either a web session cookie or the same bearer token used by the mobile app.

### Token details

| Property | Value |
| --- | --- |
| Algorithm | HS256 (NextAuth JWT, encoded with `next-auth/jwt`) |
| Expiry | 30 days |
| Secret | `AUTH_SECRET` environment variable (shared between web and mobile) |
| Cookie salt | `friendchise.mobile-session-token` |

The token carries `sub` (userId), `email`, `name`, and `picture`. Only `sub` is used for authorization checks.

### Keeping tokens fresh

The mobile app should prompt for re-authentication when a request returns `401`. Tokens expire after 30 days and are not automatically refreshed.

## OAuth providers

Both Google and LinkedIn OAuth are supported. The actual OAuth credentials and secrets are configured in `.env.local` and never reach the mobile client.

## Development and test modes

- `GET /api/mobile-auth/dev` and `GET /api/mobile-auth/demo` are only enabled when `NODE_ENV=development`. They return `404` in production.
- `GET /api/test/login` is only enabled when `TEST_MODE=1`. It creates a real Auth.js session for Playwright tests.
