---
title: Demo Tour Architecture
description: How the FriendChise demo onboarding tour is built and how the pieces fit together
order: 16.5
---

This page explains the implementation model behind the demo tour. For step-by-step usage, see [Demo Tour](/doc/development/demo-tour).

## Architecture overview

The demo tour is split between server-mounted chrome and client-side tour logic.

- `app/(app)/layout.tsx` decides whether the current user is in demo mode and mounts the demo UI.
- `components/layout/demo-tour/components/demo-banner.tsx` renders the banner shell and the slot where tour controls appear.
- `components/layout/demo-tour/index.tsx` owns the tour state, step resolution, keyboard shortcuts, and auto-advance behavior.
- `components/layout/demo-tour/components/demo-tour-overlay.tsx` dims the page and keeps the banner bright.
- `components/layout/demo-tour/components/demo-tour-panel.tsx` shows the active step details and direct controls.
- `components/layout/demo-tour/components/demo-tour-launchers.tsx` renders the compact banner controls and fallback launcher UI.
- `components/layout/demo-tour/config.ts` resolves the route-specific step config for the current pathname.
- `components/layout/demo-tour/types.ts` defines the shared step and action contract.

## Runtime flow

1. The app shell checks whether the session is a demo session.
2. If it is, the banner renders first and exposes a slot for tour controls.
3. The tour runner resolves the current pathname to a config.
4. The current step decides whether the panel is visible, which targets are highlighted, and which control buttons are enabled.
5. The tour listens for target visibility changes, custom events, and navigation actions to move between steps.

## Step contract

Each step is a `DemoTourStep` with these fields:

- `title`: label shown in the panel.
- `description`: the instructional text shown in the panel.
- `desktopTarget`: one or more target names to highlight on desktop.
- `mobileTarget`: optional target names for mobile-specific layouts.
- `backAction`: action to run when the user goes backward.
- `forwardAction`: action to run when the user goes forward.
- `advanceWhenTargetVisible`: target name or names that auto-advance the step once visible.
- `retreatWhenTargetNotVisible`: target name or names that move the tour backward if the surface disappears.
- `advanceWhenEvent`: custom event name that advances the tour.

`DemoTourStepAction` supports two action types:

- `click-target`: click an element by its tour target name, optionally waiting for another target to appear.
- `navigate`: push a new route.

## Targeting rules

- Use `data-tour-target` and `data-demo-tour-target` on visible UI surfaces.
- Keep target names stable and semantic.
- Use separate target names when desktop and mobile layouts are structurally different.
- Prefer existing UI surfaces over adding new hidden helpers.

## Behavior notes

- The tour banner is intentionally separate from the panel so the banner can stay visible while the panel moves around it.
- The banner slot is mounted differently on desktop and mobile, so slot selection must match the current layout.
- The overlay excludes the banner area so the demo status remains readable.
- Minimize should hide the panel, not end the tour.

## When to change this layer

Change the architecture only when the behavior needs to move.

- Add a new route config when a new page family needs onboarding.
- Extend the step contract when the tour needs a new kind of action or trigger.
- Touch the overlay or chrome only when banner placement, masking, or panel placement changes.

## References

- [Demo Tour](/doc/development/demo-tour)
- [Project Structure](/doc/architecture/project-structure)