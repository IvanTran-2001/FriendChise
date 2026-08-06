# Scan to Task Instructions

Use these rules when working on the scan-to-task feature, including its client coordinator, sidebar content, inspector, results queue, history, merge flow, and server actions.

## Feature Boundaries

- Treat `app/(app)/orgs/[orgId]/tools/scan-to-task/scan-to-task-client.tsx` as the central orchestrator for the feature.
- Keep page files responsible for server-side work and data loading.
- Keep client files focused on orchestration, state, and UI wiring.
- Keep sidebar content files simple: compose sections, wire props, and delegate complex behavior into smaller components.
- Split new actions or modes into dedicated functions, helpers, or panel components instead of growing one large handler.

## Core State Semantics

- A scan result should have one clear lifecycle path: draft, confirmed, cleared, merged, or deleted.
- Use `confirmedAt` when a result has been accepted into a task.
- Use `clearedAt` when a result should disappear from active queue/history views.
- If a result is merged or deleted, make sure the result is pruned from the visible queue and from any merged-source metadata that would keep it alive incorrectly.
- If an inspector action is meant to save details, label it as save rather than task-specific wording when the target may be either a draft or a task.

## Queue and Inspector Rules

- The queue should stay readable and should hide items that are no longer actionable.
- The inspector should remain a simple save/delete style control surface.
- Avoid mixing accept, inspect, delete, and merge behaviors into one ambiguous control.
- If a row has nested source data, forward the child-specific handlers to the nested tree so the clicked child is the thing being acted on.
- When a user accepts something from a queue or merge source, make sure the correct item id is passed through the full flow.

## Conflict and Merge Rules

- Treat draft conflicts individually; do not flatten them into one generic list if they represent separate decisions.
- Conflict flows should allow instructions when merging, so the user can direct how the final task should be shaped.
- Merge-source trees should be recursive and should preserve child context.
- If a task source is already represented in the merge metadata, keep the displayed source trail accurate after save, merge, or delete actions.
- When comparing a draft against task duplicates, include cleared draft records only when the feature explicitly wants historical comparison.

## Naming and Mapping Rules

- Keep canonical file and component names documented when the feature uses shorthand or aliases.
- If a component has a repo-specific nickname, map it back to the actual component name before reasoning about it.
- Treat these names as equivalent when used in instructions:
  - `app/(app)/orgs/[orgId]/tools/scan-to-task/scan-to-task-client.tsx` = `scan-to-task-client` = feature orchestrator
  - `app/(app)/orgs/[orgId]/tools/scan-to-task/_components/s2t-inspector-panel.tsx` = `inspector` = draft/detail edit panel
  - `app/(app)/orgs/[orgId]/tools/scan-to-task/_components/s2t-results-section.tsx` = `results section` = queue and history surface
  - `app/(app)/orgs/[orgId]/tools/scan-to-task/_components/s2t-conflict-list.tsx` = `conflict list` = conflict grouping and decision surface
  - `app/(app)/orgs/[orgId]/tools/scan-to-task/_components/s2t-merge-source-tree.tsx` = `merge-source tree` = recursive nested source view
  - `app/(app)/orgs/[orgId]/tools/scan-to-task/_components/s2t-conflict-actions-panel.tsx` = `action-sidebar-content` = action sidebar orchestrator
  - `app/(app)/orgs/[orgId]/tools/scan-to-task/_components/s2t-upload-section.tsx` = upload section
  - `app/(app)/orgs/[orgId]/tools/scan-to-task/_components/s2t-history-pagination.ts` = history pagination

## Validation Expectations

- Validate the most specific touched file or action first.
- If a server action changes, run the matching action or service tests before broader suites.
- If a UI orchestrator changes, validate the smallest relevant slice of the feature before broader checks.
- If a change affects both state and rendering, validate the state transition first and the UI wiring second.

## Example Behavior

Good:

```text
Update the scan-to-task client by splitting the new merge action into its own function, then validate the task and history paths separately.
```

Good:

```text
If a nested merge source is acting on the parent row, forward the child id through the recursive tree instead of reusing the row wrapper.
```

Good:

```text
When the queue item is accepted, clear the source result so it disappears from the active list and history behaves consistently.
```

Bad:

```text
Put every scan-to-task behavior into one giant client file.
```

Bad:

```text
Use a vague label when the action is really a save or delete operation.
```
