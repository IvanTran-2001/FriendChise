---
title: Tools
description: Endpoints for built-in tools including item lists, conversions, roster templates, and the scan-to-task AI feature
order: 10
---

FriendChise includes a set of built-in operational tools for franchise teams. These endpoints expose the tool data to authenticated org members.

## Get tools by kind

`GET /api/orgs/[orgId]/task-tools?kind=[conversion|item-list|roster]`

Returns all tools of a given kind for the organization.

### Authentication

Requires org membership.

### Query parameters

| Param | Type | Required | Values | Description |
| --- | --- | --- | --- | --- |
| `kind` | string | Yes | `conversion`, `item-list`, `roster` | Type of tool to return |

### Response

```json
{
  "items": [ ... ]
}
```

The shape of each item in `items` depends on `kind`:

- `conversion` — unit conversion sets (e.g. weight, volume, temperature)
- `item-list` — named item lists for inventory, prep, or ordering
- `roster` — roster templates for scheduling

### Errors

| Status | Reason |
| --- | --- |
| `400` | `kind` is missing or not one of the allowed values |
| `401` | Not authenticated |
| `403` | Not a member of the org |

---

## List tool items (item list — paginated)

`GET /api/orgs/[orgId]/tools/item-list`

Returns a paginated list of items from the organization's item-list tool. Includes signed image URLs for items that have images.

### Authentication

Requires org membership.

### Query parameters

| Param | Type | Default | Max | Description |
| --- | --- | --- | --- | --- |
| `page` | integer | `1` | — | Page number |
| `limit` | integer | `24` | `100` | Items per page |
| `search` | string | — | — | Filter by item name or unit |

### Response

```json
{
  "items": [
    {
      "id": "item_01abc",
      "name": "Bread Flour",
      "unit": "kg",
      "imgUrl": "orgs/org_01abc/tools/item_01abc.jpg",
      "imageSignedUrl": "https://supabase.co/..."
    }
  ],
  "totalCount": 18,
  "totalPages": 1,
  "page": 1,
  "pageSize": 24,
  "search": ""
}
```

`imageSignedUrl` is `null` if the item has no image.

---

## Get scan-to-task history

`GET /api/orgs/[orgId]/tools/scan-to-task/history`

Returns a cursor-paginated list of previous scan-to-task results for the organization, including drafted tasks and potential duplicates.

The scan-to-task feature processes an uploaded document or photo with an AI model and extracts a draft task (title, description, steps). This endpoint returns the results of past scans.

### Authentication

Requires `MANAGE_TASKS` permission in the org.

### Query parameters

| Param | Type | Default | Max | Description |
| --- | --- | --- | --- | --- |
| `cursor` | string | — | — | ID of the last result from the previous page |
| `limit` | integer | `25` | `50` | Results per page |

### Response

```json
{
  "results": [
    {
      "id": "scan_01abc",
      "batchId": "batch_01abc",
      "fileName": "recipe-card.jpg",
      "fileKind": "image",
      "fileSize": 204800,
      "draft": {
        "title": "Vanilla Custard Filling",
        "description": "Whisk egg yolks and sugar...",
        "sourceText": "From the original recipe card."
      },
      "error": null,
      "taskId": null,
      "createdAt": "2026-08-15T14:30:00.000Z",
      "updatedAt": "2026-08-15T14:30:01.000Z",
      "duplicateCandidates": [
        {
          "taskId": "tsk_existing",
          "title": "Custard Filling",
          "score": 0.89
        }
      ]
    }
  ],
  "nextCursor": "scan_last_id"
}
```

| Field | Description |
| --- | --- |
| `draft` | Extracted task draft from the AI model, or `null` if extraction failed |
| `error` | Error message if processing failed, or `null` |
| `taskId` | ID of the task created from this result, or `null` if not yet converted |
| `duplicateCandidates` | Up to 3 existing tasks in the org that may overlap with this draft (similarity score 0–1) |
| `nextCursor` | Use as `cursor` on the next request; `null` when no more results |

### Errors

| Status | Reason |
| --- | --- |
| `400` | Invalid `cursor` value (does not match a scan result in this org) |
| `401` | Not authenticated |
| `403` | User lacks `MANAGE_TASKS` permission |
| `500` | Unexpected server error |

---

## Menu items (public)

`GET /api/menu/[token]/items`

Returns the items on a publicly shared menu. This endpoint does not require authentication — it is accessible to anyone with a valid menu token.

### Path parameters

| Param | Description |
| --- | --- |
| `token` | Public share token for the menu |

### Response

Paginated list of menu items with signed image URLs.

```json
{
  "items": [
    {
      "id": "item_01abc",
      "name": "Original Glazed",
      "description": "Classic yeast doughnut with vanilla glaze.",
      "imageSignedUrl": "https://..."
    }
  ],
  "totalCount": 12
}
```

### Errors

| Status | Reason |
| --- | --- |
| `404` | Token does not match any active menu |

---

## AI Scan to Task

The scan-to-task workflow is now available through mobile-facing REST endpoints:

- `POST /api/orgs/[orgId]/tools/scan-to-task/upload-url` — `MANAGE_TASKS`, accepts `{ fileName, mimeType }`, returns `{ signedUrl, path }`, and reports `400`, `403`, or `500` when signing fails.
- `POST /api/orgs/[orgId]/tools/scan-to-task` — `MANAGE_TASKS`, accepts `{ sources, instruction? }`, returns `{ results }`, and reports `400`, `429`, or `500` on scan failure. Demo-limit responses return `{ "error": "Sign up to continue using this feature." }`.
- `POST /api/orgs/[orgId]/tools/scan-to-task/confirm` — `MANAGE_TASKS`, accepts a reviewed draft payload and returns `{ taskId, resultId }`.
- `POST /api/orgs/[orgId]/tools/scan-to-task/confirm` — `MANAGE_TASKS`, accepts `{ resultId, fileName, title, description, summary, durationMin, peopleRequired, minWaitDays, maxWaitDays }` with optional `color` and `sourceText`, returns `{ taskId, resultId }` on `200`, and can return `400`, `403`, `409`, or `500`.
- `POST /api/orgs/[orgId]/tools/scan-to-task/clear` — `MANAGE_TASKS`, accepts `{ resultId }`, returns `{ ok: true }` on `200`, and can return `400`, `403`, `404`, or `500`.

See [scan-to-task history](#get-scan-to-task-history) for the results endpoint that is already available.
