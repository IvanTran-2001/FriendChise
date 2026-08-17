---
title: Using the Docs
description: How to navigate and write FriendChise docs pages
order: 2
---

This page is for contributors and developers who want a quick reference for writing FriendChise docs.

## Markdown basics

- Put YAML frontmatter at the top of the file, wrapped in `---` lines.
- Use `title`, `description`, and `order` there.
- `##` headings become the main entries in the right content sidebar.
- `###` headings nest under their parent heading.

```md
---
title: Using the Docs
description: How to navigate and write FriendChise docs pages
order: 2
---
```

## Folders

- Folders are categories in the left docs tree.
- A folder can exist without `index.md`; then it is just a dropdown group built from child pages.
- Adding `index.md` creates the folder node.
- If `index.md` has body content or `title` / `description` frontmatter, it becomes clickable.
- If `index.md` only has `order`, it still affects ordering but is not clickable.
- Folder title and description come from `index.md` frontmatter when present; otherwise they fall back to the folder name and a default description.
- Folder order comes from `index.md` when present; otherwise it uses the lowest order from child pages or nested folders.
- If nothing in the folder has an order, the folder falls back to name order.

```txt
docs/
	overview/
		index.md
		using-the-docs.md
	backend-api/
		index.md
		api.md
		operations.md
```

- Child pages are ordered inside that folder by their own `order` first, then by title.

## Code blocks

- Use fenced code blocks for commands, code, config, and anything readers should copy and paste.
- Anything wrapped in triple backticks gets the copy button automatically.
- Use inline code for short names like component names, file names, or env vars.

## Where content goes

Each top-level folder in `docs/` is one section in the left nav: [Overview](/doc/overview), [Getting Started](/doc/getting-started), [Mobile App](/doc/mobile-app), [Backend/API](/doc/backend-api), [Authentication](/doc/authentication), [Features](/doc/features), [Task System](/doc/task-system), [Deployment](/doc/deployment), [Environment Variables](/doc/environment-variables), [App Store Review Notes](/doc/app-store-review), [Roadmap](/doc/roadmap), [Contributing](/doc/contributing), and [Troubleshooting](/doc/troubleshooting).

- Overview pages are for reader-facing explanations of what FriendChise is and who it's for.
- Getting Started pages are for setting up locally and getting oriented in the codebase.
- Backend/API and Authentication pages are for server-side implementation details, including the database schema.
- Features and Task System pages are for product-facing capabilities and how they're built.
- Contributing pages are for contributor workflow and internal architecture notes.
- If a page doesn't clearly fit an existing section, mark unclear or missing details with a `## TODO` list at the bottom rather than guessing.

## Rule of thumb

- Keep it short.
- Use headings that read cleanly in the sidebar.
- Write enough for another developer to understand the pattern without dumping source code.
