---
title: Image Handling
description: How FriendChise resizes images and chooses public or private storage
order: 10.6
---

FriendChise uses a shared cropper for image uploads, then stores different image types in different Supabase buckets depending on sensitivity.

## Client-side resizing

- `ImageCropDialog` is the reusable crop-and-resize component used by logo, task, and item upload flows.
- It crops in the browser and writes a new file at a fixed output size before upload.
- That keeps uploads smaller and makes previews more consistent.
- Common sizes are 512 x 512 for logos and item images, and 600 x 600 for task images.

## Storage split

- Public storage is for non-sensitive display assets that can be served directly in the app, such as org logos and other shared images.
- Private storage is for task images and similar uploads that may contain sensitive details like recipes or internal notes.
- Private files are displayed through short-lived signed read URLs.

## Upload flow

- The client asks the server for a signed upload URL.
- The browser uploads the resized file directly to Supabase Storage.
- The server stores the storage path in Postgres.
- When an image is replaced, old files are deleted only if nothing else still references them.

## Notes

- Feedback screenshots use a separate flow and are documented in the Feedback System page.
- For the underlying libraries, see [Tech Stack](/doc/architecture/stack).
