---
title: Mobile Authentication
description: How the mobile app obtains and uses a bearer token through the OAuth handshake
order: 5
---

The mobile app cannot use browser session cookies, so it goes through a two-step OAuth handshake that produces a JWT bearer token. This token is then sent on every API request via the `Authorization` header.

## How it works

```text
Mobile app
  |
  |-- 1. Open system browser
  |      GET /api/mobile-auth/oauth-start/[provider]?callbackUrl=friendchise://auth
  |
  |   Auth.js redirects user to Google / linkedin for login
  |
  |-- 2. OAuth callback lands at /api/mobile-auth/complete?callbackUrl=friendchise://auth
  |      Server encodes session into a JWT, redirects to callbackUrl?token=<jwt>
  |
  |-- 3. App receives deep-link with token
  |      Stores token in SecureStore
  |      Sends Authorization: Bearer <token> on all API requests
```

## Step 1 — Start OAuth

`GET /api/mobile-auth/oauth-start/[provider]`

Initiates the OAuth flow by calling Auth.js internally. The mobile app opens this URL in the system browser.

### Path parameters

| Param | Values | Description |
| --- | --- | --- |
| `provider` | `google`, `linkedin` | OAuth provider to use |

### Query parameters

| Param | Required | Description |
| --- | --- | --- |
| `callbackUrl` | Yes | Where to redirect after sign-in. Must be a deep-link (`friendchise://`, `exp://`, `exps://`) or the same origin. |

### Example

```http
GET /api/mobile-auth/oauth-start/google?callbackUrl=friendchise://auth/callback
```

### Errors

| Status | Reason |
| --- | --- |
| `400` | `provider` is not `google` or `linkedin` |
| `400` | `callbackUrl` is missing or not a valid deep-link or same-origin URL |

---

## Step 2 — Complete OAuth

`GET /api/mobile-auth/complete`

Called automatically by Auth.js after the OAuth sign-in succeeds. The server reads the active session, encodes a JWT, and redirects to `callbackUrl?token=<jwt>`.

### Query parameters

| Param | Required | Description |
| --- | --- | --- |
| `callbackUrl` | Yes | Must match the `callbackUrl` from step 1. The token is appended as `?token=<jwt>`. |

### Token format

The JWT is a signed HS256 token (encoded via `next-auth/jwt`). It carries:

| Claim | Description |
| --- | --- |
| `sub` | User ID |
| `email` | User email |
| `name` | User display name |
| `picture` | User avatar URL |
| `exp` | Expiry timestamp (30 days from issue) |

The token is signed with `AUTH_SECRET` using the salt `friendchise.mobile-session-token`.

### Errors

| Status | Reason |
| --- | --- |
| `302` → `/signin?hint=account_required` | No active session after OAuth |
| `400` | `callbackUrl` is missing or invalid |
| `500` | `AUTH_SECRET` not set on the server |

---

## Using the token

Include the token in the `Authorization` header on every authenticated request:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
```

A missing or expired token returns `401 Unauthorized`.

## Token expiry

Tokens expire after 30 days. Demo tokens (see below) are the exception and expire much sooner. There is no automatic refresh. The mobile app should re-run the OAuth flow when a `401` is received.

## Development-only flows

These routes return `404 Not Found` in production and must never be relied on outside development.

### Dev user sign-in

`GET /api/mobile-auth/dev?callbackUrl=<url>`

Signs in as a seeded development user without OAuth. Only available when `NODE_ENV=development`.

### Demo session

`GET /api/mobile-auth/demo?callbackUrl=<url>`

Provisions and signs in as a demo user. Only available when `NODE_ENV=development`. Unlike the normal 30-day token, this JWT expires after `DEMO_JWT_TTL_MS` (1 hour, matching the web demo session) — clients should read the token's `email` claim (ends with `@demo.friendchise.app`) to detect demo mode and its `exp` claim to show a countdown.

### List dev users

`GET /api/mobile-auth/dev-users`

Returns the list of seeded development users available for sign-in. Only available when `NODE_ENV=development`.
