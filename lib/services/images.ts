import crypto from "crypto";
import { PermissionAction } from "@prisma/client";
import { isDemoEmail } from "@/lib/demo";
import { requireOrgPermissionAction } from "@/lib/authz/action";
import { prisma } from "@/lib/platform/prisma";
import {
  createSignedReadUrl,
  createSignedReadUrls,
  createSignedUploadUrl,
  moveStorageFile,
  copyStorageFile,
  deleteStorageFile,
} from "@/lib/platform/supabase-storage";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

type OrgImageRow = {
  id: string;
  storagePath: string;
  name: string | null;
  createdAt: Date;
};

export const MAX_PAGE_SIZE = 100;

type AllowedMime = "image/jpeg" | "image/png" | "image/webp";
const ALLOWED_MIME_TYPES: AllowedMime[] = ["image/jpeg", "image/png", "image/webp"];
const EXT: Record<AllowedMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type OrgImagePage = {
  images: OrgImageRow[];
  totalCount: number;
  totalPages: number;
  page: number;
  pageSize: number;
};

/**
 * @deprecated For super-admin global views use `getGlobalOrgImagesPage()` instead.
 * This helper returns at most `MAX_PAGE_SIZE` rows and is not exhaustive.
 * Callers that need completeness should use `getOrgImagesPage()`.
 */
export async function getOrgImages(orgId: string): Promise<OrgImageRow[]> {
  const pageData = await getOrgImagesPage(orgId, { page: 1, pageSize: MAX_PAGE_SIZE });
  return pageData.images;
}

type GlobalOrgImageRow = OrgImageRow & { org: { name: string } | null };

export type GlobalOrgImagesPage = {
  images: GlobalOrgImageRow[];
  totalCount: number;
  totalPages: number;
  page: number;
  pageSize: number;
};

/**
 * Returns a paginated slice of ALL org gallery images across every organization.
 * Intended for super-admin use only (does not scope to a single orgId).
 * Only the rows for the requested page are loaded into memory, so this stays
 * efficient regardless of how many images exist globally.
 */
export async function getGlobalOrgImagesPage(
  options: { page?: number; pageSize?: number } = {},
): Promise<GlobalOrgImagesPage> {
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(options.pageSize ?? 12)));
  const totalCount = await prisma.orgImage.count();
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(Math.max(1, Math.floor(options.page ?? 1)), totalPages);

  const images = await prisma.orgImage.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      storagePath: true,
      name: true,
      createdAt: true,
      org: { select: { name: true } },
    },
  });

  return { images: images as GlobalOrgImageRow[], totalCount, totalPages, page, pageSize };
}

export async function getOrgImagesPage(
  orgId: string,
  options: { page?: number; pageSize?: number; search?: string } = {},
): Promise<OrgImagePage> {
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(options.pageSize ?? 24)));
  const search = options.search?.trim() ?? "";
  const where = search
    ? {
        orgId,
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { storagePath: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : { orgId };

  const totalCount = await prisma.orgImage.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(Math.max(1, Math.floor(options.page ?? 1)), totalPages);

  const images = await prisma.orgImage.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: { id: true, storagePath: true, name: true, createdAt: true },
  });

  return { images, totalCount, totalPages, page, pageSize };
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

/**
 * Returns a signed upload URL for an org library image.
 * Path format: `orgs/{orgId}/images/{uuid}.{ext}`
 */
export async function getSignedOrgImageUploadUrl(
  orgId: string,
  mimeType: string,
  maxSizeBytes: number = 5 * 1024 * 1024,
): Promise<
  { ok: true; signedUrl: string; path: string } | { ok: false; error: string }
> {
  const authz = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_TASKS);
  if (!authz.ok) return { ok: false, error: "Unauthorized" };
  if (isDemoEmail(authz.userEmail)) {
    return { ok: false, error: "Image uploads are not available in demo mode." };
  }
  if (!ALLOWED_MIME_TYPES.includes(mimeType as AllowedMime)) {
    return { ok: false, error: "Unsupported file type. Use JPEG, PNG, or WebP." };
  }

  const ext = EXT[mimeType as AllowedMime];
  const uuid = crypto.randomUUID();
  return createSignedUploadUrl(`orgs/${orgId}/images/${uuid}.${ext}`, maxSizeBytes);
}

/**
 * Saves an uploaded org image after a successful PUT to storage.
 */
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
  if (!normalized.startsWith(`orgs/${orgId}/images/`)) {
    return { ok: false, error: "Invalid storage path" };
  }

  const signedUrl = (await createSignedReadUrl(normalized)) ?? null;
  if (!signedUrl) return { ok: false, error: "Failed to generate image URL" };

  const img = await addOrgImage(orgId, normalized, name);

  return { ok: true, image: { ...img, signedUrl } };
}

/**
 * Returns at most `MAX_PAGE_SIZE` org library images with fresh signed URLs.
 * This is a bounded slice, not a complete list.
 */
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

  const signedUrls = await createSignedReadUrls(rows.map((row) => row.storagePath));
  const images = rows
    .map((row) => {
      const signedUrl = signedUrls.get(row.storagePath);
      return signedUrl
        ? { id: row.id, storagePath: row.storagePath, name: row.name, signedUrl }
        : null;
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  return {
    ok: true,
    images,
  };
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

  const signedUrls = await createSignedReadUrls(pageData.images.map((row) => row.storagePath));
  const omittedRows = pageData.images.filter((row) => !signedUrls.get(row.storagePath));
  const images = pageData.images
    .map((row) => {
      const signedUrl = signedUrls.get(row.storagePath);
      return signedUrl
        ? { id: row.id, storagePath: row.storagePath, name: row.name, signedUrl }
        : null;
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (images.length === 0) {
    return { ok: false, error: "Failed to generate signed URLs for org images." };
  }

  if (omittedRows.length > 0) {
    console.warn("[getOrgImagesPageWithSignedUrls] Omitted org image rows without signed URLs", {
      orgId,
      page: pageData.page,
      pageSize: pageData.pageSize,
      omittedCount: omittedRows.length,
      omittedStoragePaths: omittedRows.map((row) => row.storagePath),
    });
  }

  return {
    ok: true,
    images,
    totalCount: pageData.totalCount,
    totalPages: pageData.totalPages,
    page: pageData.page,
    pageSize: pageData.pageSize,
  };
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
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
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

  const filenameWithExt = currentPath.split("/").pop() || "";
  const filenameBase = filenameWithExt.split(".").slice(0, -1).join(".");
  const uuidMatch = filenameBase.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  const uuid = uuidMatch ? uuidMatch[0] : crypto.randomUUID();

  const sanitizedName = sanitizeFilename(task.name);
  const expectedPath = `orgs/${orgId}/tasks/${taskId}/${sanitizedName}-${uuid}.${ext}`;

  if (currentPath === expectedPath) {
    return currentPath;
  }

  const [otherTasksCount, itemsCount, orgImagesCount] = await Promise.all([
    db.task.count({
      where: { imageUrl: currentPath, NOT: { id: taskId } },
    }),
    db.toolItem.count({
      where: { imgUrl: currentPath },
    }),
    db.orgImage.count({
      where: { orgId, storagePath: currentPath },
    }),
  ]);

  const isShared = otherTasksCount + itemsCount + orgImagesCount > 0;

  if (isShared) {
    const copyResult = await copyStorageFile(currentPath, expectedPath);
    if (!copyResult.ok) {
      console.error(
        `[renameTaskImageIfNeeded] Failed to copy storage file from ${currentPath} to ${expectedPath}:`,
        copyResult.error,
      );
      return null;
    }
  } else {
    if (currentPath !== expectedPath) {
      await deleteStorageFile(expectedPath);
    }
    const moveResult = await moveStorageFile(currentPath, expectedPath);
    if (!moveResult.ok) {
      console.error(
        `[renameTaskImageIfNeeded] Failed to move storage file from ${currentPath} to ${expectedPath}:`,
        moveResult.error,
      );
      return null;
    }
    await db.orgImage.updateMany({
      where: { orgId, storagePath: currentPath },
      data: { storagePath: expectedPath, name: task.name },
    });
  }

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

  const filenameWithExt = currentPath.split("/").pop() || "";
  const filenameBase = filenameWithExt.split(".").slice(0, -1).join(".");
  const uuidMatch = filenameBase.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  const uuid = uuidMatch ? uuidMatch[0] : crypto.randomUUID();

  const sanitizedName = sanitizeFilename(item.name);
  const expectedPath = `orgs/${orgId}/items/${itemId}/${sanitizedName}-${uuid}.${ext}`;

  if (currentPath === expectedPath) {
    return currentPath;
  }

  const [tasksCount, otherItemsCount, orgImagesCount] = await Promise.all([
    db.task.count({
      where: { imageUrl: currentPath },
    }),
    db.toolItem.count({
      where: { imgUrl: currentPath, NOT: { id: itemId } },
    }),
    db.orgImage.count({
      where: { orgId, storagePath: currentPath },
    }),
  ]);

  const isShared = tasksCount + otherItemsCount + orgImagesCount > 0;

  if (isShared) {
    const copyResult = await copyStorageFile(currentPath, expectedPath);
    if (!copyResult.ok) {
      console.error(
        `[renameToolItemImageIfNeeded] Failed to copy storage file from ${currentPath} to ${expectedPath}:`,
        copyResult.error,
      );
      return null;
    }
  } else {
    if (currentPath !== expectedPath) {
      await deleteStorageFile(expectedPath);
    }
    const moveResult = await moveStorageFile(currentPath, expectedPath);
    if (!moveResult.ok) {
      console.error(
        `[renameToolItemImageIfNeeded] Failed to move storage file from ${currentPath} to ${expectedPath}:`,
        moveResult.error,
      );
      return null;
    }
    await db.orgImage.updateMany({
      where: { orgId, storagePath: currentPath },
      data: { storagePath: expectedPath, name: item.name },
    });
  }

  await db.toolItem.update({
    where: { id: itemId },
    data: { imgUrl: expectedPath },
  });

  return expectedPath;
}

