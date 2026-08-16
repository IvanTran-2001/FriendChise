---
title: Tasks
description: API reference for creating, reading, and updating tasks (recipes, procedures, checklists)
order: 7
---

Tasks are the core unit in FriendChise. A task can represent a recipe, a preparation procedure, a daily checklist item, or any operational step a franchise team needs to track.

All task endpoints are scoped to an organization (`orgId`).

## Create task

`POST /api/orgs/[orgId]/tasks`

Creates a new task in the organization.

### Authentication

Requires `MANAGE_TASKS` permission in the org.

### Path parameters

| Param | Description |
| --- | --- |
| `orgId` | Organization ID |

### Request body

Accepts JSON or FormData.

| Field | Type | Required | Constraints | Description |
| --- | --- | --- | --- | --- |
| `title` | string | Yes | 1–200 characters | Task name. Must be unique within the org after trimming leading/trailing whitespace and lowercasing (`lower(btrim(name))`). |
| `color` | string | No | Hex color `#rrggbb` | Display color. Defaults to `#6366f1`. |
| `description` | string | No | Max 5000 characters | Recipe notes, steps, or procedure details. |
| `durationMin` | integer | Yes | 1–1440 (24 hours) | Estimated time to complete, in minutes. |
| `preferredStartTimeMin` | integer | No | 0–1439 | Preferred start time as minutes since midnight. |
| `peopleRequired` | integer | No | 1–50 | Number of people needed. Defaults to `1`. |
| `minWaitDays` | integer | No¹ | 0–3650 | Minimum days before the task can repeat. |
| `maxWaitDays` | integer | No¹ | 0–3650 | Maximum days before the task should repeat. |
| `imageStoragePath` | string | No | Max 2048 characters | Storage path for a task image (obtained from the image upload endpoint). |
| `roleIds` | string[] | No | — | IDs of roles that can be assigned this task. All IDs must belong to the org. |

¹ At least one of `minWaitDays` or `maxWaitDays` must be provided. If both are provided, `minWaitDays` must not exceed `maxWaitDays`.

### Example request

```json
{
  "title": "Prepare doughnut glaze",
  "color": "#f59e0b",
  "description": "Mix icing sugar, whole milk, and vanilla extract until smooth. Consistency should coat the back of a spoon.",
  "durationMin": 10,
  "preferredStartTimeMin": 360,
  "peopleRequired": 1,
  "minWaitDays": 0,
  "maxWaitDays": 1
}
```

### Example response

```json
{ "taskId": "tsk_01abc" }
```

HTTP status: `201 Created`

### Errors

| Status | Reason |
| --- | --- |
| `400` | Validation error (see `errors` field for per-field details) |
| `400` | Invalid role IDs — one or more `roleIds` do not belong to the org |
| `401` | Not authenticated |
| `403` | User lacks `MANAGE_TASKS` permission |
| `409` | A task with this title already exists in the org after trimming leading/trailing whitespace and lowercasing |
| `429` | Demo account task limit reached |
| `500` | Unexpected server error |

---

## Get task

`GET /api/orgs/[orgId]/tasks/[taskId]`

Returns a single task by ID.

### Authentication

Requires org membership.

### Path parameters

| Param | Description |
| --- | --- |
| `orgId` | Organization ID |
| `taskId` | Task ID |

### Response

```json
{
  "task": {
    "id": "tsk_01abc",
    "name": "Prepare doughnut glaze",
    "color": "#f59e0b",
    "description": "Mix icing sugar...",
    "durationMin": 10,
    "preferredStartTimeMin": 360,
    "peopleRequired": 1,
    "minWaitDays": 0,
    "maxWaitDays": 1,
    "imageUrl": "orgs/abc/tasks/xyz/photo.jpg",
    "imageSignedUrl": "https://...",
    "isOwner": true
  }
}
```

`imageSignedUrl` is a short-lived signed URL for the task image, or `null` if no image is set. `isOwner` is `true` if the task belongs directly to this org (vs. inherited from a parent franchise org).

`imageUrl` is the stored path for the image, not a browser-accessible URL. `imageSignedUrl` is the derived short-lived URL used by clients to display that stored image.

### Errors

| Status | Reason |
| --- | --- |
| `401` | Not authenticated |
| `403` | Not a member of the org |
| `404` | Task not found or not accessible from this org |

---

## Update task

`PATCH /api/orgs/[orgId]/tasks/[taskId]`

Partially updates a task. Only the fields you include are changed.

### Authentication

Requires org membership and authorization in the task-owning organization. The caller must either be the parent organization owner or have `MANAGE_TASKS` in the task-owning org; a plain membership is not sufficient.
| `mode` | `list` \| `available` \| `shared` | `shared` | Task view mode |
| `limit` | integer | 30 | Items per page |

### Path parameters

| Param | Description |
| --- | --- |
| `orgId` | Organization ID |
| `taskId` | Task ID |

### Request body

All fields are optional. At least one field must be included.

| Field | Type | Constraints | Description |
| --- | --- | --- | --- |
| `title` | string | 1–200 characters | New task name. Must remain unique within the org after trimming leading/trailing whitespace and lowercasing (`lower(btrim(name))`). |
| `color` | string | Hex color `#rrggbb` | New display color |
| `description` | string \| null | Max 5000 characters, or `null` to clear | Updated notes or procedure |
| `durationMin` | integer | 1–1440 | New duration in minutes |
| `preferredStartTimeMin` | integer \| null | 0–1439, or `null` to clear | New preferred start time |
| `peopleRequired` | integer | 1–50 | New people count |
| `minWaitDays` | integer \| null | 0–3650, or `null` to clear | New minimum repeat interval |
| `maxWaitDays` | integer \| null | 0–3650, or `null` to clear | New maximum repeat interval |
| `tagIds` | string[] | — | Replace all tags on the task |
| `roleIds` | string[] | — | Replace all role eligibilities |
| `toolPaths` | string[] | — | Replace linked tool paths; must be sent with `toolLabels` |
| `toolLabels` | (string \| null)[] | Same length as `toolPaths` | Display labels for linked tools |
| `imageStoragePath` | string | Non-empty, max 2048 characters | New image storage path |

### Response

```json
{ "ok": true }
```

### Errors

| Status | Reason |
| --- | --- |
| `400` | No fields provided, or validation failure |
| `400` | `toolLabels` provided without `toolPaths` |
| `401` | Not authenticated |
| `403` | Not a member, or task is outside this franchise scope |
| `404` | Task not found |
| `409` | The updated title collides with another task in the org after trimming leading/trailing whitespace and lowercasing |

---

## List tasks (paginated — cursor-based)

`GET /api/orgs/[orgId]/tasks/paginated`

Fetches tasks in pages using cursor-based pagination. Used by the task table for infinite scroll.

### Authentication

Requires org membership.

### Query parameters

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| `mode` | `list` \| `available` \| `shared` | `shared` | Task view mode |
| `cursor` | string | — | ID of the last item from the previous page |
| `limit` | integer | 30 | Items per page |
| `sort` | string | `name-asc` | Accepted values: `name-asc`, `name-desc`, `duration-asc`, `duration-desc`, `people-asc`, `people-desc`. Invalid values fall back to `name-asc`. |
| `roleId` | string | — | Filter to tasks eligible for a specific role |
| `tagId` | string | — | Filter to tasks with a specific tag |
| `search` | string | — | Text search across task names |

### Response

```json
{
  "tasks": [ { "id": "...", "name": "...", "imageSignedUrl": null, ... } ],
  "nextCursor": "tsk_last_id_on_page"
}
```

`nextCursor` is `null` when there are no more pages.

---

## List tasks (simple)

`GET /api/orgs/[orgId]/tasks/simple`

Returns a lightweight, unpaginated list of tasks for use in pickers and dropdowns. Does not include image URLs or full field sets.

### Authentication

Requires org membership.

### Response

```json
{
  "tasks": [
    { "id": "tsk_01abc", "name": "Prepare doughnut glaze" }
  ]
}
```
