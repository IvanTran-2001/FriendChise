"use server";

/**
 * Server actions for Supabase Storage image operations.
 *
 * Task image actions (private bucket — friendchise-private):
 *   getSignedUploadUrl  — issues a signed URL the browser can PUT a file to
 *                         directly, bypassing Vercel's 4.5 MB body limit.
 *   saveTaskImagePath   — persists the storage path to Task.imageUrl after upload,
 *                         deleting the previous file if one existed.
 *   removeTaskImage     — deletes the file from storage and clears Task.imageUrl.
 *
 * Org logo actions (public bucket — friendchise-public):
 *   getOrgLogoUploadUrl — issues a signed upload URL for the public bucket.
 *                         Requires MANAGE_SETTINGS permission.
 *   saveOrgLogoPath     — persists the storage path to Organization.image after
 *                         upload, deleting the previous logo file if one existed.
 *   removeOrgLogo       — deletes the logo from storage and clears Organization.image.
 */

import { PermissionAction } from "@prisma/client";
import { requireOrgMemberAction, requireOrgPermissionAction } from "@/lib/authz";
import {
  createSignedUploadUrl,
  createSignedUploadUrlPublic,
  createSignedReadUrl,
  createSignedReadUrls,
  deleteStorageFile,
  deletePublicFile,
} from "@/lib/platform/supabase-storage";
import { updateTaskImageUrl } from "@/lib/services/tasks";
import { updateToolItemImageUrl } from "@/lib/services/tools";
import { updateOrgImage } from "@/lib/services/orgs";
import {
  getOrgImages,
  getOrgImagesPage,
  addOrgImage,
  deleteOrgImage,
  renameTaskImageIfNeeded,
  renameToolItemImageIfNeeded,
} from "@/lib/services/images";
import { prisma } from "@/lib/platform/prisma";
import { isDemoEmail } from "@/lib/demo";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type AllowedMime = (typeof ALLOWED_MIME_TYPES)[number];

const EXT: Record<AllowedMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Returns a signed upload URL for a task image.
 * The browser PUTs the compressed file directly to this URL.
 *
 * Path format: `orgs/{orgId}/tasks/{taskId}/{uuid}.{ext}`
 */
export async function getSignedUploadUrl(
  orgId: string,
  taskId: string,
  mimeType: string,
): Promise<
  { ok: true; signedUrl: string; path: string } | { ok: false; error: string }
> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TASKS,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };
  if (isDemoEmail(authz.userEmail))
    return { ok: false, error: "Image uploads are not available in demo mode." };

  // Verify task belongs to this org
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { orgId: true },
  });
  if (!task || task.orgId !== orgId) {
    return { ok: false, error: "Task not found" };
  }

  if (!ALLOWED_MIME_TYPES.includes(mimeType as AllowedMime)) {
    return {
      ok: false,
      error: "Unsupported file type. Use JPEG, PNG, or WebP.",
    };
  }

  const ext = EXT[mimeType as AllowedMime];
  const uuid = crypto.randomUUID();
  const storagePath = `orgs/${orgId}/tasks/${taskId}/${uuid}.${ext}`;

  return createSignedUploadUrl(storagePath);
}

/**
 * Saves the storage path returned after a successful upload,
 * replacing any previous image. Task/item image paths may be shared across
 * cloned franchise orgs, so old files are only deleted when nothing else
 * still points at them.
 */
export async function saveTaskImagePath(
  orgId: string,
  taskId: string,
  storagePath: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TASKS,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  // Normalize and validate storagePath
  const normalized = storagePath.replace(/^\/+/, "").replace(/\.\./g, "");
  const isTaskPath = normalized.startsWith(`orgs/${orgId}/tasks/${taskId}/`);
  const isLibraryPath = normalized.startsWith(`orgs/${orgId}/images/`);
  if (!isTaskPath && !isLibraryPath) {
    return { ok: false, error: "Invalid storage path" };
  }

  // Query existing record and update DB before deleting old file
  const existing = await prisma.task.findFirst({
    where: { id: taskId, orgId },
    select: { imageUrl: true },
  });

  // Persist the new path first
  const result = await updateTaskImageUrl(orgId, taskId, normalized);
  if (!result.ok) return { ok: false, error: result.error };

  // Try to rename the image file to match the task name (runs after successful DB write)
  try {
    await renameTaskImageIfNeeded(orgId, taskId);
  } catch (err) {
    console.error(`Failed to rename task image after saving:`, err);
  }

  // Only delete the old file if it was task-specific (not a shared library image)
  if (
    existing?.imageUrl &&
    existing.imageUrl !== normalized &&
    !existing.imageUrl.startsWith(`orgs/${orgId}/images/`)
  ) {
    const refCount = await prisma.task.count({
      where: { imageUrl: existing.imageUrl, NOT: { id: taskId } },
    });
    if (refCount === 0) await deleteStorageFile(existing.imageUrl);
  }

  return { ok: true };
}

/**
 * Removes the task image: deletes from storage and clears Task.imageUrl.
 */
export async function removeTaskImage(
  orgId: string,
  taskId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TASKS,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const task = await prisma.task.findFirst({
    where: { id: taskId, orgId },
    select: { imageUrl: true },
  });
  if (task?.imageUrl) {
    const refCount = await prisma.task.count({
      where: { imageUrl: task.imageUrl, NOT: { id: taskId } },
    });
    if (refCount === 0) await deleteStorageFile(task.imageUrl);
  }

  const result = await updateTaskImageUrl(orgId, taskId, null);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}

// ─── ToolItem Image Actions ───────────────────────────────────────────────────

/** Signed upload URL for a ToolItem image. Path: orgs/{orgId}/items/{itemId}/{uuid}.{ext} */
export async function getSignedToolItemUploadUrl(
  orgId: string,
  itemId: string,
  mimeType: string,
): Promise<
  { ok: true; signedUrl: string; path: string } | { ok: false; error: string }
> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TASKS,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };
  if (isDemoEmail(authz.userEmail))
    return { ok: false, error: "Image uploads are not available in demo mode." };

  const item = await prisma.toolItem.findFirst({
    where: { id: itemId, orgId },
    select: { id: true },
  });
  if (!item) return { ok: false, error: "Item not found" };

  if (!ALLOWED_MIME_TYPES.includes(mimeType as AllowedMime))
    return { ok: false, error: "Unsupported file type. Use JPEG, PNG, or WebP." };

  const ext = EXT[mimeType as AllowedMime];
  const uuid = crypto.randomUUID();
  return createSignedUploadUrl(`orgs/${orgId}/items/${itemId}/${uuid}.${ext}`);
}

/** Persists the storage path after a successful ToolItem image upload. */
export async function saveToolItemImagePath(
  orgId: string,
  itemId: string,
  storagePath: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TASKS,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const normalized = storagePath.replace(/^\/+/, "").replace(/\.\./g, "");
  const isItemPath = normalized.startsWith(`orgs/${orgId}/items/${itemId}/`);
  const isLibraryPath = normalized.startsWith(`orgs/${orgId}/images/`);
  if (!isItemPath && !isLibraryPath)
    return { ok: false, error: "Invalid storage path" };

  const existing = await prisma.toolItem.findFirst({
    where: { id: itemId, orgId },
    select: { imgUrl: true },
  });

  await updateToolItemImageUrl(orgId, itemId, normalized);

  // Try to rename the image file to match the item name (runs after successful DB write)
  try {
    await renameToolItemImageIfNeeded(orgId, itemId);
  } catch (err) {
    console.error(`Failed to rename tool item image after saving:`, err);
  }

  // Only delete the old file if it was item-specific (not a shared library image)
  if (
    existing?.imgUrl &&
    existing.imgUrl !== normalized &&
    !existing.imgUrl.startsWith(`orgs/${orgId}/images/`)
  ) {
    const refCount = await prisma.toolItem.count({
      where: { imgUrl: existing.imgUrl },
    });
    if (refCount === 0) await deleteStorageFile(existing.imgUrl);
  }
  return { ok: true };
}

/** Deletes a ToolItem image from storage and clears the imgUrl field. */
export async function removeToolItemImage(
  orgId: string,
  itemId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TASKS,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const item = await prisma.toolItem.findFirst({
    where: { id: itemId, orgId },
    select: { imgUrl: true },
  });
  if (item?.imgUrl) {
    // Only delete the actual file if no other item anywhere still shares it.
    const refCount = await prisma.toolItem.count({
      where: { imgUrl: item.imgUrl, NOT: { id: itemId } },
    });
    if (refCount === 0) await deleteStorageFile(item.imgUrl);
  }
  await updateToolItemImageUrl(orgId, itemId, null);
  return { ok: true };
}

/**
 * Points a ToolItem's imgUrl at an existing image from another item in the
 * same org — no new file is created in storage.
 */
export async function reuseToolItemImageAction(
  orgId: string,
  itemId: string,
  srcPath: string,
): Promise<
  | { ok: true; imgUrl: string; imageSignedUrl: string }
  | { ok: false; error: string }
> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TASKS,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const normalized = srcPath.replace(/^\/+/, "").replace(/\.\./g, "");
  // Validate the path belongs to a ToolItem in this org (must be a different item)
  const srcItem = await prisma.toolItem.findFirst({
    where: { orgId, imgUrl: normalized, NOT: { id: itemId } },
    select: { id: true },
  });
  if (!srcItem) return { ok: false, error: "Image not found" };

  // Possibly free the old path if nothing else references it
  const current = await prisma.toolItem.findFirst({
    where: { id: itemId, orgId },
    select: { imgUrl: true },
  });
  await updateToolItemImageUrl(orgId, itemId, normalized);
  if (current?.imgUrl && current.imgUrl !== normalized) {
    const refCount = await prisma.toolItem.count({
      where: { imgUrl: current.imgUrl, NOT: { id: itemId } },
    });
    if (refCount === 0) await deleteStorageFile(current.imgUrl);
  }

  const signedResult = await createSignedReadUrl(normalized);
  return { ok: true, imgUrl: normalized, imageSignedUrl: signedResult ?? "" };
}

// ─── Org Image Library Actions ───────────────────────────────────────────────

/** Signed upload URL for a library image. Path: orgs/{orgId}/images/{uuid}.{ext} */
export async function getSignedOrgImageUploadUrl(
  orgId: string,
  mimeType: string,
): Promise<
  { ok: true; signedUrl: string; path: string } | { ok: false; error: string }
> {
  const authz = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_TASKS);
  if (!authz.ok) return { ok: false, error: "Unauthorized" };
  if (isDemoEmail(authz.userEmail))
    return { ok: false, error: "Image uploads are not available in demo mode." };
  if (!ALLOWED_MIME_TYPES.includes(mimeType as AllowedMime))
    return { ok: false, error: "Unsupported file type. Use JPEG, PNG, or WebP." };
  const ext = EXT[mimeType as AllowedMime];
  const uuid = crypto.randomUUID();
  return createSignedUploadUrl(`orgs/${orgId}/images/${uuid}.${ext}`);
}

/** Saves an uploaded image to the org library after a successful upload. */
export async function saveOrgImageToLibrary(
  orgId: string,
  storagePath: string,
  name?: string,
): Promise<
  | { ok: true; image: { id: string; storagePath: string; name: string | null; signedUrl: string } }
  | { ok: false; error: string }
> {
  const authz = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_TASKS);
  if (!authz.ok) return { ok: false, error: "Unauthorized" };
  const normalized = storagePath.replace(/^\/+/, "").replace(/\.\./g, "");
  if (!normalized.startsWith(`orgs/${orgId}/images/`))
    return { ok: false, error: "Invalid storage path" };
  const img = await addOrgImage(orgId, normalized, name);
  const signedUrl = (await createSignedReadUrl(normalized)) ?? null;
  if (!signedUrl) return { ok: false, error: "Failed to generate image URL" };
  return { ok: true, image: { ...img, signedUrl } };
}

/** Returns all org library images with fresh signed URLs. */
export async function getOrgImagesWithSignedUrls(
  orgId: string,
): Promise<
  | { ok: true; images: { id: string; storagePath: string; name: string | null; signedUrl: string }[] }
  | { ok: false; error: string }
> {
  const authz = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_TASKS);
  if (!authz.ok) return { ok: false, error: "Unauthorized" };
  const rows = await getOrgImages(orgId);
  if (rows.length === 0) return { ok: true, images: [] };
  const signedMap = await createSignedReadUrls(rows.map((r) => r.storagePath));
  const images = rows
    .map((r) => ({
      id: r.id,
      storagePath: r.storagePath,
      name: r.name,
      signedUrl: signedMap.get(r.storagePath) ?? null,
    }))
    .filter((r): r is typeof r & { signedUrl: string } => !!r.signedUrl);
  return { ok: true, images };
}

/** Returns a paginated slice of org library images with fresh signed URLs. */
export async function getOrgImagesPageWithSignedUrls(
  orgId: string,
  options: { page?: number; pageSize?: number; search?: string } = {},
): Promise<
  | {
      ok: true;
      images: { id: string; storagePath: string; name: string | null; signedUrl: string }[];
      totalCount: number;
      totalPages: number;
      page: number;
      pageSize: number;
    }
  | { ok: false; error: string }
> {
  const authz = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_TASKS);
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const pageData = await getOrgImagesPage(orgId, options);
  if (pageData.images.length === 0) {
    return {
      ok: true,
      images: [],
      totalCount: pageData.totalCount,
      totalPages: pageData.totalPages,
      page: pageData.page,
      pageSize: pageData.pageSize,
    };
  }

  const signedMap = await createSignedReadUrls(pageData.images.map((r) => r.storagePath));
  const images = pageData.images
    .map((r) => ({
      id: r.id,
      storagePath: r.storagePath,
      name: r.name,
      signedUrl: signedMap.get(r.storagePath) ?? null,
    }))
    .filter((r): r is typeof r & { signedUrl: string } => !!r.signedUrl);

  return {
    ok: true,
    images,
    totalCount: pageData.totalCount,
    totalPages: pageData.totalPages,
    page: pageData.page,
    pageSize: pageData.pageSize,
  };
}

/** Deletes a library image. Only removes from storage if nothing else references it. */
export async function deleteOrgImageAction(
  orgId: string,
  imageId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const authz = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_TASKS);
  if (!authz.ok) return { ok: false, error: "Unauthorized" };
  const storagePath = await deleteOrgImage(orgId, imageId);
  if (!storagePath) return { ok: false, error: "Image not found" };
  // Delete the file only if no task or tool item still points at this path
  const [taskRef, itemRef] = await Promise.all([
    prisma.task.count({ where: { orgId, imageUrl: storagePath } }),
    prisma.toolItem.count({ where: { orgId, imgUrl: storagePath } }),
  ]);
  if (taskRef === 0 && itemRef === 0) await deleteStorageFile(storagePath);
  return { ok: true };
}

// ─── Org Logo Actions ─────────────────────────────────────────────────────────

/**
 * Returns a signed upload URL for an org logo in the public bucket.
 * Path: orgs/{orgId}/{uuid}.{ext} — stored path is also returned.
 */
export async function getOrgLogoUploadUrl(
  orgId: string,
  mimeType: string,
): Promise<
  { ok: true; signedUrl: string; path: string } | { ok: false; error: string }
> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_SETTINGS,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };
  if (isDemoEmail(authz.userEmail))
    return { ok: false, error: "Logo uploads are not available in demo mode." };

  if (!ALLOWED_MIME_TYPES.includes(mimeType as AllowedMime)) {
    return {
      ok: false,
      error: "Unsupported file type. Use JPEG, PNG, or WebP.",
    };
  }

  const ext = EXT[mimeType as AllowedMime];
  const uuid = crypto.randomUUID();
  const storagePath = `orgs/${orgId}/${uuid}.${ext}`;

  return createSignedUploadUrlPublic(storagePath);
}

/**
 * Saves the public URL for the org logo, deleting any previous one.
 */
export async function saveOrgLogoPath(
  orgId: string,
  storagePath: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_SETTINGS,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  // Normalize and validate storagePath
  const normalized = storagePath.replace(/^\/+/, "").replace(/\.\./g, "");
  const expectedPrefix = `orgs/${orgId}/`;
  if (!normalized.startsWith(expectedPrefix)) {
    return { ok: false, error: "Invalid storage path" };
  }

  // Query existing record
  const existing = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { image: true },
  });

  // Update DB first
  await updateOrgImage(orgId, normalized);

  // Only delete old file after successful DB update
  if (existing?.image && existing.image !== normalized) {
    // image stores the storage path (not the full URL)
    await deletePublicFile(existing.image);
  }

  return { ok: true };
}

/**
 * Removes the org logo from storage and clears Organization.image.
 */
export async function removeOrgLogo(
  orgId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_SETTINGS,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const existing = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { image: true },
  });
  if (existing?.image) {
    await deletePublicFile(existing.image);
  }

  await updateOrgImage(orgId, null);
  return { ok: true };
}

// ─── Feedback Screenshot Actions ─────────────────────────────────────────────

/**
 * Returns a signed upload URL for a feedback screenshot in the private bucket.
 * Path: feedback/{userId}/{uuid}.{ext}
 * Any signed-in user can upload (no org permission needed).
 */
/**
 * 5 MB hard cap embedded into the signed URL — enforced by Supabase's storage
 * server at upload time, regardless of what the client sends.
 */
const FEEDBACK_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export async function getFeedbackImageUploadUrl(
  mimeType: string,
): Promise<
  { ok: true; signedUrl: string; path: string } | { ok: false; error: string }
> {
  const { requireUserAction } = await import("@/lib/authz");
  const authz = await requireUserAction();
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  if (!ALLOWED_MIME_TYPES.includes(mimeType as AllowedMime)) {
    return {
      ok: false,
      error: "Unsupported file type. Use JPEG, PNG, or WebP.",
    };
  }

  const ext = EXT[mimeType as AllowedMime];
  const uuid = crypto.randomUUID();
  const storagePath = `feedback/${authz.userId}/${uuid}.${ext}`;

  return createSignedUploadUrl(storagePath, FEEDBACK_IMAGE_MAX_BYTES);
}

/**
 * Returns a short-lived signed read URL for a feedback screenshot.
 * Admin-only: requires super-admin authorization.
 */
export async function getFeedbackImageReadUrl(
  storagePath: string,
): Promise<{ ok: true; signedUrl: string } | { ok: false; error: string }> {
  const { requireSuperAdminAction } = await import("@/lib/authz");
  const authz = await requireSuperAdminAction();
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  if (!storagePath.startsWith("feedback/")) {
    return { ok: false, error: "Invalid path" };
  }

  const { createSignedReadUrl } = await import("@/lib/platform/supabase-storage");
  const signedUrl = await createSignedReadUrl(storagePath, 3600);
  if (!signedUrl) return { ok: false, error: "Failed to generate signed URL" };

  return { ok: true, signedUrl };
}

/**
 * Returns a short-lived signed read URL for an org-owned storage path.
 * Accepts tool item and org library image paths.
 */
export async function getOrgStorageReadUrl(
  orgId: string,
  storagePath: string,
): Promise<{ ok: true; signedUrl: string } | { ok: false; error: string }> {
  const authz = await requireOrgMemberAction(orgId);
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const normalized = storagePath.replace(/^\/+/, "").replace(/\.\./g, "");
  if (!normalized.startsWith(`orgs/${orgId}/`)) {
    return { ok: false, error: "Invalid path" };
  }

  const signedUrl = await createSignedReadUrl(normalized, 3600);
  if (!signedUrl) return { ok: false, error: "Failed to generate signed URL" };

  return { ok: true, signedUrl };
}
