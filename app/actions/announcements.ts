"use server";

import { requireOrgOwnerAction } from "@/lib/authz";
import { localDateTimeToUTC } from "@/lib/core/date-utils";
import { prisma } from "@/lib/platform/prisma";
import {
  createAnnouncement,
  deleteAnnouncement,
  extendAnnouncementExpiry,
  updateAnnouncement,
} from "@/lib/services/announcements";
import { revalidatePath } from "next/cache";

export type AnnouncementMutationState =
  | { ok: true }
  | { ok: false; error: string }
  | null;

function parseAnnouncementExpiry(
  expiresAtValue: string,
  orgTimezone: string,
): Date | undefined {
  const value = expiresAtValue.trim();
  if (!value) return undefined;

  // Prefer ISO timestamps from the client; fall back to org-local wall-clock parsing.
  const hasTimezoneOffset = /(?:Z|[+-]\d\d(?::?\d\d)?)$/.test(value);
  const utcMs = hasTimezoneOffset
    ? new Date(value).getTime()
    : localDateTimeToUTC(value, orgTimezone);

  if (Number.isNaN(utcMs)) return undefined;
  return new Date(utcMs);
}

export async function createAnnouncementAction(
  orgId: string,
  _prev: AnnouncementMutationState,
  formData: FormData,
): Promise<AnnouncementMutationState> {
  const authz = await requireOrgOwnerAction(orgId);
  if (!authz.ok) return { ok: false, error: "Unauthorized." };

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const scopeValue = String(formData.get("scope") ?? "ORG").trim();
  const expiresAtValue = String(formData.get("expiresAt") ?? "").trim();
  // Use the org timezone as the reference when a raw datetime-local value arrives.
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { timezone: true },
  });

  if (!title) return { ok: false, error: "Announcement title is required." };
  if (!description)
    return { ok: false, error: "Announcement description is required." };

  const scope =
    scopeValue === "GLOBAL" ? "GLOBAL" : "ORG";

  const expiresAt = parseAnnouncementExpiry(
    expiresAtValue,
    org?.timezone ?? "Australia/Sydney",
  );
  if (expiresAtValue && !expiresAt) {
    return { ok: false, error: "Expiration date is invalid." };
  }

  const result = await createAnnouncement(
    orgId,
    {
      title,
      description,
      scope,
      expiresAt: expiresAt ?? null,
    },
    authz.userId,
    authz.userEmail,
  );
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/orgs/${orgId}/announcements`);
  revalidatePath(`/orgs/${orgId}`);
  return { ok: true };
}

export async function updateAnnouncementAction(
  orgId: string,
  announcementId: string,
  _prev: AnnouncementMutationState,
  formData: FormData,
): Promise<AnnouncementMutationState> {
  const authz = await requireOrgOwnerAction(orgId);
  if (!authz.ok) return { ok: false, error: "Unauthorized." };

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const scopeValue = String(formData.get("scope") ?? "ORG").trim();
  const expiresAtValue = String(formData.get("expiresAt") ?? "").trim();
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { timezone: true },
  });

  if (!title) return { ok: false, error: "Announcement title is required." };
  if (!description)
    return { ok: false, error: "Announcement description is required." };

  const scope = scopeValue === "GLOBAL" ? "GLOBAL" : "ORG";

  const expiresAt = parseAnnouncementExpiry(
    expiresAtValue,
    org?.timezone ?? "Australia/Sydney",
  );
  if (expiresAtValue && !expiresAt) {
    return { ok: false, error: "Expiration date is invalid." };
  }

  const result = await updateAnnouncement(
    orgId,
    announcementId,
    {
      title,
      description,
      scope,
      expiresAt: expiresAt ?? null,
    },
    authz.userId,
    authz.userEmail,
  );
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/orgs/${orgId}/announcements`);
  revalidatePath(`/orgs/${orgId}/announcements/${announcementId}`);
  revalidatePath(`/orgs/${orgId}`);
  return { ok: true };
}

export async function deleteAnnouncementAction(
  orgId: string,
  announcementId: string,
): Promise<{ ok: boolean; error?: string }> {
  const authz = await requireOrgOwnerAction(orgId);
  if (!authz.ok) return { ok: false, error: "Unauthorized." };

  const result = await deleteAnnouncement(
    orgId,
    announcementId,
    authz.userId,
    authz.userEmail,
  );
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/orgs/${orgId}/announcements`);
  revalidatePath(`/orgs/${orgId}`);
  return { ok: true };
}

export async function extendAnnouncementExpiryAction(
  orgId: string,
  announcementId: string,
): Promise<{ ok: boolean; error?: string }> {
  const authz = await requireOrgOwnerAction(orgId);
  if (!authz.ok) return { ok: false, error: "Unauthorized." };

  const result = await extendAnnouncementExpiry(
    orgId,
    announcementId,
    authz.userId,
    authz.userEmail,
  );
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/orgs/${orgId}/announcements`);
  revalidatePath(`/orgs/${orgId}/announcements/${announcementId}`);
  revalidatePath(`/orgs/${orgId}`);
  return { ok: true };
}