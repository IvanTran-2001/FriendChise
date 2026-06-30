import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import {
  moveStorageFile,
  copyStorageFile,
  deleteStorageFile,
} from "@/lib/supabase-storage";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

type OrgImageRow = { id: string; storagePath: string; name: string | null; createdAt: Date };

export async function getOrgImages(orgId: string): Promise<OrgImageRow[]> {
  return prisma.orgImage.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    select: { id: true, storagePath: true, name: true, createdAt: true },
  });
}

export async function addOrgImage(
  orgId: string,
  storagePath: string,
  name?: string,
) {
  return prisma.orgImage.create({
    data: { orgId, storagePath, name },
    select: { id: true, storagePath: true, name: true, createdAt: true },
  });
}

export async function deleteOrgImage(orgId: string, imageId: string) {
  const img = await prisma.orgImage.findFirst({
    where: { id: imageId, orgId },
    select: { storagePath: true },
  });
  if (!img) return null;
  await prisma.orgImage.delete({ where: { id: imageId } });
  return img.storagePath;
}

/**
 * Sanitizes a name to make it suitable as a safe filename.
 * Normalizes Unicode diacritics, replaces non-alphanumeric with hyphens, and trims.
 * Falls back to "image" if clean name is empty.
 */
export function sanitizeFilename(name: string): string {
  const clean = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")      // Replace non-alphanumeric with hyphens
    .replace(/(^-|-$)/g, "");          // Trim hyphens
  return clean || "image";
}

/**
 * Safely renames/copies the task image to match the sanitized task name.
 * DB write is updated with the new path.
 */
export async function renameTaskImageIfNeeded(
  orgId: string,
  taskId: string,
  tx?: Tx,
): Promise<string | null> {
  const db = tx || prisma;
  const task = await db.task.findFirst({
    where: { id: taskId, orgId },
    select: { name: true, imageUrl: true },
  });

  if (!task || !task.imageUrl) return null;

  const currentPath = task.imageUrl;
  const parts = currentPath.split(".");
  const ext = parts.length > 1 ? parts.pop()?.toLowerCase() || "jpg" : "jpg";

  // Extract existing UUID if present, otherwise generate a fresh one
  const filenameWithExt = currentPath.split("/").pop() || "";
  const filenameBase = filenameWithExt.split(".").slice(0, -1).join(".");
  const uuidMatch = filenameBase.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  const uuid = uuidMatch ? uuidMatch[0] : crypto.randomUUID();

  const sanitizedName = sanitizeFilename(task.name);
  const expectedPath = `orgs/${orgId}/tasks/${taskId}/${sanitizedName}-${uuid}.${ext}`;

  if (currentPath === expectedPath) {
    return currentPath;
  }

  // Count references to the current image path in other records across both tables
  const [otherTasksCount, itemsCount] = await Promise.all([
    db.task.count({
      where: { imageUrl: currentPath, NOT: { id: taskId } },
    }),
    db.toolItem.count({
      where: { imgUrl: currentPath },
    }),
  ]);

  const isShared = (otherTasksCount + itemsCount) > 0;

  if (isShared) {
    // Copy the file in storage to avoid breaking other references
    const copyResult = await copyStorageFile(currentPath, expectedPath);
    if (!copyResult.ok) {
      console.error(`[renameTaskImageIfNeeded] Failed to copy storage file from ${currentPath} to ${expectedPath}:`, copyResult.error);
      return null;
    }
  } else {
    // Delete any existing file at the expected path first (only if different from current source)
    if (currentPath !== expectedPath) {
      await deleteStorageFile(expectedPath);
    }
    // Move/rename the file in storage
    const moveResult = await moveStorageFile(currentPath, expectedPath);
    if (!moveResult.ok) {
      console.error(`[renameTaskImageIfNeeded] Failed to move storage file from ${currentPath} to ${expectedPath}:`, moveResult.error);
      return null;
    }
    // Update any library OrgImage row pointing to the old path
    await db.orgImage.updateMany({
      where: { orgId, storagePath: currentPath },
      data: { storagePath: expectedPath, name: task.name },
    });
  }

  // Update the task's imageUrl in the DB
  await db.task.update({
    where: { id: taskId },
    data: { imageUrl: expectedPath },
  });

  return expectedPath;
}

/**
 * Safely renames/copies the tool item image to match the sanitized item name.
 * DB write is updated with the new path.
 */
export async function renameToolItemImageIfNeeded(
  orgId: string,
  itemId: string,
  tx?: Tx,
): Promise<string | null> {
  const db = tx || prisma;
  const item = await db.toolItem.findFirst({
    where: { id: itemId, orgId },
    select: { name: true, imgUrl: true },
  });

  if (!item || !item.imgUrl) return null;

  const currentPath = item.imgUrl;
  const parts = currentPath.split(".");
  const ext = parts.length > 1 ? parts.pop()?.toLowerCase() || "jpg" : "jpg";

  // Extract existing UUID if present, otherwise generate a fresh one
  const filenameWithExt = currentPath.split("/").pop() || "";
  const filenameBase = filenameWithExt.split(".").slice(0, -1).join(".");
  const uuidMatch = filenameBase.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  const uuid = uuidMatch ? uuidMatch[0] : crypto.randomUUID();

  const sanitizedName = sanitizeFilename(item.name);
  const expectedPath = `orgs/${orgId}/items/${itemId}/${sanitizedName}-${uuid}.${ext}`;

  if (currentPath === expectedPath) {
    return currentPath;
  }

  // Count references to the current image path in other records across both tables
  const [tasksCount, otherItemsCount] = await Promise.all([
    db.task.count({
      where: { imageUrl: currentPath },
    }),
    db.toolItem.count({
      where: { imgUrl: currentPath, NOT: { id: itemId } },
    }),
  ]);

  const isShared = (tasksCount + otherItemsCount) > 0;

  if (isShared) {
    // Copy the file in storage to avoid breaking other references
    const copyResult = await copyStorageFile(currentPath, expectedPath);
    if (!copyResult.ok) {
      console.error(`[renameToolItemImageIfNeeded] Failed to copy storage file from ${currentPath} to ${expectedPath}:`, copyResult.error);
      return null;
    }
  } else {
    // Delete any existing file at the expected path first (only if different from current source)
    if (currentPath !== expectedPath) {
      await deleteStorageFile(expectedPath);
    }
    // Move/rename the file in storage
    const moveResult = await moveStorageFile(currentPath, expectedPath);
    if (!moveResult.ok) {
      console.error(`[renameToolItemImageIfNeeded] Failed to move storage file from ${currentPath} to ${expectedPath}:`, moveResult.error);
      return null;
    }
    // Update any library OrgImage row pointing to the old path
    await db.orgImage.updateMany({
      where: { orgId, storagePath: currentPath },
      data: { storagePath: expectedPath, name: item.name },
    });
  }

  // Update the tool item's imgUrl in the DB
  await db.toolItem.update({
    where: { id: itemId },
    data: { imgUrl: expectedPath },
  });

  return expectedPath;
}

