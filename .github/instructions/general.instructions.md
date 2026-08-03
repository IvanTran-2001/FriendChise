# General Instructions

Use these rules for any change in this repository.

## Work Style

- Make the smallest change that solves the problem.
- Prefer fixing the root cause over applying a surface-level patch.
- Do not change unrelated code just because it looks messy.
- Keep public behavior stable unless the request explicitly changes it.
- Preserve existing naming, structure, and patterns unless there is a clear reason to improve them.
- If a workflow, command, or architectural rule keeps coming up, add it to an instruction file so the behavior stays consistent.
- Update instruction files when a pattern becomes reusable, error-prone, or complicated enough to matter again.
- If a task-specific behavior changes, update the matching task-specific instruction file and the index together.

## File Responsibilities

- Keep server-side work in page, route, server action, or service files.
- Keep client files focused on orchestration, state, and UI wiring.
- Treat the client file as the central control point for the feature, but keep it abstract and easy to read.
- If a new interaction or action appears, split it into its own function or section instead of expanding one large handler.
- Group related client logic by purpose so future changes are easy to trace.
- Avoid mixing server data access, mutation logic, and UI state in the same client block.
- Treat `page-sidebar-content`, `action-sidebar-content`, and similar `*-sidebar-content` files as client-side orchestrators.
- Those files should stay simple: wire props, compose sections, and delegate complex behavior into smaller panel or section components.
- Keep sidebar content readable enough that the file shows the feature flow at a glance.
- If a sidebar needs a new action or panel, split the work into a dedicated component or section instead of bloating the container file.

## Before Editing

- Start from the most relevant file, symbol, failing test, or user-facing behavior.
- Read only enough surrounding code to understand the local flow.
- Form one clear, testable hypothesis before making the first edit.
- If the task touches multiple files, edit only the files that participate directly in the behavior.

## Validation

- After making a change, run the narrowest useful validation first.
- Prefer file-level or feature-level checks before broad test suites.
- If a validation fails, fix that same slice before widening scope.
- Do not report a fix as complete unless the touched code has been validated.

## Safety

- Do not use destructive git commands.
- Do not revert user changes unless explicitly asked.
- Do not rename or reformat code broadly just to make a diff look cleaner.
- If a change introduces risk to unrelated behavior, stop and call it out.

## Communication

- Be direct and concise.
- State assumptions when they matter.
- Mention any residual risk or unverified behavior at the end of the task.

## Example Behavior

Good:

```text
Fix the duplicate-name check in the task creation path, validate the affected action test, and leave unrelated task logic untouched.
```

Bad:

```text
Refactor the whole task service while trying to fix one validation bug.
```

Good:

```text
If a review comment points to a recursive callback bug, patch the exact callback wiring and rerun the smallest relevant test.
```

Bad:

```text
Search the entire repo for similar code and rewrite every instance at once.
```
