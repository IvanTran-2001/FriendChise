---

title: README Archive

description: Full historical README snapshot from commit ec0a2b3

order: 18.5

---
## Audit Log

Significant org mutations are recorded in the `AuditLog` table. The service layer writes one row per meaningful event — reads, status-only changes, and low-signal operations are intentionally excluded.

### Service layer

| File                        | Purpose                                                                                                                                                                                |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/services/audit-log.ts` | `recordAudit(params, client?)` — write helper that never throws; accepts optional Prisma client or transaction handle for atomic writes. `getAuditLogs(orgId, limit?)` — ordered read. |

`recordAudit` accepts an optional `client` parameter (either `PrismaClient` or `Prisma.TransactionClient`). When called inside a `$transaction`, pass the transaction handle (`tx`) to ensure the audit write is part of the same atomic operation. When called outside a transaction, omit the client parameter and the root Prisma client will be used. The function never throws — audit failures are logged to Sentry and never propagate to the caller.

### Logged actions

| Action                     | Trigger                                            |
| -------------------------- | -------------------------------------------------- |
| `org.create`               | New standalone org created                         |
| `org.join_franchise`       | Franchisee joined via token                        |
| `org.update`               | Org settings changed (timezone, address, hours)    |
| `org.transfer_ownership`   | Ownership transferred to a different member        |
| `org.delete`               | Org permanently deleted by owner                   |
| `task.create`              | Task definition created                            |
| `task.update`              | Task definition updated                            |
| `task.delete`              | Task definition deleted                            |
| `role.create`              | Custom role created                                |
| `role.update`              | Role name, color, or permissions changed           |
| `role.delete`              | Custom role deleted                                |
| `membership.create`        | Member added to org                                |
| `membership.update`        | Member working days or roles changed               |
| `membership.status_change` | Member status toggled (ACTIVE / RESTRICTED)        |
| `membership.delete`        | Member removed from org                            |
| `invite.send`              | Member or franchise invite sent                    |
| `invite.accept`            | Invite accepted (member or bot-slot)               |
| `template.create`          | Template created or duplicated                     |
| `template.update`          | Template renamed                                   |
| `template.delete`          | Template deleted                                   |
| `bot.create`               | Placeholder (bot) membership created               |
| `bot.delete`               | Placeholder membership deleted                     |
| `entry.create`             | Live timetable entry created                       |
| `entry.delete`             | Live timetable entry deleted                       |
| `franchisee.remove`        | Franchisee org permanently removed by parent owner |

### Browsing logs (no UI yet)

```bash
# Prisma Studio — table browser at localhost:5555
pnpm prisma studio
```

Or query directly in the Supabase SQL Editor:

```sql
SELECT al.action, al."entityType", al."entityId",
       al.before, al.after, al."createdAt",
       u.name AS actor
FROM "AuditLog" al
LEFT JOIN "User" u ON u.id = al."actorId"
WHERE al."orgId" = '<org-id>'
ORDER BY al."createdAt" DESC
LIMIT 100;
```

## Image Storage

File uploads are handled via **Supabase Storage** using direct browser-to-storage PUT requests (signed URLs), which avoids Vercel's 4.5 MB body limit.

### Buckets

| Bucket                | Access  | Used for    | URL resolution              |
| --------------------- | ------- | ----------- | --------------------------- |
| `friendchise-private` | Private | Task images | Short-lived signed read URL |
| `friendchise-public`  | Public  | Org logos   | Permanent public URL        |

Both buckets must exist in the Supabase project. `NEXT_PUBLIC_SUPABASE_URL` (the project URL) and `SUPABASE_SECRET_KEY` (the `service_role` JWT) are required env vars.

### Storage path conventions

| File type  | Path pattern                               | DB field             |
| ---------- | ------------------------------------------ | -------------------- |
| Task image | `orgs/{orgId}/tasks/{taskId}/{uuid}.{ext}` | `Task.imageUrl`      |
| Org logo   | `orgs/{orgId}/{uuid}.{ext}`                | `Organization.image` |

Both fields store the **bare storage path**, not a full URL. URLs are resolved at display time:

- Task images → `createSignedReadUrl(path)` (server-side, expires in 1 h)
- Org logos → `getPublicUrl(path)` (permanent; used in hub page, org switcher)

### Upload flow

1. Client calls a server action to get a **signed upload URL** (never exposing `SUPABASE_SECRET_KEY` to the browser).
2. Browser `PUT`s the file directly to the signed URL.
3. Client calls a second server action to **save the storage path** to the DB, which also deletes the previous file if one existed.

### Crop & zoom UI

`components/ui/image-crop-dialog.tsx` is a shared dialog used by both org logo and task image upload. It is controlled via `file: File | null` — passing a `File` opens the dialog; `null` closes it.

| Prop       | Type                | Description                                                   |
| ---------- | ------------------- | ------------------------------------------------------------- |
| `file`     | `File \| null`      | The raw file selected by the user; `null` = dialog closed     |
| `config`   | `ImageCropConfig`   | `{ aspect, outputWidth, outputHeight }` — crop shape and size |
| `onCrop`   | `(f: File) => void` | Called with the cropped canvas output as a new `File`         |
| `onCancel` | `() => void`        | Called when the user dismisses the dialog                     |

Crop configurations:

| Use case   | `aspect` | Output size | Match                             |
| ---------- | -------- | ----------- | --------------------------------- |
| Org logo   | `1`      | 512 × 512   | Round/square logo display         |
| Task image | `1`      | 600 × 600   | `aspect-square` task view display |

### Server actions (`app/actions/storage.ts`)

| Action                | Permission        | Description                                          |
| --------------------- | ----------------- | ---------------------------------------------------- |
| `getSignedUploadUrl`  | `MANAGE_TASKS`    | Returns signed URL for private bucket (task images)  |
| `saveTaskImagePath`   | `MANAGE_TASKS`    | Saves path to `Task.imageUrl`, deletes old file      |
| `removeTaskImage`     | `MANAGE_TASKS`    | Deletes file and clears `Task.imageUrl`              |
| `getOrgLogoUploadUrl` | `MANAGE_SETTINGS` | Returns signed URL for public bucket (org logos)     |
| `saveOrgLogoPath`     | `MANAGE_SETTINGS` | Saves path to `Organization.image`, deletes old logo |
| `removeOrgLogo`       | `MANAGE_SETTINGS` | Deletes logo file and clears `Organization.image`    |

### Storage helpers (`lib/supabase-storage.ts`)

| Function                      | Bucket  | Description                                              |
| ----------------------------- | ------- | -------------------------------------------------------- |
| `createSignedUploadUrl`       | Private | Signed URL for browser to PUT a task image               |
| `createSignedReadUrl`         | Private | Short-lived signed URL to display a task image           |
| `deleteStorageFile`           | Private | Delete a task image (silent on failure)                  |
| `createSignedUploadUrlPublic` | Public  | Signed URL for browser to PUT an org logo                |
| `getPublicUrl`                | Public  | Permanent public URL for an org logo (no signing needed) |
| `deletePublicFile`            | Public  | Delete an org logo (silent on failure)                   |

### next/image hostname

`next.config.ts` includes a `remotePatterns` entry for `*.supabase.co` so `next/image` can serve Supabase Storage URLs:

```ts
{ protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" }
```

## Conversion Tool

The Conversion tool (`/orgs/[orgId]/tools/conversion`) is a production-quantity calculator for franchise kitchens. It converts ingredient quantities between units using saved rates and named templates.

### Data model

```
ConversionSet          — container scoped to an org (e.g. "Donut Batches")
  └─ ConversionRate    — directional rate between two ToolItems (stored as toQty/fromQty scalar)
  └─ ConversionTemplate— named saved calculator state (always has a "Default" template)
       └─ ConversionTemplateEntry — one item slot; quantity non-null = From item, null = To item
ToolItem               — org-scoped ingredient/unit pair, shared across all sets
```

### URL-driven template switching

The active template is encoded in the URL as `?template=<id>`. When the param changes:

1. The server page re-runs, resolves the template ID (URL → Default → first), and fetches its `ConversionTemplateEntry` rows.
2. `SetDetailClient` receives `key={activeTemplateId}`, forcing a full remount with the new DB state.
3. The action sidebar stays open because it only closes on pathname changes (not query param changes).

### Persistence

All calculator state is persisted immediately to the database — there is no `localStorage` involvement:

| Action                           | DB write                                           |
| -------------------------------- | -------------------------------------------------- |
| Add a From item                  | `upsertTemplateEntryAction` with `quantity = 0`    |
| Change a From quantity (on blur) | `upsertTemplateEntryAction` with the new quantity  |
| Remove a From/To item            | `removeTemplateEntryAction`                        |
| Add a To item                    | `upsertTemplateEntryAction` with `quantity = null` |

### Unit abbreviation

`add-rate-form.tsx` abbreviates long unit strings in dropdowns: units ≤ 4 chars are shown as-is; longer units are condensed to `first letter + last letter` (e.g. `grams` → `gs`). The full unit is always stored in the DB unchanged.

### Service layer (`lib/services/tools.ts`)

| Function                                                                   | Description                                                      |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `getConversionSets(orgId)`                                                 | List all sets for an org                                         |
| `getConversionSet(orgId, setId)`                                           | Fetch a single set                                               |
| `createConversionSet(orgId, name)`                                         | Create a set                                                     |
| `deleteConversionSet(orgId, id)`                                           | Delete a set                                                     |
| `renameConversionSet(orgId, id, name)`                                     | Rename a set                                                     |
| `getToolItems(orgId)`                                                      | List all tool items for an org                                   |
| `createToolItem(orgId, name, unit)`                                        | Create a tool item                                               |
| `deleteToolItem(orgId, id)`                                                | Delete a tool item                                               |
| `getConversionRates(orgId, setId)`                                         | List all rates for a set (includes from/to item names and units) |
| `createConversionRate(orgId, setId, fromItemId, toItemId, fromQty, toQty)` | Create a rate; stored as `toQty / fromQty`                       |
| `deleteConversionRate(orgId, rateId)`                                      | Delete a rate                                                    |
| `getConversionTemplates(orgId, setId)`                                     | List all templates for a set                                     |
| `createConversionTemplate(setId, name)`                                    | Create a template                                                |
| `deleteConversionTemplate(orgId, templateId)`                              | Delete a template                                                |
| `getTemplateEntries(templateId)`                                           | List all entries for a template                                  |
| `upsertTemplateEntry(templateId, itemId, quantity, visible)`               | Insert or update an entry                                        |
| `deleteTemplateEntry(templateId, itemId)`                                  | Remove an entry                                                  |

### Server actions (`app/actions/tools.ts`)

All write actions require `MANAGE_TASKS` permission.

| Action                           | Description                                         |
| -------------------------------- | --------------------------------------------------- |
| `createConversionSetAction`      | Create a new set; auto-creates a "Default" template |
| `deleteConversionSetAction`      | Delete a set and all its rates/templates            |
| `renameConversionSetAction`      | Rename a set                                        |
| `createToolItemAction`           | Create an org-scoped tool item                      |
| `deleteToolItemAction`           | Delete a tool item                                  |
| `createConversionRateAction`     | Add a rate between two items                        |
| `deleteConversionRateAction`     | Remove a rate                                       |
| `createConversionTemplateAction` | Create a template                                   |
| `deleteConversionTemplateAction` | Delete a template                                   |
| `upsertTemplateEntryAction`      | Save a calculator item slot (add/update)            |
| `removeTemplateEntryAction`      | Remove a calculator item slot                       |

## Roster Tool

The Roster tool (`/orgs/[orgId]/tools/roster`) is a shift-scheduling grid for managing weekly staff assignments. It supports live editing, reusable multi-week templates, and a one-click apply-to-roster workflow.

### Data model

```
RosterDayConfig        — per-org day settings (recommendedSize, openTimeMin, closeTimeMin)
RosterEntry            — one shift: membership + weekStart + dayIndex + optional shift times
RosterTemplate         — reusable pattern with cycleWeeks (1–12)
  └─ RosterTemplateEntry — one slot: membership + weekIndex + dayIndex + optional shift times
```

### Service layer (`lib/services/roster.ts`)

| Function                                                                        | Description                                                                                          |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `getOrgSchedule(orgId)`                                                         | Returns org default `openTimeMin`, `closeTimeMin`, `timezone`                                        |
| `hasRosterActivity(orgId)`                                                      | Returns true if the org has any roster entries, day configs, or templates                            |
| `getRosterEntries(orgId, weekStarts)`                                           | Fetches entries for a list of week-start dates                                                       |
| `getRosterDayConfigs(orgId)`                                                    | Returns all day configs ordered by `dayIndex`                                                        |
| `getOrgMembersForRoster(orgId)`                                                 | Active members for the cell member picker                                                            |
| `setRosterCellMembers(orgId, weekStart, dayIndex, members)`                     | Replaces the member list for one (weekStart, dayIndex) cell in a transaction                         |
| `upsertRosterDayConfig(orgId, dayIndex, data)`                                  | Upserts `recommendedSize`, `openTimeMin`, `closeTimeMin` for a day                                   |
| `getRosterTemplates(orgId)`                                                     | Lists all templates with entry count                                                                 |
| `getRosterTemplate(orgId, templateId)`                                          | Fetches a single template with expanded entries                                                      |
| `createRosterTemplate(orgId, name, cycleWeeks)`                                 | Creates a template; name must be unique within the org                                               |
| `deleteRosterTemplate(orgId, templateId)`                                       | Deletes a template and all its entries                                                               |
| `renameRosterTemplate(orgId, templateId, name)`                                 | Renames with uniqueness check                                                                        |
| `setRosterTemplateCellMembers(orgId, templateId, weekIndex, dayIndex, members)` | Replaces entries for one template cell in a transaction                                              |
| `updateRosterTemplateCycleWeeks(orgId, templateId, cycleWeeks)`                 | Resizes the cycle; blocked if entries exist in the removed range                                     |
| `clearRosterTemplateWeek(orgId, templateId, weekIndex)`                         | Deletes all entries in one week column of a template                                                 |
| `applyRosterTemplate(orgId, templateId, startMonday, cycleRepeats, force)`      | Stamps the template onto the live roster starting from `startMonday`, repeating `cycleRepeats` times |

### Server actions (`app/actions/roster.ts`)

All write actions require `MANAGE_MEMBERS` permission.

| Action                                 | Description                                                                              |
| -------------------------------------- | ---------------------------------------------------------------------------------------- |
| `setRosterCellMembersAction`           | Replace members for a live roster cell                                                   |
| `upsertRosterDayConfigAction`          | Save day config (recommended size + open/close times)                                    |
| `createRosterTemplateAction`           | Create a template; returns `templateId` on success                                       |
| `deleteRosterTemplateAction`           | Delete a template                                                                        |
| `renameRosterTemplateAction`           | Rename a template                                                                        |
| `setRosterTemplateCellMembersAction`   | Replace members for a template cell                                                      |
| `updateRosterTemplateCycleWeeksAction` | Resize the cycle (blocked if out-of-range entries exist)                                 |
| `clearRosterTemplateWeekAction`        | Clear all entries in one week column                                                     |
| `applyRosterTemplateAction`            | Apply a template to the live roster; accepts ISO date string + repeat count + force flag |

### Apply workflow

1. From the live roster page, click **Apply Template** in the sidebar.
2. The `ApplyTemplatePanel` shows a template picker, a start-date input (any day in the target week), and a repeat count.
3. On submit, `applyRosterTemplateAction` normalizes the date to the nearest Monday, runs a conflict check, and on conflict returns `{ conflict: true }` — the panel shows a confirmation asking to overwrite.
4. Confirming re-submits with `force: true`, which deletes then re-creates all entries in the affected weeks atomically.

### Shared time utilities (`_utils/time-utils.ts`)

| Export                    | Description                                                        |
| ------------------------- | ------------------------------------------------------------------ |
| `formatMinutes(min)`      | Integer minutes → `"HH:MM"` string (e.g. 90 → `"01:30"`)           |
| `timeToMinutes(time)`     | `"HH:MM"` string → integer minutes, or `null` for invalid input    |
| `hoursWorked(start, end)` | Duration string (e.g. `"7h 30m"`) from two nullable minute offsets |

## Item List Tool

The Item List tool (`/orgs/[orgId]/tools/item-list`) lets org managers build named lists of `ToolItem`s for use at specific stations or jobs (e.g. a prep checklist or a grid of required doughnuts). Each list has a `displayType` — the view used when the list is opened.

### Data model

```
ToolItemList           — named org-scoped list (displayType: GRID | CHECKLIST | TABLE | GALLERY)
  └─ ToolItemGridConfig — optional grid dimensions (gridCols × gridRows, default 4×4)
  └─ ToolItemListEntry  — one item slot (position, amount)
       └─ ToolItemChecklistEntry — presence = checked; deletion = unchecked
```

### Display types

| Type        | Description                                                                                                             |
| ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| `GRID`      | Cell-based grid (columns × rows). Cells show item image, name, amount, and live conversion rates when a set is applied. |
| `CHECKLIST` | Vertical list with toggleable check state per entry.                                                                    |
| `TABLE`     | (Reserved — table view, not yet implemented.)                                                                           |
| `GALLERY`   | (Reserved — gallery view, not yet implemented.)                                                                         |

### Apply Rates (conversion overlay)

A `ConversionSet` can be overlaid on the grid view. For each cell the sidebar calculates how much of each related item is needed based on the stored `ConversionRate`s (displayed as `ItemName: qty unit` per 1 item). The selected set is encoded as `?set=<setId>` in the URL and persisted client-side in cookie `item-list-rates-prefs-{orgId}` so the selection is automatically restored on the next visit.

### List management

Members with `MANAGE_TASKS` can:

- **Create** a list (from the sidebar on the lists index page)
- **Rename / edit description** — inline on the list card/row via the `⋯` dropdown
- **Duplicate** — deep copy: metadata + grid config + all entries; auto-named `"Name (copy)"` or `"Name (copy 2)"` etc.
- **Delete** — permanently removes the list and all entries (cascade)

### Service layer (`lib/services/tools.ts`)

| Function                                                            | Description                                                   |
| ------------------------------------------------------------------- | ------------------------------------------------------------- |
| `getToolItemLists(orgId)`                                           | List all lists for an org (with entry count)                  |
| `getToolItemListDetail(listId, orgId)`                              | Fetch a single list with all entries and item data            |
| `createToolItemList(orgId, name, displayType, description?)`        | Create a list                                                 |
| `updateToolItemList(orgId, listId, data)`                           | Rename and/or update description                              |
| `deleteToolItemList(orgId, listId)`                                 | Delete a list and all entries                                 |
| `duplicateToolItemList(orgId, listId)`                              | Deep-copy a list with a unique name                           |
| `addToolItemListEntry(listId, itemId, amount?)`                     | Append an entry                                               |
| `addToolItemListEntryAtPosition(listId, itemId, position, amount?)` | Insert at a specific grid cell                                |
| `moveToolItemListEntry(listId, fromPosition, toPosition)`           | Swap two cells                                                |
| `removeToolItemListEntry(listId, entryId)`                          | Remove an entry                                               |
| `updateToolItemListEntryAmount(entryId, amount)`                    | Update an entry's amount                                      |
| `updateToolItemGridConfig(listId, gridCols, gridRows)`              | Upsert grid dimensions                                        |
| `toggleChecklistEntry(listEntryId)`                                 | Toggle checked state (insert/delete `ToolItemChecklistEntry`) |

### Server actions (`app/actions/tools.ts`)

All write actions require `MANAGE_TASKS`.

| Action                                 | Description                              |
| -------------------------------------- | ---------------------------------------- |
| `createToolItemListAction`             | Create a list                            |
| `updateToolItemListAction`             | Rename and/or update description         |
| `deleteToolItemListAction`             | Delete a list permanently                |
| `duplicateToolItemListAction`          | Duplicate a list; returns `{ ok, list }` |
| `addToolItemListEntryAction`           | Add an item to a list                    |
| `addToolItemListEntryAtPositionAction` | Add an item at a specific grid cell      |
| `moveToolItemListEntryAction`          | Swap two cell positions                  |
| `removeToolItemListEntryAction`        | Remove an item from a list               |
| `updateToolItemListEntryAmountAction`  | Update an entry's amount                 |
| `updateToolItemGridConfigAction`       | Save grid dimensions                     |
| `toggleChecklistEntryAction`           | Toggle a checklist item's checked state  |

## Task Comments

Task comments are threaded discussions attached to a task definition. Any member whose org is in the same franchise network as the task's owning org can comment.

### Permission model

```text
franchiseRoot(org) = org.parentId ?? org.id
canComment         = franchiseRoot(taskOrg) === franchiseRoot(userOrg)
```

Org members with `MANAGE_TASKS` can additionally pin and delete any comment.

### Features

- **Threaded replies** — one level deep (top-level comments + inline replies)
- **Voting** — up/down votes per comment; one vote per user enforced by composite PK
- **Pinning** — managers can pin a top-level comment to the top of the thread
- **Inline editing** — authors can edit their own comment content; `editedAt` is set
- **Soft delete** — deleted comments show a "[deleted]" tombstone; replies are preserved
- **Author snapshot** — `authorName` and `authorImage` are captured at post time so comments display correctly even if the author's account is later deleted

### Service layer (`lib/services/task-comments.ts`)

| Function                                                                 | Description                                                    |
| ------------------------------------------------------------------------ | -------------------------------------------------------------- |
| `canUserCommentOnTask(taskId, userOrgId)`                                | Franchise root check — returns `true` if allowed               |
| `getTaskComments(taskId)`                                                | All top-level comments + one level of replies (asc)            |
| `createComment(taskId, orgId, authorId, authorName, authorImage, input)` | Insert a new comment or reply with author snapshot             |
| `editComment(taskId, commentId, authorId, input)`                        | Update content and set `editedAt`; author-only guard           |
| `softDeleteComment(commentId)`                                           | Sets `isDeleted = true`; content replaced at render            |
| `voteOnComment(commentId, userId, type)`                                 | Upserts a `TaskCommentVote`; removes vote if same type toggled |
| `setPinComment(commentId, isPinned)`                                     | Toggles `isPinned` and `pinnedAt`                              |

### Server actions (`app/actions/task-comments.ts`)

| Action                | Auth requirement         | Description                      |
| --------------------- | ------------------------ | -------------------------------- |
| `addCommentAction`    | Franchise member         | Post a new comment or reply      |
| `editCommentAction`   | Comment author           | Edit content of own comment      |
| `deleteCommentAction` | Author or `MANAGE_TASKS` | Soft-delete a comment            |
| `voteCommentAction`   | Franchise member         | Cast or toggle an up/down vote   |
| `pinCommentAction`    | `MANAGE_TASKS`           | Pin or unpin a top-level comment |

### UI components (`app/(app)/orgs/[orgId]/tasks/[taskId]/comments/`)

| File                  | Type   | Description                                                                     |
| --------------------- | ------ | ------------------------------------------------------------------------------- |
| `index.tsx`           | Server | Async gate + hydration — parallel-fetches comments, canComment, canManage       |
| `comment-section.tsx` | Client | Stateful shell — owns reply/edit open state; calls `router.refresh()` on change |
| `comment-item.tsx`    | Client | One comment row — votes (optimistic), pin, edit, delete, reply                  |
| `comment-input.tsx`   | Client | Controlled textarea for new comments or replies                                 |
| `types.ts`            | —      | `CommentFE` type (ISO string dates, aggregated vote counts, one-level replies)  |

## Server Actions vs API Routes

| Path               | Used by                              | Location       |
| ------------------ | ------------------------------------ | -------------- |
| **Server Actions** | Web UI forms and buttons             | `app/actions/` |
| **API Routes**     | Session-authenticated HTTP endpoints | `app/api/`     |

Both are thin wrappers — they handle auth, validate input, then delegate to `lib/services/`. The service layer holds all database logic and is shared between both paths.

Server Actions call `revalidatePath` to invalidate the Next.js cache so server-rendered pages reflect the latest data without a full page reload.

## Pages

| Route                                               | Guard                                      | Description                                                                                                                                                                                                             |
| --------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                                 | Signed in                                  | Hub — org cards with logo images (falls back to colored initial badge); recent org banner                                                                                                                               |
| `/signin`                                           | —                                          | Google OAuth sign-in                                                                                                                                                                                                    |
| `/orgs/new`                                         | Signed in                                  | Create a new organization                                                                                                                                                                                               |
| `/orgs/join`                                        | Signed in                                  | Join an existing org as a franchisee using a one-time token                                                                                                                                                             |
| `/orgs/[orgId]`                                     | `requireOrgMemberPage`                     | Org overview — stat cards (members, tasks, roles, today's schedule completion), today's schedule list, org header (name, address, timezone, settings link for owner)                                                    |
| `/orgs/[orgId]/tools`                               | `requireOrgMemberPage`                     | Tools hub — sidebar with search + nav links (Item List, Conversion, Roster); content area stub                                                                                                                          |
| `/orgs/[orgId]/tools/item-list`                     | `requireOrgMemberPage`                     | Item List hub — grid of org ToolItems; sidebar: Back link + Add/Edit Item                                                                                                                                               |
| `/orgs/[orgId]/tools/item-list/lists`               | `requireOrgMemberPage`                     | List-of-lists index — search, list/card toggle; managers can create, rename, duplicate, and delete lists via ⋯ dropdown                                                                                                 |
| `/orgs/[orgId]/tools/item-list/lists/[listId]`      | `requireOrgMemberPage`                     | List detail — grid or checklist view of entries; sidebar: view toggle, Add Item, grid-size controls, Apply Rates set picker (selection persisted in cookie `item-list-rates-prefs-{orgId}`)                             |
| `/orgs/[orgId]/tools/conversion`                    | `requireOrgMemberPage`                     | Conversion tool — lists all ConversionSets for the org; sidebar: Back + "Add Set" action                                                                                                                                |
| `/orgs/[orgId]/tools/conversion/[setId]`            | `requireOrgMemberPage`                     | Conversion calculator — two-column From/To grid with live calculations; template switcher dropdown in toolbar; template state persisted in DB via `ConversionTemplateEntry`; sidebar: Items · Rates · Templates actions |
| `/orgs/[orgId]/tools/roster`                        | `requireOrgMemberPage`                     | Roster tool — scrollable weekly shift grid (Mon–Sun rows × multi-week columns); week navigation; Edit Day Config + Apply Template actions in sidebar                                                                    |
| `/orgs/[orgId]/tools/roster/templates`              | `requireOrgMemberPage`                     | Roster template list — card view; MANAGE_TIMETABLE holders can create, rename, and delete templates                                                                                                                     |
| `/orgs/[orgId]/tools/roster/templates/[templateId]` | `requireOrgMemberPage`                     | Roster template editor — cycle-week stepper, column-paged board (7 day rows × cycleWeeks columns); clicking a cell opens the member/shift-time panel                                                                    |
| `/orgs/[orgId]/franchisee`                          | `requireParentOrgOwnerPage`                | Franchise management — invite tokens + franchisee list                                                                                                                                                                  |
| `/orgs/[orgId]/tasks`                               | `requireOrgMemberPage`                     | Task definition list — sort, role filter, list/card toggle in sidebar; search in toolbar; Create Task action in sidebar (managers only)                                                                                 |
| `/orgs/[orgId]/tasks/new`                           | `requireOrgPermissionPage MANAGE_TASKS`    | Create task — includes color picker                                                                                                                                                                                     |
| `/orgs/[orgId]/tasks/[taskId]`                      | `requireOrgMemberPage`                     | Task detail view — description, color, image preview (aspect-square); clicking a task name in the timetable navigates here                                                                                              |
| `/orgs/[orgId]/tasks/[taskId]/edit`                 | `requireOrgPermissionPage MANAGE_TASKS`    | Edit task — color picker pre-filled with current color                                                                                                                                                                  |
| `/orgs/[orgId]/memberships`                         | `requireOrgMemberPage`                     | Member list — role filter, list/card toggle in sidebar; search in toolbar; Invite Member + Add Bot in sidebar (ActionSidebar on desktop, Dialog on mobile)                                                              |
| `/orgs/[orgId]/memberships/new`                     | `requireOrgPermissionPage MANAGE_MEMBERS`  | Invite a new member by email (standalone page, also accessible from sidebar action)                                                                                                                                     |
| `/orgs/[orgId]/memberships/[memberId]`              | `requireOrgMemberPage`                     | Member detail view — avatar, roles (multi-badge), working days, status, join date                                                                                                                                       |
| `/orgs/[orgId]/memberships/[memberId]/edit`         | `requireOrgPermissionPage MANAGE_MEMBERS`  | Edit member — working days, roles (owner role excluded from picker)                                                                                                                                                     |
| `/orgs/[orgId]/timetable`                           | `requireOrgMemberPage`                     | Timetable — calendar or simple mode, week navigation                                                                                                                                                                    |
| `/orgs/[orgId]/timetable/templates`                 | `requireOrgMemberPage`                     | Timetable template list — card or list view; MANAGE_TASKS holders can rename, duplicate, and delete                                                                                                                     |
| `/orgs/[orgId]/timetable/templates/new`             | `requireOrgMemberPage`                     | Create a new timetable template                                                                                                                                                                                         |
| `/orgs/[orgId]/timetable/templates/[templateId]`    | `requireOrgMemberPage`                     | Template editor — Calendar (drag-and-drop grid) or Simple (day table) view; cycle-length controls                                                                                                                       |
| `/orgs/[orgId]/settings`                            | —                                          | Redirects to `/settings/organization`                                                                                                                                                                                   |
| `/orgs/[orgId]/settings/organization`               | `requireOrgPermissionPage MANAGE_SETTINGS` | Org settings — logo upload (crop dialog, 512×512 square, public bucket), org info, timezone, hours, transfer, delete                                                                                                    |
| `/orgs/[orgId]/settings/roles`                      | `requireOrgPermissionPage MANAGE_ROLES`    | Role list with page sidebar — "+ Create Role" opens the form in the action sidebar; row ··· menu "Edit" also opens in action sidebar                                                                                    |
| `/orgs/[orgId]/settings/timetable`                  | —                                          | Timetable display settings (stub)                                                                                                                                                                                       |
| `/orgs/[orgId]/settings/notification`               | —                                          | Notification preferences (stub)                                                                                                                                                                                         |

All `/orgs/[orgId]/*` pages are guarded by at least `requireOrgMemberPage` — users not in the org are redirected.

## Notification System

In-app notifications are implemented via the `Invite` and `Notification` models and a bell icon in the navbar.

- The `NavBar` server component fetches all visible invites and an unseen count for the session user on every render.
- **Visibility window**: `PENDING` invites are always shown; `ACCEPTED`/`DECLINED` invites are shown for 7 days after being handled, then disappear naturally.
- **Unseen badge**: the bell shows a red count badge for invites where `seenAt IS NULL`. Clicking the bell calls `markInvitesSeenAction` to clear it.
- **Panel**: a `Popover` on desktop, a bottom `Sheet` on mobile (`useIsMobile` hook).
- **Invite types**: `MEMBER` (org membership invite) and `FRANCHISE` (franchise join invite). Each type shows different actions in the `InviteCard`.
- Snapshot fields (`orgName`, `inviterName`) are captured at invite creation so the card renders without additional DB joins.

## Franchise System

A parent org can spawn franchisee orgs using a one-time invite token flow:

1. Franchisor generates a token via the Franchisee page — stores a `FranchiseToken` with `invitedEmail` and `expiresAt`.
2. The invitee visits `/orgs/new` and submits the token (via `joinFranchise` server action).
3. On join, all roles, tasks, and timetable settings are cloned from the parent into the new child org (`lib/services/franchise.ts`).
4. The joining user is assigned as the franchisee org's Owner.
5. The parent org owner can view all child orgs and pending tokens, extend/revoke tokens, and remove franchisees.

## UI Notes

- **Org color accents** — both the hub page (`/`) org cards and the org overview page (`/orgs/[orgId]`) derive a deterministic accent color from the org name via a seeded palette (`orgColor(name)` hashes the character codes mod 9). The hub card uses the color for the initials badge background and a top color bar; the overview page renders a `h-1.5` color bar at the top of the card. No extra DB field is required.
- **Sidebar architecture** — Three context layers work together:
  - `MobileSidebarContext` — boolean open/close state for the global app sidebar overlay on mobile.
  - `AppSidebar` — desktop hover-expand strip (`w-12` → `w-52`); mobile fixed overlay. Uses `SidebarNavItem variant="app"`.
- **PageSidebarContext** — slot-based system for page-level sidebars. `layout.tsx` calls `<RegisterPageSidebar>` to mount a persistent shell; pages call `<RegisterPageSidebarSubContent>` to swap only the inner filters/actions without unmounting the shell (eliminates sidebar flicker on navigation). Open/closed state persisted in `localStorage`.
- **Shell + sub-content pattern** — Tasks and Members each have a `*-sidebar-shell.tsx` (client, registered in `layout.tsx`) that renders the panel title, nav tabs, and a `usePageSidebarSubContent()` slot. The per-page sidebar content (`*-sidebar-content.tsx`) is registered via `RegisterPageSidebarSubContent` in `page.tsx` and fills that slot.
- **ActionSidebar for member actions** — "Invite Member" and "Add Bot" in the members sidebar open an `ActionSidebarSlot` panel on desktop (button highlights blue while active) and a `Dialog` popup on mobile. The dialog is mounted in the same component tree as the button so it is not unmounted when the mobile sidebar overlay closes.
- **Unified height system** — `h-12` (48px) is used consistently across: navbar inner row, toolbar, sidebar nav items, page sidebar title rows, and open/close buttons. This ensures every horizontal element lines up on a shared baseline.
- **Sidebar nav** — Active state uses prefix matching; Overview uses exact matching. The nav contains: Overview, Timetable, Tasks, Tools, Members.
- **Colors required** — Both `Role.color` and `Task.color` are non-nullable in the schema and enforced by Zod validators (`/^#[0-9a-fA-F]{6}$/`). Create and edit forms render a native `<input type="color">` with a hex label. The color is submitted as a hidden `<input name="color">` so it flows through `FormData`.
- **Task form color picker** — Lazy `useState(() => dv?.color ?? randomHex())` initializer prevents React purity errors on random defaults.
- **Member pages** — Split into view (`[memberId]/page.tsx`) and edit (`[memberId]/edit/page.tsx`) routes. Both share `MemberForm`. The toolbar on the detail page provides Edit and an Actions ▼ dropdown (Restrict / Unrestrict / Delete with confirm dialogs).
- **Role picker** — Searchable text input with a dropdown. Selecting a role auto-adds it; no `+` button. The owner role is never shown in the picker (filtered in the edit page query and enforced in the service layer).
- **Owner role guard** — Three layers: (1) DB query filters it from `allRoles` on the edit page, (2) `updateMembership` rejects any `roleId` whose key is `"owner"`, (3) the new-member query uses `NOT: { key: "owner" }`.
- **Clicking tasks in timetable** — In Calendar view the task title inside each block is a `<Link>` to the task detail page. In Simple (table) view the task name cell is a `<Link>`; clicking elsewhere in the row still opens the edit popup.
- **Timetable simple view** — Replaced the `<table>` layout with flex rows. Each row has a colored accent bar (`w-1 self-stretch rounded-full`, color from `inst.taskColor`), a monospace time column, the task name (linked, truncated, line-through when done/skipped), assignee initials chips (max 3 + "+N" overflow, hidden on mobile), a compact duration label (`formatDuration` — e.g. `"45m"`, `"1h 30m"`), and a status badge pill. A small status dot replaces the badge on mobile (`sm:hidden`). The edit button fades out on hover focus for desktop.
- **Mobile page sidebar X close button** — The mobile overlay for the page sidebar (`PageSidebarSlot`) includes an `absolute` positioned X button (top-right corner) to close the panel. It is positioned in the outer `fixed` container (not the scrollable inner div) so it stays visible while the user scrolls the sidebar content.
- **Form validation** — server-action errors rendered inline with `aria-invalid`/`aria-describedby` plus a Sonner toast summary.
- **Timetable** — Calendar and Simple mode toggle, week navigation via `?week=` and `?mode=` params. Calendar view uses absolute positioning for task blocks; overlapping tasks get side-by-side columns. Status colours: gray = TODO, amber = IN_PROGRESS, green = DONE, red = SKIPPED.
- **Fixed toolbar / scroll containment** — `h-dvh` on `SidebarProvider` + `overflow-hidden` on `SidebarInset` keep the body from scrolling so toolbars can stay visually fixed. The `<main>` element is the actual scroll container. Child pages that need a pinned toolbar use `flex flex-col h-full` on their root, a static `<Toolbar>` at the top, and a `flex-1 overflow-auto` div below it for the scrollable list. Negative horizontal margins on the scrollable div cancel `<main>`'s padding so the list extends edge-to-edge.
- **Template editor** — Two view modes (Calendar / Simple) toggled via a segmented control and persisted in `localStorage`. **Calendar** mode shows a drag-and-drop time grid; tasks are dragged from a sidebar panel (desktop) or a bottom sheet (mobile); adaptive column count based on container width via `ResizeObserver`. **Simple** mode shows a day-by-day table sorted by start time; clicking a row opens an inline popup to adjust time and assignees. Both modes share day/week navigation and +/− cycle-length controls.
- **Roster tool** — A scrollable week-by-week shift assignment grid. Days (Mon–Sun) are rows; each week column represents one calendar week identified by its Monday `weekStart` date. Clicking a cell opens a dialog to assign org members and optional shift start/end times. Day columns carry a configurable `recommendedSize` badge and optional open/close time range. Week navigation shifts the visible window by one week.
- **Roster templates** — Reusable multi-week staffing patterns. A template has a `cycleWeeks` (1–12); the editor shows a 7-row × cycleWeeks-column grid. Clicking a cell opens an `ActionSidebar` panel to assign members and shift times. The +/− stepper adds/removes week columns — removing a column is blocked when entries exist in the last week. Applying a template (via the Apply Template panel on the live roster page) stamps the pattern starting from a selected Monday, repeating it `N` times; a conflict check prevents overwriting existing entries unless the force checkbox is ticked.
- **Template list management** — MANAGE_TASKS holders see a ··· dropdown on each template (card and list view) with Rename (inline Dialog), Duplicate ("Copy of …" with collision suffix), and Delete (AlertDialog confirmation). Mutations call `revalidatePath` so the list refreshes without a full reload.
- **Task descriptions** — Task descriptions are stored as GFM markdown and rendered via `react-markdown` + `remark-gfm` on the task detail page. The task list (card and table views) strips markdown via a lightweight `stripMd()` helper for plain-text previews.
- **Task table** — `TaskTable` client component: search, sort (name/duration/people), role filter, row `···` menu (Edit / Duplicate / Delete with confirm). Clicking the row navigates to the task detail page (keyboard accessible — `role="button"` + `tabIndex=0`). In "All" and "Shared" modes each task row shows an ownership badge: **Mine** (org owns it), **Franchise** (inherited from parent), or **Available** (franchise global, not yet added).
- **Roles page** — System roles show a `system` badge and cannot be deleted; Owner also cannot be edited. "+ Create Role" in the page sidebar opens an `ActionSidebar` panel with the full role form (name, color, permissions, task eligibility). The row `···` menu's "Edit" item opens the same form pre-filled in the action sidebar — no standalone `/new` or `/[roleId]/edit` pages. On success the panel closes and `router.refresh()` updates the table in place.
- **Role security** — `createRole` and `updateRole` validate `taskIds` against tasks scoped to `orgId` inside a transaction. Cross-tenant IDs abort the transaction with an `INVALID` error.

## Timetable

### Permission gating

| Feature                                               | Required permission |
| ----------------------------------------------------- | ------------------- |
| View timetable                                        | `VIEW_TIMETABLE`    |
| Drag entries, add from task sidebar, Actions dropdown | `MANAGE_TIMETABLE`  |
| Update a task's status via `···` popup                | any org member      |
| Full edit (time, assignees, delete) via `···` popup   | `MANAGE_TIMETABLE`  |

### Role filter

A **Filter** dropdown in the toolbar lets users narrow the timetable to tasks whose `TaskEligibility` includes a selected role. The filter is stored in the URL (`?roleId=`) so it persists across week navigation.

### Skip display

Any `TODO` entry whose local date is before today (org timezone) is displayed as `SKIPPED` in both Calendar and Simple views without mutating the database.

### `···` popup (CalendarEditPopup)

Every timetable block has a `···` menu button. Clicking it opens a Dialog:

- **All members** — can update the task's status.
- **MANAGE_TIMETABLE holders** — additionally see a time input, an assignee list, and a Delete button.

### UTC storage model

Live `TimetableEntry` rows are stored in UTC (`date` = UTC midnight, `startTimeMin`/`endTimeMin` = UTC minutes from that midnight). The server page converts to the org's local timezone before passing instances to the client. Template entries remain in local wall-clock minutes and are converted on `applyTemplate`.

`endTimeMin` is capped at 1440 (= 24:00 midnight) to support 24/7 schedules.

## Seed Data

### Dev seed (`pnpm seed` / `pnpm seed:dev`)

Creates 3 sample organizations each with realistic data:

| Org            | Owner  | Members                       | Custom roles                  | Tasks |
| -------------- | ------ | ----------------------------- | ----------------------------- | ----- |
| Donut Shop A   | Ivan   | Jordan, Casey, Riley, Alex    | Fryer Operator, Counter Staff | 6     |
| Coffee House B | Ivan   | Riley, Morgan, Jordan, Taylor | Head Barista, Kitchen Hand    | 6     |
| Bakery C       | Jordan | Casey, Riley, Morgan, Sam     | Head Baker, Pastry Chef       | 6     |

All orgs also have Owner and Default Member system roles. Members can hold multiple roles. Each org has a timetable template and ~14 historical timetable entries plus today and tomorrow entries.

Users: Ivan, Jordan, Casey, Riley, Morgan, Alex, Taylor, Sam.

### Walker's Doughnuts one-off seed

`scripts/seed-walkers-doughnuts.ts` is a standalone seed for the Walker's Doughnuts org (60 tasks — frappes, hot drinks, food prep, cleaning). Task descriptions are written in GFM markdown (ingredients, method steps, notes).

```bash
# First run — creates the org from scratch
npx tsx scripts/seed-walkers-doughnuts.ts

# Re-run (safe) — upserts roles/permissions/membership and replaces all tasks
npx tsx scripts/seed-walkers-doughnuts.ts

# Full reset — deletes the org and all related data, then recreates from scratch
npx tsx scripts/seed-walkers-doughnuts.ts --reset
```

The script reads `DATABASE_URL` from `.env` (then `.env.local` override). The owner email defaults to `E2E_TEST_USER_EMAIL` or `ivan@example.test`.

## Testing

```bash
# Unit tests (Vitest)
pnpm test
pnpm test:watch
pnpm test:coverage

# Scoped unit test runs
pnpm test:services
pnpm test:validators
pnpm test:actions
pnpm test:api

# Integration tests (Vitest — hits the real dev database; reseeds before each run)
pnpm test:integration

# E2E tests (Playwright — requires a running dev server and seeded DB)
pnpm test:e2e
```

Integration tests live in `__tests__/integration/` and run sequentially against the live dev database (`DATABASE_URL`). They require `INTEGRATION_TEST_USER_EMAIL` (or fall back to the seed user). The global setup reseeds the dev database before each run to guarantee a clean baseline.

| Test file                                                      | Service covered        | Tests |
| -------------------------------------------------------------- | ---------------------- | ----- |
| `__tests__/integration/lib/services/orgs.test.ts`              | `orgs.ts`              | 2     |
| `__tests__/integration/lib/services/memberships.test.ts`       | `memberships.ts`       | 6     |
| `__tests__/integration/lib/services/roles.test.ts`             | `roles.ts`             | 7     |
| `__tests__/integration/lib/services/tasks.test.ts`             | `tasks.ts`             | 8     |
| `__tests__/integration/lib/services/timetable-entries.test.ts` | `timetable-entries.ts` | 14    |
| `__tests__/integration/lib/services/assignees.test.ts`         | `assignees.ts`         | 8     |
| `__tests__/integration/lib/services/templates.test.ts`         | `templates.ts`         | 18    |
| `__tests__/integration/lib/services/invites.test.ts`           | `invites.ts`           | 11    |
| `__tests__/integration/lib/services/bots.test.ts`              | `bots.ts`              | 13    |
| `__tests__/integration/lib/services/audit-log.test.ts`         | `audit-log.ts`         | 6     |

CI runs on every push/PR to `master` via GitHub Actions (`.github/workflows/ci.yml`):

1. **check** job — type-check, lint, unit tests (no DB required)
2. **e2e** job (needs `check`) — spins up a Postgres 16 service container, runs migrations + dev seed, then runs Playwright against the Next.js dev server

Playwright test state is saved to `playwright/.auth/` (gitignored). The `global.setup.ts` skips reseeding when `CI=true` (already seeded by the workflow).

## Docs

The `docs/` folder contains long-form documentation that doesn't belong in this README:

| Path                                         | Description                                              |
| -------------------------------------------- | -------------------------------------------------------- |
| `docs/v1/UAT.md`                             | User Acceptance Testing checklist for the v1 feature set |
| `docs/v1/v1-smoke-test/smoke-test-{1..4}.md` | Manual smoke test reports run against production         |

## Observability

Error monitoring and performance tracking is handled by **Sentry** via `@sentry/nextjs`.

- **Error monitoring** — unhandled exceptions on server, edge, and client are captured with full stack traces and request context
- **Performance tracing** — distributed traces across server actions, API routes, and the client; `tracesSampleRate: 1` in development (lower this in production)
- **Session Replay** — video-like reproduction of user sessions leading up to an error (10% of sessions sampled; 100% on error)
- **Logs** — server-side logs forwarded to Sentry via `enableLogs: true`
- **Source maps** — uploaded at build time via `withSentryConfig`; requires `SENTRY_AUTH_TOKEN` in Vercel env vars
- **Global error boundary** — `app/global-error.tsx` catches top-level React errors and reports them before rendering the fallback UI

Sentry config files:

| File                        | Purpose                                                  |
| --------------------------- | -------------------------------------------------------- |
| `sentry.server.config.ts`   | Server-side init (tracing, logs, PII)                    |
| `sentry.edge.config.ts`     | Edge runtime init                                        |
| `instrumentation.ts`        | Next.js instrumentation hook (wires server/edge configs) |
| `instrumentation-client.ts` | Client-side init (tracing, replay, logs)                 |

Required env var for source map uploads:

```env
SENTRY_AUTH_TOKEN=   # Required whenever source maps are uploaded at build time (e.g., in CI/CD or on hosting platforms such as Vercel)
                     # Source map upload is performed by withSentryConfig during build
```

## Status

Work in progress. Fully implemented: service layer (all 10 services with 93 integration tests), REST API, auth, member management (list, view, edit, restrict, delete, convert-to-bot), task management (list, view, create, edit with color; ownership badges; card keyboard navigation), timetable view (calendar + simple, task links; simple view redesigned as flex rows with color accent bars, assignee chips, duration labels, status badge pills, and mobile status dots), timetable templates (create, rename, duplicate, delete, calendar/simple editor, cycle-length controls, apply to timetable), org settings, role management (list, create, edit, delete, task eligibility, color — all via action sidebar panels; no standalone create/edit pages), franchise management, required colors on tasks and roles, async breadcrumbs with name resolution, fixed-toolbar scroll containment on members and tasks pages, audit log (DB table + Zod-validated service layer, all significant mutations instrumented — UI pending), tasks/members/roles page sidebar redesign (shell + sub-content pattern matching timetable architecture, URL-param-driven filters, ActionSidebar panels for Invite Member + Add Bot + Create Role + Edit Role with mobile Dialog fallback), task comments (threaded comments with replies, voting, pinning, soft delete, inline edit — franchise-scoped permission model), mobile page sidebar X close button, org color accent bars (hub + overview), task filter/sort/view preferences persisted to both localStorage and cookies (server-side redirect on first load, no client round-trip), roster tool permissions corrected to MANAGE_MEMBERS.

Not yet started: schedule generation (automatic cycle-based rotation), worker "Today" checklist, completion stats, timetable/notification settings pages, real-time notification refresh, audit log UI (activity feed page).

Implemented: acceptance notification back to inviter (see `notifyInviteAccepted` in `lib/services/invites.ts`).
