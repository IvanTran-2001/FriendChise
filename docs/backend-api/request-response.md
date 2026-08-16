---
title: Request and Response Format
description: Content types, request bodies, pagination, and response envelope conventions
order: 4
---

## Content types

Most API routes accept `application/json`. Routes that accept file uploads also accept `multipart/form-data`. Both formats are parsed automatically; you do not need to normalize them before sending.

### JSON

```http
Content-Type: application/json

{ "title": "Prepare doughnut glaze", "durationMin": 15 }
```

### FormData

FormData is accepted on task create (`POST /api/orgs/[orgId]/tasks`) and task update (`PATCH /api/orgs/[orgId]/tasks/[taskId]`) when the request includes an image. All other routes expect JSON.

```http
Content-Type: multipart/form-data; boundary=...

title=Prepare doughnut glaze
durationMin=15
imageStoragePath=orgs/abc/tasks/xyz/photo.jpg
```

## Response format

Most API data responses are JSON. Successful responses return the resource or a result envelope directly at the top level — there is no shared wrapper. Redirect-based auth routes, including the mobile OAuth endpoints, return HTTP redirects instead of JSON.

Examples:

```json
{ "task": { "id": "...", "title": "...", ... } }
```

```json
{ "organizations": [ ... ], "totalCount": 12, "totalPages": 1, "page": 1 }
```

```json
{ "ok": true }
```

## Pagination

Routes that return lists support cursor-based or offset-based pagination depending on the endpoint.

### Offset-based pagination

Used by: memberships, announcements, images, org organizations, tool item list.

Query params:

| Param | Type | Default | Max | Description |
| --- | --- | --- | --- | --- |
| `page` | integer | `1` | — | 1-based page number |
| `pageSize` or `limit` | integer | varies | 50–100 | Items per page |
| `search` | string | — | — | Optional text filter |

Response fields:

```json
{
  "items": [ ... ],
  "totalCount": 42,
  "totalPages": 3,
  "page": 1,
  "pageSize": 24
}
```

### Cursor-based pagination

Used by: paginated tasks (`/tasks/paginated`), scan-to-task history.

The list field is endpoint-specific: `/tasks/paginated` returns `tasks`, while scan-to-task history returns `results`. `nextCursor` is the shared field.

Query params:

| Param | Type | Description |
| --- | --- | --- |
| `cursor` | string | ID of the last item from the previous page. Omit for the first page. |
| `limit` | integer | Items per page. Default and max vary by endpoint. |

Response fields:

```json
{
  "results": [ ... ],
  "nextCursor": "task_id_of_last_item"
}
```

`nextCursor` is `null` when there are no more pages.

## Times and durations

All times that represent a point in the day (e.g. `preferredStartTimeMin`) are in **minutes since midnight** (0–1439). A value of `480` means 08:00.

All durations (e.g. `durationMin`) are in **minutes**.

All date-time fields in responses are ISO 8601 strings in UTC.

## Empty and null values

- Optional fields not provided in the request body are not set (treated as unchanged on updates).
- Fields that are explicitly nullable (e.g. `description`) accept `null` to clear them.
- Omitting an optional field is different from sending `null` only where that distinction is documented.
