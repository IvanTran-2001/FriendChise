---
title: Components
description: High-level design of the shared layout and component systems
order: 11.5
---

This section is for developers. It explains the shared component patterns that shape the app instead of listing every small UI primitive.

## Pages

- [Layout Shells](/doc/components/layout-shells)
- [Sidebars](/doc/components/sidebars)
- [Docs Renderer](/doc/components/docs-renderer)

## What belongs here

- Shared shells that define the app chrome.
- Context-driven layout systems like page sidebars, action sidebars, and toolbars.
- Docs-specific rendering pieces like the sidebar tree, right TOC, and code block overlay.

## What does not belong here

- Tiny generic primitives such as `Button`, `Input`, or `Dialog` unless they have app-specific behavior.
- One-off route-only pieces that are easier to understand from the route docs themselves.

## Notes

- If a component is mostly a wrapper around another pattern, document the pattern instead of the wrapper.
- If a component is only a single-purpose primitive, the code is usually enough.