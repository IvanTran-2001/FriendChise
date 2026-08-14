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
  deleteStorageFile,
  deletePublicFile,
  moveStorageFile,
} from "@/lib/platform/supabase-storage";
import { updateTaskImageUrl } from "@/lib/services/tasks";
import { updateToolItemImageUrl } from "@/lib/services/tools";
import { updateOrgImage } from "@/lib/services/orgs";
import {
  MAX_PAGE_SIZE,
  ALLOWED_MIME_TYPES,
  EXT,
  normalizeOrgStoragePath,
  withOrgImageStorageLock,
  applyRelocationDecision,
  renameTaskImageIfNeeded,
  renameToolItemImageIfNeeded,
  getOrgImagesPageWithSignedUrls as getOrgImagesPageWithSignedUrlsService,
  getSignedOrgImageUploadUrl as getSignedOrgImageUploadUrlService,
  saveOrgImageToLibrary as saveOrgImageToLibraryService,
  type ImageRelocationDecision,
} from "@/lib/services/images";
import { prisma, type PrismaTransactionClient } from "@/lib/platform/prisma";
import { isDemoEmail } from "@/lib/demo";
type AllowedMime = (typeof ALLOWED_MIME_TYPES)[number];
type Tx = PrismaTransactionClient;

type ImageSaveResult =
  | { ok: true; oldImagePathsToDelete: string[]; relocations: ImageRelocationDecision[] }
  | { ok: false; error: string; code: "invalid_input" | "not_found" };

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
  const authz = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_TASKS);
  if (!authz.ok) return { ok: false, error: "Unauthorized" };
  if (isDemoEmail(authz.userEmail)) {
    return { ok: false, error: "Image uploads are not available in demo mode." };
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { orgId: true },
  });
    if (!task || task.orgId !== orgId) {
      return { ok: false as const, error: "Task not found" };
    }

  if (!ALLOWED_MIME_TYPES.includes(mimeType as AllowedMime)) {
    return { ok: false, error: "Unsupported file type. Use JPEG, PNG, or WebP." };
  }

  const ext = EXT[mimeType as AllowedMime];
  const uuid = crypto.randomUUID();
  const storagePath = `orgs/${orgId}/tasks/${taskId}/${uuid}.${ext}`;

  return createSignedUploadUrl(storagePath);
}

/**
 * Returns the first page of org library images with fresh signed URLs.
 *
 * This legacy action preserves pagination metadata so callers do not treat the
 * bounded slice as a complete image list.
 */
export async function getOrgImagesWithSignedUrls(
  orgId: string,
): Promise<Awaited<ReturnType<typeof getOrgImagesPageWithSignedUrlsService>>> {
  return getOrgImagesPageWithSignedUrlsService(orgId, { page: 1, pageSize: MAX_PAGE_SIZE });
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
): Promise<{ ok: true } | { ok: false; error: string; code: "unauthorized" | "invalid_input" | "not_found" }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TASKS,
  );
  if (!authz.ok) return { ok: false as const, error: "Unauthorized", code: "unauthorized" as const };
  if (isDemoEmail(authz.userEmail)) {
    return { ok: false as const, error: "Image uploads are not available in demo mode.", code: "invalid_input" as const };
  }

  const taskPath = normalizeOrgStoragePath(storagePath, `orgs/${orgId}/tasks/${taskId}/`);
  const libraryPath = normalizeOrgStoragePath(storagePath, `orgs/${orgId}/images/`);
  const normalized = taskPath ?? libraryPath;
  const isLibraryPath = normalized === libraryPath;
  if (!normalized) {
    return { ok: false as const, error: "Invalid storage path", code: "invalid_input" as const };
  }

  const run = async (
    db: Tx | typeof prisma = prisma,
  ): Promise<ImageSaveResult> => {
    const oldImagePathsToDelete: string[] = [];
    const relocations: ImageRelocationDecision[] = [];
    const existing = await db.task.findFirst({
      where: { id: taskId, orgId },
      select: { imageUrl: true },
    });

    if (!existing) return { ok: false as const, error: "Task not found", code: "not_found" as const };

    if (isLibraryPath) {
      const libraryImage = await db.orgImage.findFirst({
        where: { orgId, storagePath: normalized },
        select: { id: true },
      });
      if (!libraryImage) return { ok: false as const, error: "Image not found", code: "not_found" as const };
    }

    const result = await updateTaskImageUrl(orgId, taskId, normalized, db);
    if (!result.ok) return { ok: false as const, error: result.error, code: "not_found" as const };

    try {
      const renamedTaskImagePath = await renameTaskImageIfNeeded(
        orgId,
        taskId,
        db === prisma ? undefined : db,
        db === prisma ? undefined : (decision) => relocations.push(decision),
      );
      if (!renamedTaskImagePath) {
        return { ok: false as const, error: "Failed to relocate image.", code: "not_found" as const };
      }
    } catch (err) {
      console.error(`Failed to rename task image after saving:`, err);
      return { ok: false as const, error: "Failed to relocate image.", code: "not_found" as const };
    }

    if (existing.imageUrl && existing.imageUrl !== normalized && !existing.imageUrl.startsWith(`orgs/${orgId}/images/`)) {
      const refCount = await db.task.count({
        where: { imageUrl: existing.imageUrl, NOT: { id: taskId } },
      });
      if (refCount === 0) oldImagePathsToDelete.push(existing.imageUrl);
    }

    return { ok: true, oldImagePathsToDelete, relocations };
  };

  const restoreTaskImage = async (revertTo: string) => {
    await updateTaskImageUrl(orgId, taskId, revertTo, prisma);
  };

  if (isLibraryPath) {
    const result = await withOrgImageStorageLock(orgId, normalized, async (tx) => {
      const runResult = await run(tx);
      if (!runResult.ok) return runResult;

      return { ok: true as const, oldImagePathsToDelete: runResult.oldImagePathsToDelete, relocations: runResult.relocations };
    });
    if (!result.ok) return result;
    const applied = await applyRelocationsWithRollback(result.relocations, restoreTaskImage);
    if (!applied) return { ok: false as const, error: `Failed to relocate image.`, code: "not_found" as const };
    for (const oldImagePath of result.oldImagePathsToDelete) {
      await deleteStorageFile(oldImagePath);
    }
    return { ok: true };
  }

  const result = await run();
  if (!result.ok) return result;

  const applied = await applyRelocationsWithRollback(result.relocations, restoreTaskImage);
  if (!applied) return { ok: false as const, error: `Failed to relocate image.`, code: "not_found" as const };

  for (const oldImagePath of result.oldImagePathsToDelete) {
    await deleteStorageFile(oldImagePath);
  }

  return { ok: true };
}

async function applyRelocationsWithRollback(
  relocations: ImageRelocationDecision[],
  restore: (revertTo: string) => Promise<void>,
) {
  const appliedRelocations: ImageRelocationDecision[] = [];

  for (const relocation of relocations) {
    try {
      const applied = await applyRelocationDecision(relocation);
      if (!applied) {
        await deleteStorageFile(relocation.destinationPath);
        await restore(relocation.sourcePath);
        for (const appliedRelocation of appliedRelocations.slice().reverse()) {
          try {
            const reverted = await moveStorageFile(appliedRelocation.destinationPath, appliedRelocation.sourcePath);
            if (!reverted.ok) {
              await deleteStorageFile(appliedRelocation.destinationPath);
            }
          } catch {
            await deleteStorageFile(appliedRelocation.destinationPath);
          }
          await restore(appliedRelocation.sourcePath);
        }
        return false;
      }

      appliedRelocations.push(relocation);
    } catch {
      await deleteStorageFile(relocation.destinationPath);
      await restore(relocation.sourcePath);
      for (const appliedRelocation of appliedRelocations.slice().reverse()) {
        try {
          const reverted = await moveStorageFile(appliedRelocation.destinationPath, appliedRelocation.sourcePath);
          if (!reverted.ok) {
            await deleteStorageFile(appliedRelocation.destinationPath);
          }
        } catch {
          await deleteStorageFile(appliedRelocation.destinationPath);
        }
        await restore(appliedRelocation.sourcePath);
      }
      return false;
    }
  }

  return true;
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
    if (refCount === 0 && !task.imageUrl.startsWith(`orgs/${orgId}/images/`)) await deleteStorageFile(task.imageUrl);
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
): Promise<{ ok: true } | { ok: false; error: string; code: "unauthorized" | "invalid_input" | "not_found" }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TASKS,
  );
  if (!authz.ok) return { ok: false as const, error: "Unauthorized", code: "unauthorized" as const };
  if (isDemoEmail(authz.userEmail)) {
    return { ok: false as const, error: "Image uploads are not available in demo mode.", code: "invalid_input" as const };
  }

  const itemPath = normalizeOrgStoragePath(storagePath, `orgs/${orgId}/items/${itemId}/`);
  const libraryPath = normalizeOrgStoragePath(storagePath, `orgs/${orgId}/images/`);
  const normalized = itemPath ?? libraryPath;
  const isLibraryPath = normalized === libraryPath;
  if (!normalized)
    return { ok: false as const, error: "Invalid storage path", code: "invalid_input" as const };

  const run = async (
    db: Tx | typeof prisma = prisma,
  ): Promise<ImageSaveResult> => {
    const oldImagePathsToDelete: string[] = [];
    const relocations: ImageRelocationDecision[] = [];
    const existing = await db.toolItem.findFirst({
      where: { id: itemId, orgId },
      select: { imgUrl: true },
    });
    if (!existing) return { ok: false as const, error: "Item not found", code: "not_found" as const };

    if (isLibraryPath) {
      const libraryImage = await db.orgImage.findFirst({
        where: { orgId, storagePath: normalized },
        select: { id: true },
      });
      if (!libraryImage) return { ok: false as const, error: "Image not found", code: "not_found" as const };
    }

    const updatedCount = await updateToolItemImageUrl(orgId, itemId, normalized, db);
    if (updatedCount === 0) return { ok: false as const, error: "Item not found", code: "not_found" as const };

    try {
      const renamedToolItemImagePath = await renameToolItemImageIfNeeded(
        orgId,
        itemId,
        db === prisma ? undefined : db,
        db === prisma ? undefined : (decision) => relocations.push(decision),
      );
      if (!renamedToolItemImagePath) {
        return { ok: false as const, error: "Failed to relocate image.", code: "not_found" as const };
      }
    } catch (err) {
      console.error(`Failed to rename tool item image after saving:`, err);
      return { ok: false as const, error: "Failed to relocate image.", code: "not_found" as const };
    }

    if (existing.imgUrl && existing.imgUrl !== normalized && !existing.imgUrl.startsWith(`orgs/${orgId}/images/`)) {
      const refCount = await db.toolItem.count({
        where: { imgUrl: existing.imgUrl },
      });
      if (refCount === 0) oldImagePathsToDelete.push(existing.imgUrl);
    }

    return { ok: true, oldImagePathsToDelete, relocations };
  };

  const restoreToolItemImage = async (revertTo: string) => {
    await updateToolItemImageUrl(orgId, itemId, revertTo, prisma);
  };

  if (isLibraryPath) {
    const result = await withOrgImageStorageLock(orgId, normalized, async (tx) => {
        const runResult = await run(tx);
        if (!runResult.ok) return runResult;
        return { ok: true as const, oldImagePathsToDelete: runResult.oldImagePathsToDelete, relocations: runResult.relocations };
    });
    if (!result.ok) return result;
    const applied = await applyRelocationsWithRollback(result.relocations, restoreToolItemImage);
    if (!applied) return { ok: false as const, error: `Failed to relocate image.`, code: "not_found" as const };
    for (const oldImagePath of result.oldImagePathsToDelete) {
      await deleteStorageFile(oldImagePath);
    }
    return { ok: true };
  }

  const result = await run();
  if (!result.ok) return result;

  const applied = await applyRelocationsWithRollback(result.relocations, restoreToolItemImage);
  if (!applied) return { ok: false as const, error: `Failed to relocate image.`, code: "not_found" as const };

  for (const oldImagePath of result.oldImagePathsToDelete) {
    await deleteStorageFile(oldImagePath);
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
  if (isDemoEmail(authz.userEmail))
    return { ok: false, error: "Image uploads are not available in demo mode." };

  const normalized = srcPath.replace(/^\/+/, "").replace(/\.\./g, "");
  const srcItem = await prisma.toolItem.findFirst({
    where: { orgId, imgUrl: normalized, NOT: { id: itemId } },
    select: { id: true },
  });
  if (!srcItem) return { ok: false, error: "Image not found" };

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

export async function getSignedOrgImageUploadUrl(orgId: string, mimeType: string) {
  return getSignedOrgImageUploadUrlService(orgId, mimeType);
}

export async function saveOrgImageToLibrary(orgId: string, storagePath: string, name?: string) {
  return saveOrgImageToLibraryService(orgId, storagePath, name);
}

export async function getOrgImagesPageWithSignedUrls(
  orgId: string,
  options: Parameters<typeof getOrgImagesPageWithSignedUrlsService>[1] = {},
) {
  return getOrgImagesPageWithSignedUrlsService(orgId, options);
}

/** Deletes a library image. Only removes from storage if nothing else references it. */
export async function deleteOrgImageAction(
  orgId: string,
  imageId: string,
): Promise<{ ok: true } | { ok: false; error: string; code: "unauthorized" | "invalid_input" | "not_found" }> {
  const authz = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_TASKS);
  if (!authz.ok) return { ok: false, error: "Unauthorized", code: "unauthorized" };

  const image = await prisma.orgImage.findFirst({
    where: { id: imageId, orgId },
    select: { storagePath: true },
  });
  if (!image) return { ok: false, error: "Image not found", code: "not_found" };

  const shouldDelete = await withOrgImageStorageLock(orgId, image.storagePath, async (tx) => {
    const { count } = await tx.orgImage.deleteMany({ where: { id: imageId, orgId } });
    if (count === 0) return false;

    const [taskRef, itemRef, imageRef] = await Promise.all([
      tx.task.count({ where: { orgId, imageUrl: image.storagePath } }),
      tx.toolItem.count({ where: { orgId, imgUrl: image.storagePath } }),
      tx.orgImage.count({ where: { orgId, storagePath: image.storagePath } }),
    ]);

    return taskRef === 0 && itemRef === 0 && imageRef === 0;
  });

  if (shouldDelete) {
    await deleteStorageFile(image.storagePath);
  }

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
  const normalized = normalizeOrgStoragePath(storagePath, `orgs/${orgId}/`);
  if (!normalized) {
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
): Promise<{ ok: true; signedUrl: string } | { ok: false; error: string; code: "unauthorized" | "invalid_input" | "storage_failure" }> {
  const authz = await requireOrgMemberAction(orgId);
  if (!authz.ok) return { ok: false, error: "Unauthorized", code: "unauthorized" };

  const normalized = normalizeOrgStoragePath(storagePath, `orgs/${orgId}/`);
  if (!normalized) {
    return { ok: false, error: "Invalid path", code: "invalid_input" };
  }

  const signedUrl = await createSignedReadUrl(normalized, 3600);
  if (!signedUrl) return { ok: false, error: "Failed to generate signed URL", code: "storage_failure" };

  return { ok: true, signedUrl };
}
