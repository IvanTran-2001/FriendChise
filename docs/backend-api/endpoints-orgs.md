---
title: Organizations
description: Endpoints for memberships, announcements, roster, and org ownership checks
order: 8
---

All organization endpoints are scoped to `orgId`. The caller must be a member or have a relevant permission.

## Mobile memberships

`GET /api/mobile/me/organizations/[orgId]/memberships`

Returns a paged list of organization members for the authenticated mobile user. The response includes `page`, `pageSize`, `totalCount`, `totalPages`, and `hasMore` so the client can use either classic pagination or infinite scroll.

### Authentication

Bearer token required.

### Query parameters

| Param | Type | Default | Max | Description |
| --- | --- | --- | --- | --- |
| `page` | integer | `1` | — | Page number |
| `pageSize` | integer | `20` | `50` | Items per page |
| `search` | string | — | — | Search by member name/email/bot name |
| `roleId` | string | — | — | Filter to members with a specific role |
| `excludeIds` | string[] | — | — | Member IDs to exclude |
| `excludeBots` | boolean | `false` | — | Exclude bot memberships |

### Response

```json
{
  "memberships": [
    {
      "id": "mem_01abc",
      "userId": "usr_01abc",
      "botName": null,
      "status": "ACTIVE",
      "joinedAt": "2026-01-15T09:00:00.000Z",
      "workingDays": ["mon", "tue"],
      "user": {
        "id": "usr_01abc",
        "name": "Alex Chen",
        "email": "alex@example.com",
        "image": null
      },
      "memberRoles": [
        { "role": { "id": "role_01", "name": "Baker", "color": "#f59e0b" } }
      ],
      "name": "Alex Chen",
      "description": "alex@example.com",
      "image": null
    }
  ],
  "totalCount": 8,
  "totalPages": 1,
  "page": 1,
  "pageSize": 20,
  "hasMore": false
}
```

---

`POST /api/mobile/me/organizations/[orgId]/memberships`

Invites a member by email.

### Authentication

Bearer token required and `MANAGE_MEMBERS` permission required.

### Request body

```json
{
  "email": "new.member@example.com",
  "roleIds": ["role_01"],
  "workingDays": ["mon", "tue"]
}
```

### Response

Returns `{ "ok": true }` when the invite is created.

### Errors

| Status | Reason |
| --- | --- |
| `400` | Validation failed or email/user/role data is invalid |
| `401` | Token missing or invalid |
| `403` | Missing `MANAGE_MEMBERS` permission |
| `409` | The user is already a member or already has a pending invite |

---

`DELETE /api/mobile/me/organizations/[orgId]/memberships/[membershipId]`

Removes a member from the organization.

### Authentication

Bearer token required and `MANAGE_MEMBERS` permission required.

### Response

Returns `{ "ok": true }` when the member is removed.

### Errors

| Status | Reason |
| --- | --- |
| `401` | Token missing or invalid |
| `403` | Missing `MANAGE_MEMBERS` permission, or the member is the organization owner |
| `404` | Membership not found |

---

`POST /api/mobile/me/organizations/[orgId]/memberships/[membershipId]/convert`

Converts a member to a bot, or a bot to a member.

### Authentication

Bearer token required and `MANAGE_MEMBERS` permission required.

### Request body

```json
{ "kind": "bot" }
```

or

```json
{ "kind": "member", "userId": "usr_01abc" }
```

### Response

Returns `{ "ok": true }` when the conversion succeeds.

### Errors

| Status | Reason |
| --- | --- |
| `401` | Token missing or invalid |
| `403` | Missing `MANAGE_MEMBERS` permission, or the owner cannot be converted to a bot |
| `404` | Membership not found or the target user was not found |
| `409` | The target user already has a membership in the org |
| `400` | Validation failed or the membership is already in the requested state |

## List memberships

`GET /api/orgs/[orgId]/memberships`

Returns a paginated list of members in the organization. Supports filtering by role, search, exclusion lists, and bot exclusion.

### Authentication

Requires org membership.

### Query parameters

| Param | Type | Default | Max | Description |
| --- | --- | --- | --- | --- |
| `page` | integer | `1` | — | Page number |
| `pageSize` | integer | `10` | `50` | Items per page |
| `search` | string | — | — | Filter by user name or email |
| `roleId` | string | — | — | Filter to members with a specific role |
| `excludeIds` | string[] | — | — | Member IDs to exclude (repeatable: `?excludeIds=a&excludeIds=b`) |
| `excludeBots` | boolean | `false` | — | When `true`, exclude bot/system members |

### Response

```json
{
  "memberships": [
    {
      "id": "mem_01abc",
      "userId": "usr_01abc",
      "botName": null,
      "status": "ACTIVE",
      "joinedAt": "2026-01-15T09:00:00.000Z",
      "workingDays": ["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY"],
      "user": {
        "id": "usr_01abc",
        "name": "Alex Chen",
        "email": "alex@example.com",
        "image": null
      },
      "memberRoles": [
        { "role": { "id": "role_01", "name": "Baker", "color": "#f59e0b" } }
      ],
      "name": "Alex Chen",
      "description": "alex@example.com"
    }
  ],
  "totalCount": 8,
  "totalPages": 1,
  "page": 1,
  "pageSize": 10,
  "hasMore": false
}
```

---

## List announcements

`GET /api/orgs/[orgId]/announcements`

Returns paginated announcements for the organization, ordered by newest or oldest.

### Authentication

Requires org membership.

### Query parameters

| Param | Type | Default | Max | Description |
| --- | --- | --- | --- | --- |
| `page` | integer | `1` | — | Page number |
| `pageSize` | integer | `10` | `50` | Items per page |
| `order` | `newest` \| `oldest` | `newest` | — | Sort direction |

### Response

```json
{
  "announcements": [
    {
      "id": "ann_01abc",
      "title": "New opening hours for the holiday weekend",
      "body": "...",
      "createdAt": "2026-08-10T12:00:00.000Z"
    }
  ],
  "page": 1,
  "totalPages": 2,
  "pageSize": 10,
  "order": "newest"
}
```

---

## Get roster entries

`GET /api/orgs/[orgId]/roster-entries`

Returns roster entries for one or more week-start dates. Used by the roster page to load the visible schedule window incrementally.

### Authentication

Requires org membership.

### Query parameters

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `weeks` | string | Yes | Comma-separated ISO 8601 week-start dates (e.g. `2026-08-10,2026-08-17`). Maximum 20 weeks per request. |

### Example request

```http
GET /api/orgs/org_01abc/roster-entries?weeks=2026-08-10,2026-08-17
```

### Response

Array of roster entry objects for the requested weeks.

```json
[
  {
    "id": "entry_01",
    "orgId": "org_01abc",
    "membershipId": "mem_01abc",
    "weekStart": "2026-08-10T00:00:00.000Z",
    "data": { ... }
  }
]
```

Returns an empty array if `weeks` is missing or none of the provided dates are valid ISO dates.

---

## Update roster assignments

`POST /api/orgs/[orgId]/roster-entries`

Replaces every member assigned to a single roster cell — one `(weekStart, dayIndex)` pair. The `members` array is the complete new contents of that cell, so members left out of the request are unassigned from it, and an empty array clears the cell.

### Authentication

Requires the `MANAGE_MEMBERS` permission, the same permission used by the roster server actions.

### Body

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `weekStart` | string | Yes | ISO 8601 date-time for the Monday the cell belongs to. Must match the stored week-start key exactly (`00:00` UTC). |
| `dayIndex` | number | Yes | Day of the week, `0` (Monday) through `6` (Sunday). |
| `members` | array | Yes | Full replacement set of members for the cell. Pass `[]` to clear it. |

Each entry in `members`:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `membershipId` | string | Yes | Membership to assign. Must belong to this org. |
| `shiftStartMin` | number \| null | No | Shift start in minutes from midnight. `null` (the default) inherits the day config. |
| `shiftEndMin` | number \| null | No | Shift end in minutes from midnight. `null` (the default) inherits the day config. |

### Example request

```http
POST /api/orgs/org_01abc/roster-entries
Content-Type: application/json

{
  "weekStart": "2026-08-10T00:00:00.000Z",
  "dayIndex": 2,
  "members": [
    { "membershipId": "mem_01abc", "shiftStartMin": 540, "shiftEndMin": 1020 },
    { "membershipId": "mem_02def", "shiftStartMin": null, "shiftEndMin": null }
  ]
}
```

### Response

The roster entries that now occupy the cell, in the same shape returned by the `GET` above.

```json
{
  "entries": [
    {
      "id": "entry_01",
      "orgId": "org_01abc",
      "membershipId": "mem_01abc",
      "weekStart": "2026-08-10T00:00:00.000Z",
      "dayIndex": 2,
      "shiftStartMin": 540,
      "shiftEndMin": 1020,
      "membership": {
        "id": "mem_01abc",
        "botName": null,
        "user": { "name": "Riley" }
      }
    }
  ]
}
```

### Errors

| Status | Reason |
| --- | --- |
| `400` | `weekStart` is missing or not a valid date, `dayIndex` is not an integer in `0`–`6`, `members` is missing or malformed, or the JSON body could not be parsed |
| `401` | Not authenticated |
| `403` | Not a member of the org, or missing the `MANAGE_MEMBERS` permission |
| `404` | One or more `membershipId` values do not belong to this org |
| `415` | Request body was not JSON or form-encoded |

---

## Check parent owner status

`GET /api/orgs/[orgId]/is-parent-owner`

Checks whether the current user is the franchisor owner of this org or its parent. Used by the app shell to show or hide franchisor-only navigation.

### Authentication

Requires a signed-in user (session cookie or bearer token).

### Response

```json
{
  "isParentOwner": true,
  "parentOrgId": null
}
```

| Field | Description |
| --- | --- |
| `isParentOwner` | `true` if the current user owns the root (parent) franchise org |
| `parentOrgId` | ID of the parent org if the current user owns it but is viewing a child org; `null` otherwise |

### Errors

| Status | Reason |
| --- | --- |
| `401` | Not authenticated |
