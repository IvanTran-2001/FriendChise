import { AnnouncementScope, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/services/audit-log";
import { getFranchiseRootOrgId } from "@/lib/services/franchise-root";
import type { ServiceResult } from "./types";

export type AnnouncementOrder = "newest" | "oldest";

export type AnnouncementPage = {
  announcements: AnnouncementRow[];
  totalCount: number;
  totalPages: number;
  page: number;
  pageSize: number;
};

export type AnnouncementRow = {
  id: string;
  orgId: string;
  scope: AnnouncementScope;
  title: string;
  description: string;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateAnnouncementInput = {
  title: string;
  description: string;
  scope?: AnnouncementScope;
  expiresAt?: Date | null;
};

function buildVisibleAnnouncementWhere(
  orgId: string,
  franchiseRootId: string,
  now: Date,
): Prisma.AnnouncementWhereInput {
  return {
    AND: [
      { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      {
        OR: [
          {
            scope: AnnouncementScope.ORG,
            orgId,
          },
          {
            scope: AnnouncementScope.GLOBAL,
            OR: [
              { orgId: franchiseRootId },
              { organization: { parentId: franchiseRootId } },
            ],
          },
        ],
      },
    ],
  };
}

export async function createAnnouncement(
  orgId: string,
  data: CreateAnnouncementInput,
  actorId?: string | null,
  actorEmail?: string | null,
): Promise<ServiceResult<AnnouncementRow>> {
  const announcement = await prisma.announcement.create({
    data: {
      orgId,
      scope: data.scope ?? AnnouncementScope.ORG,
      title: data.title,
      description: data.description,
      expiresAt: data.expiresAt ?? null,
    },
  });

  await recordAudit({
    orgId,
    actorId: actorId ?? null,
    actorEmail: actorEmail ?? null,
    action: "announcement.create",
    targetType: "Announcement",
    targetId: announcement.id,
    after: {
      scope: announcement.scope,
      title: announcement.title,
      description: announcement.description,
      expiresAt: announcement.expiresAt,
    },
  });

  return { ok: true, data: announcement };
}

export async function updateAnnouncement(
  orgId: string,
  announcementId: string,
  data: CreateAnnouncementInput,
  actorId?: string | null,
  actorEmail?: string | null,
): Promise<ServiceResult<AnnouncementRow>> {
  const existing = await prisma.announcement.findUnique({
    where: { id: announcementId, orgId },
  });
  if (!existing) {
    return {
      ok: false,
      error: "Announcement not found.",
      code: "NOT_FOUND",
    };
  }

  const announcement = await prisma.announcement.update({
    where: { id: announcementId },
    data: {
      scope: data.scope ?? AnnouncementScope.ORG,
      title: data.title,
      description: data.description,
      expiresAt: data.expiresAt ?? null,
    },
  });

  await recordAudit({
    orgId,
    actorId: actorId ?? null,
    actorEmail: actorEmail ?? null,
    action: "announcement.update",
    targetType: "Announcement",
    targetId: announcement.id,
    before: existing,
    after: {
      scope: announcement.scope,
      title: announcement.title,
      description: announcement.description,
      expiresAt: announcement.expiresAt,
    },
  });

  return { ok: true, data: announcement };
}

export async function deleteAnnouncement(
  orgId: string,
  announcementId: string,
  actorId?: string | null,
  actorEmail?: string | null,
): Promise<ServiceResult<null>> {
  const existing = await prisma.announcement.findUnique({
    where: { id: announcementId, orgId },
  });
  if (!existing) {
    return {
      ok: false,
      error: "Announcement not found.",
      code: "NOT_FOUND",
    };
  }

  await prisma.announcement.delete({ where: { id: announcementId } });

  await recordAudit({
    orgId,
    actorId: actorId ?? null,
    actorEmail: actorEmail ?? null,
    action: "announcement.delete",
    targetType: "Announcement",
    targetId: announcementId,
    before: existing,
  });

  return { ok: true, data: null };
}

export async function extendAnnouncementExpiry(
  orgId: string,
  announcementId: string,
  actorId?: string | null,
  actorEmail?: string | null,
): Promise<ServiceResult<AnnouncementRow>> {
  const existing = await prisma.announcement.findUnique({
    where: { id: announcementId, orgId },
  });
  if (!existing) {
    return {
      ok: false,
      error: "Announcement not found.",
      code: "NOT_FOUND",
    };
  }

  const base = existing.expiresAt && existing.expiresAt > new Date() ? existing.expiresAt : new Date();
  const expiresAt = new Date(base);
  expiresAt.setDate(expiresAt.getDate() + 1);

  const announcement = await prisma.announcement.update({
    where: { id: announcementId },
    data: { expiresAt },
  });

  await recordAudit({
    orgId,
    actorId: actorId ?? null,
    actorEmail: actorEmail ?? null,
    action: "announcement.extend_expiry",
    targetType: "Announcement",
    targetId: announcement.id,
    before: existing,
    after: {
      expiresAt: announcement.expiresAt,
    },
  });

  return { ok: true, data: announcement };
}

export async function getAnnouncements(orgId: string, limit = 50) {
  const page = await getAnnouncementsPage(orgId, {
    page: 1,
    pageSize: limit,
    order: "newest",
  });
  return page.announcements;
}

export async function getAnnouncementsPage(
  orgId: string,
  {
    page = 1,
    pageSize = 10,
    order = "newest",
  }: {
    page?: number;
    pageSize?: number;
    order?: AnnouncementOrder;
  } = {},
): Promise<AnnouncementPage> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, parentId: true },
  });
  if (!org) {
    return {
      announcements: [],
      totalCount: 0,
      totalPages: 1,
      page: 1,
      pageSize,
    };
  }

  const franchiseRootId = getFranchiseRootOrgId(org);
  const now = new Date();
  const where = buildVisibleAnnouncementWhere(orgId, franchiseRootId, now);
  const totalCount = await prisma.announcement.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(Math.max(1, Math.floor(page)), totalPages);
  const announcements = await prisma.announcement.findMany({
    where,
    orderBy: [{ createdAt: order === "oldest" ? "asc" : "desc" }],
    skip: (currentPage - 1) * pageSize,
    take: pageSize,
  });

  return { announcements, totalCount, totalPages, page: currentPage, pageSize };
}

export async function getAnnouncementsOrdered(
  orgId: string,
  limit = 50,
  order: AnnouncementOrder = "newest",
) {
  const pageResult = await getAnnouncementsPage(orgId, {
    page: 1,
    pageSize: limit,
    order,
  });
  return pageResult.announcements;
}

export async function getAnnouncementById(
  orgId: string,
  announcementId: string,
) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, parentId: true },
  });
  if (!org) return null;

  const franchiseRootId = getFranchiseRootOrgId(org);
  const now = new Date();
  const where = buildVisibleAnnouncementWhere(orgId, franchiseRootId, now);

  return prisma.announcement.findFirst({
    where: { id: announcementId, AND: where.AND },
  });
}