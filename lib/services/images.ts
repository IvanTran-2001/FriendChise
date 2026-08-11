import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { PermissionAction } from "@prisma/client";
import { isDemoEmail } from "@/lib/demo";
import { requireOrgPermissionAction } from "@/lib/authz/action";
import { prisma, type PrismaTransactionClient } from "@/lib/platform/prisma";
import {
  createSignedReadUrl,
  createSignedReadUrls,
  createSignedUploadUrl,
  moveStorageFile,
  copyStorageFile,
} from "@/lib/platform/supabase-storage";
import type { StorageErrorCode } from "@/lib/http/storage-error";

type Tx = PrismaTransactionClient;
type OrgImageRow = {
  id: string;
  storagePath: string;
  name: string | null;
  createdAt: Date;
};

export const MAX_PAGE_SIZE = 100;
type AllowedMime = "image/jpeg" | "image/png" | "image/webp";
export const ALLOWED_MIME_TYPES: AllowedMime[] = ["image/jpeg", "image/png", "image/webp"];
export const EXT: Record<AllowedMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function normalizePageNumber(value: number | undefined, fallback: number) {
  if (!Number.isFinite(value ?? NaN)) return fallback;
  return Math.max(1, Math.floor(value ?? fallback));
}

function normalizePageSize(value: number | undefined, fallback: number) {
  if (!Number.isFinite(value ?? NaN)) return fallback;
  return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(value ?? fallback)));
}

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
  const pageSize = normalizePageSize(options.pageSize, 12);
  const totalCount = await prisma.orgImage.count();
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(normalizePageNumber(options.page, 1), totalPages);

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
  const pageSize = normalizePageSize(options.pageSize, 24);
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
  const page = Math.min(normalizePageNumber(options.page, 1), totalPages);

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
  db: Tx | typeof prisma = prisma,
) {
  try {
    return await db.orgImage.upsert({
      where: {
        orgId_storagePath: {
          orgId,
          storagePath,
        },
      },
      create: { orgId, storagePath, name },
      update: { storagePath },
      select: { id: true, storagePath: true, name: true, createdAt: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await db.orgImage.findUnique({
        where: {
          orgId_storagePath: {
            orgId,
            storagePath,
          },
        },
        select: { id: true, storagePath: true, name: true, createdAt: true },
      });

      if (existing) return existing;
    }

    throw error;
  }
}

export async function withOrgImageStorageLock<T>(
  orgId: string,
  storagePath: string,
  action: (tx: Tx) => Promise<T>,
) {
  const startedAt = performance.now();
  try {
    return await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(0x494d47, hashtext(${`${orgId}:${storagePath}`}))`;
        return action(tx);
      },
      { maxWait: 10_000, timeout: 30_000 },
    );
  } finally {
    const durationMs = Math.round(performance.now() - startedAt);
    if (durationMs >= 250) {
      console.info("[withOrgImageStorageLock] lock hold duration", {
        orgId,
        storagePath,
        durationMs,
      });
    }
  }
}

export type ImageRelocationDecision = {
  action: "copy" | "move";
  sourcePath: string;
  destinationPath: string;
  logPrefix: string;
};

export async function applyRelocationDecision(decision: ImageRelocationDecision) {
  if (decision.action === "copy") {
    const copyResult = await copyStorageFile(decision.sourcePath, decision.destinationPath);
    if (!copyResult.ok) {
      console.error(`${decision.logPrefix} Failed to copy storage file from ${decision.sourcePath} to ${decision.destinationPath}:`, copyResult.error);
      return false;
    }

    return true;
  }

  const moveResult = await moveStorageFile(decision.sourcePath, decision.destinationPath);
  if (!moveResult.ok) {
    console.error(`${decision.logPrefix} Failed to move storage file from ${decision.sourcePath} to ${decision.destinationPath}:`, moveResult.error);
    return false;
  }

  return true;
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
  { ok: true; signedUrl: string; path: string } | { ok: false; error: string; code: StorageErrorCode | "unauthorized" | "invalid_input" }
> {
  const authz = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_TASKS);
  if (!authz.ok) return { ok: false, error: "Unauthorized", code: "unauthorized" };
  if (isDemoEmail(authz.userEmail)) {
    return { ok: false, error: "Image uploads are not available in demo mode.", code: "invalid_input" };
  }
  if (!ALLOWED_MIME_TYPES.includes(mimeType as AllowedMime)) {
    return { ok: false, error: "Unsupported file type. Use JPEG, PNG, or WebP.", code: "invalid_input" };
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
  | { ok: false; error: string; code: StorageErrorCode | "unauthorized" | "invalid_input" }
> {
  const authz = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_TASKS);
  if (!authz.ok) return { ok: false, error: "Unauthorized", code: "unauthorized" };
  if (isDemoEmail(authz.userEmail)) return { ok: false, error: "Image uploads are not available in demo mode.", code: "invalid_input" };

  const normalized = storagePath.replace(/^\/+/, "").replace(/\.\./g, "");
  if (!normalized.startsWith(`orgs/${orgId}/images/`)) {
    return { ok: false, error: "Invalid storage path", code: "invalid_input" };
  }

  const signedUrl = (await createSignedReadUrl(normalized)) ?? null;
  if (!signedUrl) return { ok: false, error: "Failed to generate image URL", code: "storage_failure" };

  const img = await withOrgImageStorageLock(orgId, normalized, async (tx) => addOrgImage(orgId, normalized, name, tx));

  return { ok: true, image: { ...img, signedUrl } };
}

/** Returns a paginated slice of org library images with fresh signed URLs. */
export async function getOrgImagesPageWithSignedUrls(
  orgId: string,
  options: { page?: number; pageSize?: number; search?: string } = {},
): Promise<
  | {
      ok: true;
      images: { id: string; storagePath: string; name: string | null; signedUrl: string }[];
      omittedCount: number;
      totalCount: number;
      totalPages: number;
      page: number;
      pageSize: number;
    }
  | { ok: false; error: string; code: StorageErrorCode | "unauthorized" | "invalid_input" }
> {
  const authz = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_TASKS);
  if (!authz.ok) return { ok: false, error: "Unauthorized", code: "unauthorized" };

  const pageData = await getOrgImagesPage(orgId, options);
  if (pageData.images.length === 0) {
    return {
      ok: true,
      images: [],
      omittedCount: 0,
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
    return { ok: false, error: "Failed to generate signed URLs for org images.", code: "storage_failure" };
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
    omittedCount: omittedRows.length,
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

async function relocateImage({
  orgId,
  currentPath,
  expectedPath,
  excludeTaskId,
  excludeItemId,
  logPrefix,
  db = prisma,
}: {
  orgId: string;
  currentPath: string;
  expectedPath: string;
  excludeTaskId?: string;
  excludeItemId?: string;
  logPrefix: string;
  db?: Tx | typeof prisma;
}): Promise<ImageRelocationDecision> {
  const [otherTasksCount, itemsCount, orgImagesCount] = await Promise.all([
    db.task.count({
      where: excludeTaskId ? { imageUrl: currentPath, NOT: { id: excludeTaskId } } : { imageUrl: currentPath },
    }),
    db.toolItem.count({
      where: excludeItemId ? { imgUrl: currentPath, NOT: { id: excludeItemId } } : { imgUrl: currentPath },
    }),
    db.orgImage.count({
      where: { orgId, storagePath: currentPath },
    }),
  ]);

  const isShared = otherTasksCount + itemsCount + orgImagesCount > 0;
  return {
    action: isShared ? "copy" : "move",
    sourcePath: currentPath,
    destinationPath: expectedPath,
    logPrefix,
  };
}

/**
 * Safely renames/copies the task image to match the sanitized task name.
 * When onRelocation is provided, relocation is deferred to the caller, the
 * expected path is returned, and the caller owns rollback if the move fails.
 * When relocation is executed immediately, null signals failure.
 */
export async function renameTaskImageIfNeeded(
  orgId: string,
  taskId: string,
  tx?: Tx,
  onRelocation?: (decision: ImageRelocationDecision) => void,
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

  const relocated = await relocateImage({
    orgId,
    currentPath,
    expectedPath,
    excludeTaskId: taskId,
    logPrefix: "[renameTaskImageIfNeeded]",
    db,
  });

  if (onRelocation) {
    onRelocation(relocated);
    await db.task.update({
      where: { id: taskId },
      data: { imageUrl: expectedPath },
    });
    return expectedPath;
  }

  await db.task.update({
    where: { id: taskId },
    data: { imageUrl: expectedPath },
  });

  const applied = await applyRelocationDecision(relocated);
  if (!applied) {
    await db.task.update({
      where: { id: taskId },
      data: { imageUrl: currentPath },
    });
    return null;
  }

  return expectedPath;
}

/**
 * Safely renames/copies the tool item image to match the sanitized item name.
 * When onRelocation is provided, relocation is deferred to the caller, the
 * expected path is returned, and the caller owns rollback if the move fails.
 * When relocation is executed immediately, null signals failure.
 */
export async function renameToolItemImageIfNeeded(
  orgId: string,
  itemId: string,
  tx?: Tx,
  onRelocation?: (decision: ImageRelocationDecision) => void,
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

  const relocated = await relocateImage({
    orgId,
    currentPath,
    expectedPath,
    excludeItemId: itemId,
    logPrefix: "[renameToolItemImageIfNeeded]",
    db,
  });

  if (onRelocation) {
    onRelocation(relocated);
    await db.toolItem.update({
      where: { id: itemId },
      data: { imgUrl: expectedPath },
    });
    return expectedPath;
  }

  await db.toolItem.update({
    where: { id: itemId },
    data: { imgUrl: expectedPath },
  });

  const applied = await applyRelocationDecision(relocated);
  if (!applied) {
    await db.toolItem.update({
      where: { id: itemId },
      data: { imgUrl: currentPath },
    });
    return null;
  }

  return expectedPath;
}

