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
    "image": "https://lh3.googleusercontent.com/..."
  }
}
```

### Errors

| Status | Reason |
| --- | --- |
| `401` | Token missing or invalid |
| `404` | Authenticated user ID has no database record |

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

| Status | Reason |
| --- | --- |
| `401` | Token missing or invalid |

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

| Status | Reason |
| --- | --- |
| `401` | Token missing or invalid |
| `404` | User has no org memberships |

---

## List user organizations (web)

`GET /api/me/organizations`

Returns a paginated list of organizations for the current web session user. Supports search and active-org resolution.

### Authentication

Session cookie (web only).

### Query parameters

| Param | Type | Default | Max | Description |
| --- | --- | --- | --- | --- |
| `page` | integer | `1` | — | Page number |
| `limit` | integer | `24` | `100` | Items per page |
| `search` | string | — | — | Filter orgs by name |
| `activeOrgId` | string | — | — | Org ID to resolve alongside the paginated list |

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

## Delete account

`DELETE /api/account/delete`

Permanently deletes the authenticated user's account and all associated data.

### Authentication

Bearer token or session cookie.

### Request body

```json
{
  "confirmText": "alex@example.com"
}
```

`confirmText` must exactly match the user's email address (case-sensitive). This is required to prevent accidental deletion.

### Response

```json
{ "ok": true }
```

### Errors

| Status | Reason |
| --- | --- |
| `400` | `confirmText` is missing from the request body |
| `400` | `confirmText` does not match the user's email |
| `401` | Not authenticated |
| `404` | User record not found |
| `500` | Unexpected error during deletion |

### Important notes

- Deletion is **permanent and irreversible**.
- All org memberships, tasks owned by the user, session data, and linked OAuth accounts are removed.
- If the user is the owner of an organization, you must transfer or delete the org before deleting the account. TODO: confirm exact behavior from `deleteUserAccount` service.
