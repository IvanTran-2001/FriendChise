---
title: Organizations
description: Endpoints for memberships, announcements, roster, and org ownership checks
order: 8
---

All organization endpoints are scoped to `orgId`. The caller must be a member or have a relevant permission.

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
