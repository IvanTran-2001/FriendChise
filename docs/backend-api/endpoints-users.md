---
title: Users and Accounts
description: Endpoints for the current user profile, organization membership list, and account deletion
order: 6
---

## Get current user

`GET /api/mobile/me`

Returns the profile of the currently authenticated user. Used by the mobile app after sign-in to confirm identity and load the user's name and avatar.

### Authentication

Bearer token required.

### Response

```json
{
  "user": {
    "id": "usr_01abc",
    "name": "Alex Chen",
    "email": "alex.chen@example.com",
    "image": "https://lh3.googleusercontent.com/..."
  }
}
```

### Errors

| Status | Reason                                       |
| ------ | -------------------------------------------- |
| `401`  | Token missing or invalid                     |
| `404`  | Authenticated user ID has no database record |

---

## List user organizations (mobile)

`GET /api/mobile/me/organizations`

Returns all organizations the authenticated user is a member of, ordered by name. Used by the mobile app to populate the org picker.

### Authentication

Bearer token required.

### Response

```json
{
  "organizations": [
    {
      "id": "org_01abc",
      "name": "Downtown Doughnuts",
      "image": "https://cdn.friendchise.app/orgs/..."
    }
  ]
}
```

`image` is a resolved public URL, or `null` if the org has no image set.

### Errors

| Status | Reason                   |
| ------ | ------------------------ |
| `401`  | Token missing or invalid |

---

## Create organization (mobile)

`POST /api/mobile/me/organizations`

Creates a standalone organization for the authenticated mobile user.

### Authentication

Bearer token required.

### Request body

Same shape as the web create-org endpoint:

```json
{
  "title": "Downtown Doughnuts",
  "timezone": "Australia/Sydney",
  "address": "42 Harbour Street",
  "operatingDays": ["mon", "tue", "wed"],
  "openTimeMin": 360,
  "closeTimeMin": 1080
}
```

### Response

Returns the created organization payload, including a public image URL when present.

### Errors

| Status | Reason                          |
| ------ | ------------------------------- |
| `401`  | Token missing or invalid        |
| `400`  | Validation failed               |
| `400`  | Malformed JSON body.            |
| `429`  | Demo organization limit reached |

---

## Join organization (mobile)

`POST /api/mobile/me/organizations/join`

Joins an existing franchise using a one-time invite token.

### Authentication

Bearer token required.

### Request body

```json
{
  "token": "franchise-invite-token"
}
```

Schedule fields are optional and use the same validation as the web join flow.

### Response

Returns the newly created franchise org payload, including a public image URL when present.

### Errors

| Status | Reason                                             |
| ------ | -------------------------------------------------- |
| `401`  | Token missing or invalid                           |
| `400`  | Validation failed or the invite token was rejected |
| `400`  | Malformed JSON body.                               |

---

## Delete organization (mobile)

`DELETE /api/mobile/me/organizations/[orgId]`

Deletes a mobile organization when the caller provides the exact organization name as confirmation.

### Authentication

Bearer token required.

### Request body

```json
{
  "confirmName": "Downtown Doughnuts"
}
```

`confirmName` must match the organization name exactly.

### Response

Returns `{ "ok": true }` when the organization is deleted.

### Errors

| Status | Reason                                 |
| ------ | -------------------------------------- |
| `401`  | Token missing or invalid               |
| `400`  | Validation failed                      |
| `400`  | Malformed JSON body.                   |
| `403`  | Caller is not the owner or org is franchise-scoped |
| `404`  | Organization not found                 |

---

## Get default organization (mobile)

`GET /api/mobile/me/organization`

Returns the user's first organization by name. Used by the mobile app when no explicit org has been selected yet.

### Authentication

Bearer token required.

### Response

```json
{
  "organization": {
    "id": "org_01abc",
    "name": "Downtown Doughnuts"
  },
  "orgId": "org_01abc"
}
```

### Errors

| Status | Reason                      |
| ------ | --------------------------- |
| `401`  | Token missing or invalid    |
| `404`  | User has no org memberships |

---

## List user organizations (web)

`GET /api/me/organizations`

Returns a paginated list of organizations for the current web session user. Supports search and active-org resolution.

### Authentication

Session cookie (web only).

### Query parameters

| Param         | Type    | Default | Max   | Description                                    |
| ------------- | ------- | ------- | ----- | ---------------------------------------------- |
| `page`        | integer | `1`     | —     | Page number                                    |
| `limit`       | integer | `24`    | `100` | Items per page                                 |
| `search`      | string  | —       | —     | Filter orgs by name                            |
| `activeOrgId` | string  | —       | —     | Org ID to resolve alongside the paginated list |

### Response

```json
{
  "organizations": [
    { "id": "org_01abc", "name": "Downtown Doughnuts", "image": null }
  ],
  "activeOrganization": {
    "id": "org_01abc",
    "name": "Downtown Doughnuts",
    "image": null
  },
  "totalCount": 3,
  "totalPages": 1,
  "page": 1,
  "pageSize": 24,
  "search": ""
}
```

If no session is present, returns an empty result (`totalCount: 0`) rather than a `401`.

---

## Create organization (web)

`POST /api/me/organizations`

Creates a new standalone organization owned by the authenticated user.

### Authentication

Session cookie (web only).

### Request body

```json
{
  "title": "Downtown Doughnuts",
  "timezone": "Australia/Sydney",
  "address": "123 Main St",
  "operatingDays": ["mon", "tue", "wed", "thu", "fri"],
  "openTimeMin": 480,
  "closeTimeMin": 1020
}
```

`title` is required (max 100 characters). All other fields are optional.

### Response

`201 Created`

```json
{
  "organization": {
    "id": "org_01abc",
    "name": "Downtown Doughnuts",
    "timezone": "Australia/Sydney",
    "address": "123 Main St",
    "operatingDays": ["mon", "tue", "wed", "thu", "fri"],
    "openTimeMin": 480,
    "closeTimeMin": 1020,
    "image": null
  }
}
```

### Errors

| Status | Reason                                   |
| ------ | ---------------------------------------- |
| `401`  | Session missing or invalid               |
| `400`  | Malformed JSON body or validation failed |
| `429`  | Demo limit reached                       |

---

## Delete account

`DELETE /api/account/delete`

Permanently deletes the authenticated user's account after confirmation.

### Authentication

Bearer token or session cookie.

### Request body

```json
{
  "confirmText": "Alex Chen"
}
```

`confirmText` must exactly match the user's display name if one exists, otherwise their email address. The comparison is case-sensitive and is only used as the deletion confirmation check.

### Response

```json
{ "ok": true }
```

### Errors

| Status | Reason                                                   |
| ------ | -------------------------------------------------------- |
| `400`  | `confirmText` is missing from the request body           |
| `400`  | `confirmText` does not match the user's name or email    |
| `403`  | Session-cookie request did not come from the same origin |
| `401`  | Not authenticated                                        |
| `404`  | User record not found                                    |
| `500`  | Unexpected error during deletion                         |

### Important notes

- Deletion is **permanent and irreversible**.
- Any organizations the user owns remain in place, but their `ownerId` is cleared before the account row is deleted.
- The user's memberships are converted to bot accounts before deletion.
- Session-cookie requests must come from the same origin; bearer-token requests are allowed without the browser-origin check.
