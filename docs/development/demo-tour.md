---
title: Demo Tour
description: How to use the FriendChise demo onboarding tour and add or update steps
order: 18.7
---

## What this feature does

The demo tour is the guided onboarding flow for demo users. It highlights live UI, advances through the product, and keeps a compact banner visible while the tour runs.

## What to look for first

- The top-level app shell in `app/(app)/layout.tsx` mounts the demo banner and the tour.
- `components/layout/demo-tour/routes/` contains the actual step copy for each route family.
- `components/layout/demo-tour/components/demo-banner.tsx` is the visible banner shell where the tour controls mount.
- `components/layout/demo-tour/index.tsx` is the runtime that decides which step is active.

## Common tasks

### Add a new step

1. Open the route config under `components/layout/demo-tour/routes/`.
2. Add a new object to the `steps` array.
3. Point `desktopTarget` and, if needed, `mobileTarget` at existing UI targets.
4. Use `forwardAction` or `backAction` when the step should click something or navigate.
5. Use `advanceWhenTargetVisible` when the tour should move forward after a target appears.

### Update target copy

- Keep target names short and stable.
- Prefer names like `workspace`, `topbar`, or `org-selector`.
- If the desktop and mobile layouts differ, give them separate targets.

### Debug a step

- Check that the UI element has the expected `data-tour-target` or `data-demo-tour-target` value.
- Make sure the target is actually visible on the current route before expecting auto-advance.
- If the tour is waiting, look at the step's `advanceWhenTargetVisible` and `retreatWhenTargetNotVisible` settings.

## How to add a new step

1. Pick the route config file under `components/layout/demo-tour/routes/` that matches the page family.
2. Add a step object to the `steps` array.
3. Choose stable target names that already exist in the UI.
4. Add or update the matching `data-tour-target` or `data-demo-tour-target` attributes in the relevant component.
5. If the step should move the user somewhere, use `forwardAction` or `backAction` with `navigate`.
6. If the step should react to UI completion, use `advanceWhenTargetVisible`, `retreatWhenTargetNotVisible`, or `advanceWhenEvent`.

## Target naming

- Use short, stable names like `workspace`, `topbar`, or `org-selector`.
- Prefer names that describe the element, not the copy around it.
- Reuse the same target name on desktop and mobile when the same control should be highlighted.
- Use separate names when desktop and mobile layouts are genuinely different.

## Routing rules

- Add a route config file for the page family.
- Register its pathname in `config.ts`.
- Keep route files small and route-specific.
- Keep the renderer generic unless the behavior itself changes.

## Notes

- Keep the banner high-signal and compact.
- Prefer file-level docstrings over line-by-line comments.
- If a target is not visible yet, the tour should wait rather than forcing the step forward.
- See [Demo Tour Architecture](/doc/architecture/demo-tour) for the implementation model.
