---
title: Demo Tour
description: The guided onboarding tour shown to demo users, and how to add or update steps
order: 10.9
---

The demo tour is the guided onboarding flow for demo users. It highlights live UI, advances through the product, and keeps a compact banner visible while the tour runs.

## Where the pieces live

- `app/(app)/layout.tsx` decides whether the current session is a demo session and mounts the demo UI.
- `components/layout/demo-tour/components/demo-banner.tsx` renders the banner shell and the slot where tour controls mount.
- `components/layout/demo-tour/index.tsx` owns the tour state, step resolution, keyboard shortcuts, and auto-advance behavior.
- `components/layout/demo-tour/components/demo-tour-overlay.tsx` dims the page while keeping the banner bright.
- `components/layout/demo-tour/components/demo-tour-panel.tsx` shows the active step's details and controls.
- `components/layout/demo-tour/components/demo-tour-launchers.tsx` renders the compact banner controls and fallback launcher UI.
- `components/layout/demo-tour/routes/` contains the step copy for each route family.
- `components/layout/demo-tour/config.ts` resolves the route-specific step config for the current pathname.
- `components/layout/demo-tour/types.ts` defines the shared step and action contract.

## Runtime flow

1. The app shell checks whether the session is a demo session.
2. If it is, the banner renders first and exposes a slot for tour controls.
3. The tour runner resolves the current pathname to a config.
4. The current step decides whether the panel is visible, which targets are highlighted, and which control buttons are enabled.
5. The tour listens for target visibility changes, custom events, and navigation actions to move between steps.

## Step contract

Each step is a `DemoTourStep`:

- `title` / `description` — label and instructional text shown in the panel.
- `desktopTarget` / `mobileTarget` — one or more target names to highlight per layout.
- `backAction` / `forwardAction` — a `DemoTourStepAction` to run when the user goes backward or forward.
- `advanceWhenTargetVisible` — target name(s) that auto-advance the step once visible.
- `retreatWhenTargetNotVisible` — target name(s) that move the tour backward if the surface disappears.
- `advanceWhenEvent` — a custom event name that advances the tour.

`DemoTourStepAction` supports two action types: `click-target` (click an element by its tour target name, optionally waiting for another target to appear) and `navigate` (push a new route).

## Common tasks

### Add a new step

1. Open the route config under `components/layout/demo-tour/routes/` that matches the page family.
2. Add a step object to the `steps` array.
3. Point `desktopTarget` and, if needed, `mobileTarget` at existing UI targets.
4. Use `forwardAction`/`backAction` when the step should click something or navigate.
5. Use `advanceWhenTargetVisible` when the tour should move forward after a target appears.

### Update target copy

- Keep target names short, stable, and semantic (`workspace`, `topbar`, `org-selector`).
- Use separate target names when desktop and mobile layouts are structurally different; reuse the same name when the same control should be highlighted on both.

### Debug a step

- Check that the UI element has the expected `data-tour-target` or `data-demo-tour-target` value.
- Make sure the target is actually visible on the current route before expecting auto-advance.
- If the tour is stuck, check the step's `advanceWhenTargetVisible` and `retreatWhenTargetNotVisible` settings.

## Behavior notes

- The banner is intentionally separate from the panel so it can stay visible while the panel moves around it.
- The banner slot is mounted differently on desktop and mobile, so slot selection must match the current layout.
- The overlay excludes the banner area so the demo status remains readable.
- Minimize hides the panel; it does not end the tour.
- If a target is not visible yet, the tour should wait rather than forcing the step forward.

## When to change the architecture vs. a route config

- Add a new route config file when a new page family needs onboarding, and register its pathname in `config.ts`.
- Extend the step contract in `types.ts` only when the tour needs a new kind of action or trigger.
- Touch the overlay or chrome only when banner placement, masking, or panel placement changes.

## References

- [Project Structure](/doc/getting-started/project-structure)
