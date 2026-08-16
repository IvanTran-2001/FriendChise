---
title: Frontend Architecture
description: App chrome (navbar, sidebar, toolbar) and the two-layer sidebar pattern
order: 2
---

These are internal notes for contributors changing shared layout. They cover the shells that define the app chrome and the sidebar system built on top of them.

## Layout shells

### Navbar

- `NavBar` is a server component so it can fetch session data, organizations, invites, notifications, and admin access in one pass.
- It is the top row of the app and carries the mobile menu trigger, logo, org switcher, feedback, notifications, and user menu.
- It stays fresh on every render instead of waiting for client polling.

### App sidebar

- `AppSidebar` is the global left navigation.
- On desktop it is a compact fixed strip so the app stays narrow and predictable.
- On mobile it turns into a full overlay opened by the navbar hamburger button.
- It reads the current org and route, then fetches parent-owner status so franchisor-only links can appear when they should.

### Toolbar

- `Toolbar` is the thin action bar above page content.
- It uses context so pages can register toolbar content without wiring props through every layout.
- Its height snaps to the shared 48px grid so the page chrome stays aligned.

### Scroll containment

- `SidebarProvider` uses `h-dvh` and `SidebarInset` uses `overflow-hidden` so the shell stays visually fixed.
- `<main>` is the actual scroll container.
- Pages that need a pinned toolbar use `flex flex-col h-full` on the root and `flex-1 overflow-auto` for the scrollable content.
- Negative horizontal margins on the scrollable area cancel the main padding so lists can run edge-to-edge.

### Why these shells exist

- They keep the top-level layout stable while pages change underneath.
- They reduce duplication by centralizing shared nav, org switching, and page action placement.
- They make the mobile and desktop experience feel like the same app, not two separate UIs.

## Sidebar system

The sidebar system is split into two layers on purpose so navigation and editing do not fight each other.

### Page sidebar

- `PageSidebarContext` stores a `ReactNode` for the current page sidebar, plus its title, sub-content, and collapsed state.
- Pages register sidebar content through `RegisterPageSidebar` or `RegisterPageSidebarSubContent` instead of passing props through every layout.
- It is for persistent navigation, filtering, and view controls — not the main mutation form.
- The shell stays mounted while only the inner content changes, avoiding flicker during navigation.
- Desktop: can collapse into a narrow slot. Mobile: becomes a fixed overlay.

### Action sidebar

- `ActionSidebarContext` stores a single active panel with a title and content.
- Any client component can open it through `useActionSidebar().open(...)`.
- It is used for create/edit/detail flows that should feel focused but stay inside the page — not primary navigation.
- Desktop: renders inline beside the page sidebar. Mobile: becomes a bottom sheet.

### Shared nav items

- `SidebarNavItem` is the base nav row used by both app and page sidebars, with `app` (compact global) and `page` (wider page) variants.
- `PageSidebarNavItem` is a convenience wrapper for the page variant.

### Mental model

- `PageSidebar` helps you move around or change how you are looking at a page.
- `ActionSidebar` helps you do the actual work (create, edit, inspect a specific thing).
- The global sidebar uses a mobile context so the hamburger button can open and close it; page and action sidebars both switch to mobile-friendly overlays instead of shrinking into unusable columns.
