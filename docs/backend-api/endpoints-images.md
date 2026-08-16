---
title: Images and File Uploads
description: Endpoints for uploading, listing, and managing images attached to tasks and organizations
order: 9
---

FriendChise stores images in Supabase Storage. The upload flow is two-step: first obtain a presigned upload URL, then PUT the file directly to that URL from the client. Reading signed URLs for existing images is handled separately.

## Get a presigned upload URL

`POST /api/orgs/[orgId]/images/upload-url`

Returns a short-lived presigned URL that the client uses to upload an image directly to Supabase Storage. The response includes the storage path to use in subsequent task create/update requests.

### Authentication

Requires `PermissionAction.MANAGE_TASKS` in the org.

### Request body

```json
{ "mimeType": "image/jpeg" }
```

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `mimeType` | string | Yes | MIME type of the file to upload (e.g. `image/jpeg`, `image/png`, `image/webp`) |

### Response

```json
{
  "uploadUrl": "https://supabase.co/storage/v1/object/sign/...",
  "storagePath": "orgs/org_01abc/tasks/tmp/photo_xyz.jpg"
}
```

Use `uploadUrl` to PUT the file. Pass `storagePath` as `imageStoragePath` when creating or updating a task.

### Errors

| Status | Reason |
| --- | --- |
| `400` | `mimeType` is missing from the request body |
| `401` | Not authenticated |
| `403` | Insufficient permission |

---

## Get a signed read URL

`POST /api/orgs/[orgId]/storage/read-url`

Returns a short-lived signed URL for reading a private storage object. Use this to load images that are not served via public URLs.

### Authentication

Requires org membership.

### Request body

```json
{ "storagePath": "orgs/org_01abc/tasks/tsk_01abc/photo.jpg" }
```

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `storagePath` | string | Yes | The storage path of the object to read |

### Response

```json
{
  "signedUrl": "https://supabase.co/storage/v1/object/sign/..."
}
```

### Errors

| Status | Reason |
| --- | --- |
| `400` | `storagePath` is missing |
| `401` | Not authenticated |
| `403` | Object does not belong to this org |
| `404` | Object not found |

---

## List org images

`GET /api/orgs/[orgId]/images`

Returns a paginated list of images saved to the organization's image library, with signed read URLs.

### Authentication

Requires org permission for image management.

### Query parameters

| Param | Type | Default | Max | Description |
| --- | --- | --- | --- | --- |
| `page` | integer | `1` | 1000 | Page number |
| `pageSize` | integer | `24` | (internal max) | Items per page |
| `search` | string | — | — | Filter by image name |

### Response

```json
{
  "images": [
    {
      "id": "img_01abc",
      "name": "Doughnut glaze photo",
      "storagePath": "orgs/org_01abc/images/img_01abc.jpg",
      "signedUrl": "https://supabase.co/storage/v1/object/sign/..."
    }
  ],
  "totalCount": 4,
  "totalPages": 1,
  "page": 1,
  "pageSize": 24
}
```

---

## Save image to org library

`POST /api/orgs/[orgId]/images`

Saves an uploaded image to the organization's image library.

### Authentication

Requires org image management permission.

### Request body

Accepts JSON or FormData.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `storagePath` | string | Yes | Storage path from the upload-url step |
| `name` | string | Yes | Display name for the image |

### Response

```json
{ "id": "img_01abc" }
```

---

## Delete org image

`DELETE /api/orgs/[orgId]/images/[imageId]`

Removes an image from the organization's image library and deletes it from storage.

### Authentication

Requires org image management permission.

### Path parameters

| Param | Description |
| --- | --- |
| `orgId` | Organization ID |
| `imageId` | Image ID |

### Response

```json
{ "ok": true }
```

### Errors

| Status | Reason |
| --- | --- |
| `401` | Not authenticated |
| `403` | Insufficient permission |
| `404` | Image not found |

---

## Upload flow (end to end)

1. Call `POST /api/orgs/[orgId]/images/upload-url` with `{ mimeType }` to receive `{ uploadUrl, storagePath }`.
2. PUT the file directly to `uploadUrl` with the correct `Content-Type` header.
3. Use `storagePath` as the `imageStoragePath` field when creating or updating a task, or as `storagePath` when saving to the org image library.
4. Call `POST /api/orgs/[orgId]/storage/read-url` with the `storagePath` to get a signed read URL for display.
