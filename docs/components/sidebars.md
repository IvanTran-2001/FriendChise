---
title: Sidebars
description: Context-driven page sidebar and action sidebar patterns
order: 11.7
---

The sidebar system is one of the most important app patterns. It is split into two layers on purpose so navigation and editing do not fight each other.

## Page sidebar

- `PageSidebarContext` stores a `ReactNode` for the current page sidebar, plus its title, sub-content, and collapsed state.
- Pages register sidebar content through `RegisterPageSidebar` or `RegisterPageSidebarSubContent` instead of passing props through every layout.
- This sidebar is for persistent navigation, filtering, and view controls.
- It is not where the main mutation form should live.
- The shell stays mounted while only the inner content changes, which avoids flicker during navigation.
- On desktop it can collapse into a narrow slot; on mobile it becomes a fixed overlay.

## Action sidebar

- `ActionSidebarContext` stores a single active panel with a title and content.
- Any client component can open it through `useActionSidebar().open(...)`.
- It is used for create, edit, and detail flows that should feel focused but stay inside the page.
- This sidebar is for changing data or working through a task, not for primary navigation.
- On desktop it renders inline beside the page sidebar; on mobile it becomes a bottom sheet.

## Why both exist

- `PageSidebar` is for persistent navigation, filters, and view state.
- `ActionSidebar` is for temporary tasks, focused forms, and data changes.
- Splitting them keeps the app from turning every sidebar action into a full route change.

## Shared nav items

- `SidebarNavItem` is the base nav row used by both app and page sidebars.
- It has two variants: `app` for the compact global sidebar and `page` for wider page sidebars.
- `PageSidebarNavItem` is just a convenience wrapper for the page variant.

## Mobile behavior

- The global sidebar uses a mobile context so the hamburger button can open and close it.
- The page sidebar and action sidebar both switch to mobile-friendly overlays instead of shrinking into unusable columns.
- That keeps the same structure on small screens without forcing tiny click targets.

## Mental model

- `PageSidebar` helps you move around or change how you are looking at a page.
- `ActionSidebar` helps you do the actual work.
- If the panel changes the page's state or filters, it probably belongs in `PageSidebar`.
- If the panel creates, edits, or inspects a specific thing, it probably belongs in `ActionSidebar`.
