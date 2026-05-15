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
import { requireOrgPermissionAction } from "@/lib/authz";
import {
  createSignedUploadUrl,
  createSignedUploadUrlPublic,
  deleteStorageFile,
  deletePublicFile,
} from "@/lib/supabase-storage";
import { updateTaskImageUrl } from "@/lib/services/tasks";
import { updateOrgImage } from "@/lib/services/orgs";
import { prisma } from "@/lib/prisma";

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
): Promise<{ ok: true; signedUrl: string; path: string } | { ok: false; error: string }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TASKS,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  // Verify task belongs to this org
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { orgId: true },
  });
  if (!task || task.orgId !== orgId) {
    return { ok: false, error: "Task not found" };
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
 * Saves the storage path returned after a successful upload,
 * replacing any previous image (old file is deleted from storage).
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
  const expectedPrefix = `orgs/${orgId}/tasks/${taskId}/`;
  if (!normalized.startsWith(expectedPrefix)) {
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

  // Only delete old file after successful DB update
  if (existing?.imageUrl && existing.imageUrl !== normalized) {
    await deleteStorageFile(existing.imageUrl);
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
    await deleteStorageFile(task.imageUrl);
  }

  const result = await updateTaskImageUrl(orgId, taskId, null);
  if (!result.ok) return { ok: false, error: result.error };
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
): Promise<{ ok: true; signedUrl: string; path: string } | { ok: false; error: string }> {
  const authz = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_SETTINGS);
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  if (!ALLOWED_MIME_TYPES.includes(mimeType as AllowedMime)) {
    return { ok: false, error: "Unsupported file type. Use JPEG, PNG, or WebP." };
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
  const authz = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_SETTINGS);
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
  const authz = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_SETTINGS);
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
): Promise<{ ok: true; signedUrl: string; path: string } | { ok: false; error: string }> {
  const { requireUserAction } = await import("@/lib/authz");
  const authz = await requireUserAction();
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  if (!ALLOWED_MIME_TYPES.includes(mimeType as AllowedMime)) {
    return { ok: false, error: "Unsupported file type. Use JPEG, PNG, or WebP." };
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

  const { createSignedReadUrl } = await import("@/lib/supabase-storage");
  const signedUrl = await createSignedReadUrl(storagePath, 3600);
  if (!signedUrl) return { ok: false, error: "Failed to generate signed URL" };

  return { ok: true, signedUrl };
}

