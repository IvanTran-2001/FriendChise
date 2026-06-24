---
title: Layout Shells
description: Navbar, app sidebar, and toolbar behavior
order: 11.6
---

These are the shells that define the app chrome. They are the reason the app feels consistent across pages.

## Navbar

- `NavBar` is a server component so it can fetch session data, organizations, invites, notifications, and admin access in one pass.
- It is the top row of the app and carries the mobile menu trigger, logo, org switcher, feedback, notifications, and user menu.
- It stays fresh on every render instead of waiting for client polling.

## App sidebar

- `AppSidebar` is the global left navigation.
- On desktop it is a compact fixed strip so the app stays narrow and predictable.
- On mobile it turns into a full overlay opened by the navbar hamburger button.
- It reads the current org and route, then fetches parent-owner status so franchisor-only links can appear when they should.

## Toolbar

- `Toolbar` is the thin action bar above page content.
- It uses context so pages can register toolbar content without wiring props through every layout.
- Its height snaps to the shared 48px grid so the page chrome stays aligned.

## Scroll containment

- `SidebarProvider` uses `h-dvh` and `SidebarInset` uses `overflow-hidden` so the shell stays visually fixed.
- `<main>` is the actual scroll container.
- Pages that need a pinned toolbar use `flex flex-col h-full` on the root and `flex-1 overflow-auto` for the scrollable content.
- Negative horizontal margins on the scrollable area cancel the main padding so lists can run edge-to-edge.

## Why these shells exist

- They keep the top-level layout stable while pages change underneath.
- They reduce duplication by centralizing shared nav, org switching, and page action placement.
- They make the mobile and desktop experience feel like the same app, not two separate UIs.
