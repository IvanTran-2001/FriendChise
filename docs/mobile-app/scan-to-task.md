---
title: Mobile Scan to Task
description: How the Expo app's Scan to Task screen mirrors the web scanner
order: 2
---

The mobile app ships a Scan to Task screen that turns a photo or PDF of a document into an editable draft task, mirroring the web app's `/orgs/[orgId]/tools/scan-to-task` scanner. Available from **Org Tools → Scan to Task**.

## Flow

Pick a photo (camera or library) or a PDF → optionally add an instruction ("turn this into cleanup tasks") → tap Scan → review the generated draft(s), editing any field → Save to add it to the org's task list, or Discard to drop it. The task list refreshes automatically after a save.

## Backend support

The mobile app calls REST endpoints added to the FriendChise web app under `app/api/orgs/[orgId]/tools/scan-to-task/`:

- `upload-url` (POST) — signed upload URL
- `scan-to-task` (POST) — runs the scan
- `confirm` (POST) — creates the task
- `clear` (POST) — discards a result

All reuse the existing `requireOrgPermission(orgId, MANAGE_TASKS)` bearer-auth guard, so no new auth mechanism was introduced. The scan/create logic lives in `lib/services/scan-to-task-mobile.ts` on the web app and writes to the same `ScanTaskResult` table the web scanner uses.

## Permissions

Requesting the feature triggers the OS camera permission (`NSCameraUsageDescription` / Android camera permission) or photo library permission (`NSPhotoLibraryUsageDescription`) depending on the chosen source. Choosing a PDF uses the system document picker (`expo-document-picker`), which does not require an app permission prompt. Denied permissions show an inline, human-readable error instead of failing silently.

Picked photos are re-encoded to JPEG on-device (via `expo-image-manipulator`) before upload when they're HEIC/HEIF, since the backend's HEIC decoder (`sharp`/libheif) rejects some real-world iPhone photos — see [Image Handling](/doc/features/image-handling) for why.

## Testing on a physical device

1. Set `EXPO_PUBLIC_API_URL` to your computer's network IP (see [Environment Variables](/doc/environment-variables)) so the device can reach the backend.
2. Sign in, open an org, go to Org Tools → Scan to Task.
3. Take a photo of a document/checklist, or pick an existing photo/PDF.
4. Confirm the permission prompt, tap Scan, and wait for the review screen.
5. Edit a draft's fields and tap "Save to task list", then confirm it shows up on the Tasks screen.

## Known limitations (v1, vs. the web scanner)

- One file per scan (web supports up to 12 files in a single batch).
- Only images (camera/library) and PDFs are supported as scan sources on mobile; the web scanner also accepts `.docx`, `.txt`, `.md`, `.csv`, and `.json` files.
- No merge/duplicate-adjudication UI — if a scanned draft looks like an existing task, the web app can suggest merging into it; mobile always creates a new task on save. The underlying AI duplicate-detection pass is also skipped for mobile scans to keep the request fast.
- No history/browsing screen — mobile only shows the results of the scan just run, not a persistent list of past scans (the web app's paginated history endpoint already exists and is a natural next step to add here).

## TODO

- [ ] Add a mobile history/browsing screen backed by the existing paginated history endpoint.
- [ ] Run the AI duplicate-detection pass for mobile scans and surface a merge/duplicate-adjudication UI.
- [ ] Support multi-file batches and the additional file types the web scanner accepts.
