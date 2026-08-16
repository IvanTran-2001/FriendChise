---
title: Documentation Site
description: How the /doc route turns markdown into the navigable, searchable docs site
order: 3
---

The docs section (`/doc/*`) is its own small system: a markdown content tree, a nav-tree builder, and a set of client components for search, navigation, and reading aids.

## Content layer

- Content lives as markdown files under `docs/` at the repo root, one folder per top-level section (`overview/`, `getting-started/`, `mobile-app/`, `backend-api/`, `authentication/`, `features/`, `task-system/`, `deployment/`, `environment-variables/`, `app-store-review/`, `roadmap/`, `contributing/`, `troubleshooting/`).
- `lib/docs/index.ts` reads every `.md` file, parses YAML frontmatter (`title`, `description`, `order`), derives a route slug from the file path, and extracts a search string (title + description + body).
- `folder/index.md` becomes that folder's section landing page and gives the folder its nav title/description/order; other files in the folder become child pages.
- `order` controls sibling sort order (folders and pages alike) — see [Using the Docs](/doc/overview/using-the-docs) for the frontmatter contract contributors should follow when adding pages.

## Route

- `app/doc/[...slug]/page.tsx` resolves the slug to a doc via `getDocBySlug`/`getDocMarkdown`, renders it with `react-markdown` + `remark-gfm`, and builds the right-hand table of contents from `##`/`###` headings.
- `app/doc/page.tsx` and `app/docs/page.tsx` both redirect to `/doc/overview`.

## Components

- `DocNavbar` — server component; fetches the nav tree once and renders the docs header, the mobile nav drawer trigger, and the search trigger.
- `DocSidebarTree` — the left navigation tree (desktop sidebar and inside the mobile drawer). Expands/collapses folders, auto-opens the path to the active page, and includes an inline search box.
- `DocSearchDialog` — a `⌘K`/`Ctrl+K` (or `/`) command-palette style dialog for searching from anywhere on the docs site, built on the shared `Dialog` primitive.
- `DocRightToc` — the "on this page" heading list, driven by `extractDocHeadings`.
- `DocSidebarScrollFrame` — a thin scroll-container wrapper for the desktop sidebar.
- `DocCodeBlock` — wraps fenced code blocks with a hover copy-to-clipboard button.

## Search

- `lib/docs/search.ts` holds the ranked, partial-match search logic (`searchDocs`, `scoreResult`, `flattenSearchResults`) shared by both the sidebar's inline search and the `DocSearchDialog` command palette — this is intentional so scoring behavior can't drift between the two entry points.
- Matching is substring-based across title, description, breadcrumbs, and full page body text, ranked so exact/prefix title matches outrank body-text matches.

## Navigation and responsiveness

- Desktop (`lg` and up): sidebar, article, and (on `xl` and up) a right-hand TOC render as a three-column grid.
- Mobile/tablet: the sidebar is hidden and replaced by the drawer opened from the navbar's menu button, so navigation never crowds the article content.
- The active page is tracked via `activeSlug`, which highlights the current entry in both the sidebar tree and the search results list, and keeps the sidebar auto-scrolled to the active item.

## Adding a page

1. Add a `.md` file under the right section folder in `docs/` (or a new `index.md` for a new section).
2. Set `title`, `description`, and `order` in frontmatter.
3. Link to it from the section's `index.md` "Pages" list and from any other page that should cross-reference it.
4. If it's a brand-new top-level section, give its `index.md` an `order` that reflects where it should sit in the top nav.
