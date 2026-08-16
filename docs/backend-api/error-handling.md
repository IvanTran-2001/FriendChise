| `429` — Surface the limit to the user. Demo account quota limits are not retryable. Demo-session concurrency caps can be retried after an existing session expires.
---
title: Error Handling
description: HTTP status codes, error response shape, and common errors across all API routes
order: 3
---

## Error response shape

All error responses return JSON with an `error` string:

```json
{
  "error": "Descriptive error message."
}
```

Field-level validation errors include an `errors` map alongside `error`:

```json
{
  "error": "Invalid task data",
  "errors": {
    "title": ["String must contain at least 1 character(s)"],
    "durationMin": ["Number must be greater than 0"]
  }
}
```

Successful responses do not include an `error` field.

## HTTP status codes

| Status | Meaning | When you'll see it |
| --- | --- | --- |
| `200 OK` | Request succeeded | Most GET and some POST requests |
| `201 Created` | Resource was created | Task creation (`POST /api/orgs/[orgId]/tasks`) |
| `400 Bad Request` | Missing or invalid input | Validation failures, malformed body, invalid query params |
| `401 Unauthorized` | Authentication required | No session, expired or missing bearer token |
| `403 Forbidden` | Authenticated but not permitted | Insufficient org role, wrong franchise scope |
| `404 Not Found` | Resource does not exist | Task, org, image, or user not found |
| `409 Conflict` | Duplicate resource | Task with the same name already exists in the org |
| `429 Too Many Requests` | Rate/demo limit hit | Demo account task limit reached |
| `500 Internal Server Error` | Unexpected server failure | Database error, storage error, or unhandled exception |

## Common error messages

| Message | Status | Explanation |
| --- | --- | --- |
| `"Unauthorized"` | 401 | Bearer token missing, expired, or invalid |
| `"Forbidden"` | 403 | User lacks the required org permission |
| `"User not found"` | 404 | Authenticated user ID has no database record |
| `"Organization not found"` | 404 | `orgId` path param does not match any org |
| `"Task not found"` | 404 | `taskId` does not exist or is not accessible |
| `"A task named "..." already exists."` | 409 | Title collision within the org |
| `"Confirmation text is required"` | 400 | Account delete request missing `confirmText` |
| `"Confirmation text does not match"` | 400 | `confirmText` does not match the user's display name when available, otherwise their email |
| `"Invalid kind"` | 400 | `kind` query param not one of `conversion`, `item-list`, `roster` |
| `"mimeType is required."` | 400 | Image upload-url request missing `mimeType` body field |
| `"storagePath is required."` | 400 | Storage read-url request missing `storagePath` body field |
| `"Failed to create task."` | 500 | Unexpected error during task creation |
| `"Failed to load scan history."` | 500 | Unexpected error loading scan-to-task results |

## Authentication errors

Unauthenticated requests to protected routes return:

```json
{ "error": "Unauthorized" }
```

with status `401`. A few routes (for example `GET /api/me/organizations`) return an empty result set instead of a `401` when no session is present.

## Validation errors

Routes that use Zod validation return the flattened field errors under `errors`:

```json
{
  "error": "Invalid task data",
  "errors": {
    "title": ["Required"],
    "durationMin": ["Number must be positive"]
  }
}
```

Each key in `errors` is a field name; each value is an array of one or more error strings.

## Retrying after errors

- `400` — Fix the request body or query params. Do not retry without changing the input.
- `401` — Re-authenticate and retry with a fresh token.
- `403` — The user does not have the required role in that org. Do not retry.
- `404` — The resource does not exist. Do not retry without first confirming the resource exists.
- `409` — Choose a different name and retry, or surface the conflict to the user.
- `429` — Surface the limit to the user. Demo limits are not per-time-window and cannot be retried.
- `500` — Retry only idempotent reads by default. For writes, use idempotency keys when the route supports them, or reconcile the resource state before retrying a non-idempotent `POST`, `PATCH`, or `DELETE`.
