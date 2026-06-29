## What Changed

- **Supabase Storage Helpers**: Added `moveStorageFile` and `copyStorageFile` in [supabase-storage.ts](file:///e:/Ketan/FriendChise/lib/supabase-storage.ts) using the Supabase REST API endpoints `/storage/v1/object/move` and `/storage/v1/object/copy`.
- **Sanitization & Renaming Services**: Created filename sanitization and renaming helpers in [images.ts](file:///e:/Ketan/FriendChise/lib/services/images.ts):
  - `sanitizeFilename()` handles accents/diacritics normalization, lowercases, replaces non-alphanumeric chars (including emojis) with hyphens, and falls back to `"image"` if empty.
  - `renameTaskImageIfNeeded()` and `renameToolItemImageIfNeeded()` compare the current image path to the expected sanitized path (`orgs/{orgId}/tasks/{taskId}/{name}.{ext}` and `orgs/{orgId}/items/{itemId}/{name}.{ext}`).
  - Resolves shared vs unique images: copies in storage if the image is shared by other records (to avoid breaking references), and moves/renames (with database library path updates) if unique.
- **Save & Update Hooks**:
  - Integrated hooks in `saveTaskImagePath` and `saveToolItemImagePath` in [storage.ts](file:///e:/Ketan/FriendChise/app/actions/storage.ts) to rename images on save.
  - Integrated hooks in `updateTaskAction` and `updateToolItemAction` to rename files if the parent task/item name is modified. All triggers are non-blocking and run inside try/catch blocks.
- **Migration Script**: Created `scripts/seeds/rename-images.ts` to backfill existing records in the database and storage.
- **Unit Tests**: Created a new test suite [images-rename.test.ts](file:///e:/Ketan/FriendChise/__tests__/unit/lib/services/images-rename.test.ts) covering name sanitization and copy/move branch logic.

## Why

This allows task and item images in Supabase Storage to be organized descriptively rather than using generic UUIDs or library paths.

Closes #211

## Type

- [ ] 🐛 Bug fix
- [x] ✨ Enhancement / Feature
- [ ] 🔧 Refactor
- [ ] 📝 Documentation
- [ ] 🎨 UI / Styling

## How to Test

1. Run unit tests to verify backend logic: `vitest run __tests__/unit/lib/services/images-rename.test.ts` or `pnpm test`.
2. Boot up the local dev server (`pnpm dev`).
3. Create/edit a Task or Tool Item, upload an image, and save. Verify in Supabase storage that the image is named after the sanitized name (e.g. `orgs/{orgId}/tasks/{taskId}/deep-clean-fryer.png`).
4. Rename the Task or Tool Item and click Save. Verify the image in storage has been moved/renamed to match the updated name.
5. Try the migration seed script: `npx tsx scripts/seeds/rename-images.ts`.

## Screenshots / Recordings

_No UI changes were introduced. This is a backend and storage-level file renaming enhancement. Examples of before/after storage paths are shown below:_

- **Before (Task Image)**: `orgs/org_abc123/images/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d.png`
- **After (Task Image)**: `orgs/org_abc123/tasks/task_xyz789/deep-clean-fryer-9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d.png`
- **Before (Item Image)**: `orgs/org_abc123/images/f3c5f2b8-1a4c-4e8f-9a1b-3c4b5d6e7f8a.jpg`
- **After (Item Image)**: `orgs/org_abc123/items/item_xyz789/glazed-donut-f3c5f2b8-1a4c-4e8f-9a1b-3c4b5d6e7f8a.jpg`

## Checklist

- [x] Tested on desktop (Chrome)
- [ ] Tested on mobile (iPhone Safari)
- [x] No lint errors (`pnpm lint`)
- [x] Build passes (`pnpm build`)
- [ ] Smoke test updated (if applicable)

## Smoke Test Issues Resolved

- [ ] #
