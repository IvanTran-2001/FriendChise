---
title: Services and Actions
description: Why FriendChise splits business logic from server-action boundaries
order: 10.7
---

FriendChise splits write flows into two layers on purpose.

## Services

- `lib/services/*` is the reusable domain layer.
- Services hold business rules, database work, transactions, inheritance logic, and audit logging.
- Services should not know about forms, redirects, `revalidatePath`, or request-specific UI state.
- They are the right place for logic that should be shared across server actions, tests, or other services.

## Actions

- `app/actions/*` is the request boundary between the UI and the service layer.
- Actions authenticate the caller, check permissions, validate raw input, and normalize browser payloads like `FormData`.
- Actions also handle request-specific behavior such as demo limits, storage upload URLs, `revalidatePath`, and redirects.
- If the operation is only about a UI flow or a storage workflow, it can live in actions without needing a separate service.

## Why both exist

- Services keep the actual business rules isolated and testable.
- Actions keep auth, input parsing, and page refresh behavior close to the UI.
- That split keeps domain code reusable and stops server-action concerns from leaking into the rest of the app.

## Rule of thumb

- Put "what should happen" in a service.
- Put "who is allowed to do it" and "what does the UI need next" in an action.

## Examples

- `createTaskAction` parses `FormData`, validates it, checks permissions, then calls `createTask`.
- `createOrg` action authenticates, validates the payload, then calls the org service.
- Storage actions handle signed URLs and file paths because those are request-bound workflows.
