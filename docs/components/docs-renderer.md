---
title: Docs Renderer
description: How the docs page turns markdown into a navigable layout
order: 11.8
---

The docs section has its own component system because it combines markdown, navigation, and reading aids.

## Main pieces

- `DocNavbar` keeps the docs shell consistent with the rest of the site.
- `DocSidebarTree` renders the searchable navigation tree on the left.
- `DocRightToc` renders the heading list on the right.
- `DocCodeBlock` wraps fenced code blocks and adds the hover copy button.

## How it works

- The page reads markdown, extracts headings, and renders everything through `ReactMarkdown`.
- Fenced blocks are turned into a block wrapper with a copy overlay.
- Inline code stays inline, so code snippets still read naturally inside prose.
- The right TOC is built from headings and scrolls to the matching section.

## Navigation behavior

- Clicking a docs link uses Next.js client-side navigation, so the browser does not do a full page refresh.
- The middle article changes for the new route, while the left docs tree stays in the shared docs shell.
- `DocSidebarTree` scrolls the active tree item into view on route change, while `DocSidebarScrollFrame` is merely a wrapper component.
- That keeps the left sidebar from jumping back to the top while still showing the current page in context.

## Why it is structured this way

- It lets the docs stay readable without manually building every page in JSX.
- The sidebar tree and TOC give the reader a way to jump around long pages.
- The copy overlay keeps code-heavy docs practical on desktop and mobile.
