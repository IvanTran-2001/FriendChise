import { AnnouncementScope, Prisma } from "@prisma/client";
import { prisma } from "@/lib/platform/prisma";
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

export type AnnouncementFeedItem = AnnouncementRow & {
  orgName: string;
  seenAt: Date | null;
};

export type AnnouncementFeedPage = {
  items: AnnouncementFeedItem[];
  totalCount: number;
  totalPages: number;
  page: number;
  pageSize: number;
};

export type CreateAnnouncementInput = {
  title: string;
  description: string;
  scope?: AnnouncementScope;
  expiresAt?: Date | null;
};

type AnnouncementReadRow = {
  seenAt: Date;
};

/**
 * Builds the org-level visibility filter for announcement list queries.
 */
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

/**
 * Returns the set of orgs and franchise roots a user can see announcements for.
 */
async function getVisibleAnnouncementOrgScope(userId: string) {
  const orgs = await prisma.organization.findMany({
    where: {
      OR: [{ ownerId: userId }, { memberships: { some: { userId } } }],
    },
    select: { id: true, parentId: true },
  });

  return {
    orgIds: [...new Set(orgs.map((org) => org.id).filter(Boolean))],
    franchiseRootIds: [...new Set(orgs.map((org) => org.parentId ?? org.id).filter(Boolean))],
  };
}

/**
 * Builds the announcement visibility filter for a user's cross-org feed.
 */
function buildVisibleAnnouncementWhereForUser(
  orgIds: string[],
  franchiseRootIds: string[],
  now: Date,
): Prisma.AnnouncementWhereInput | null {
  const scopes: Prisma.AnnouncementWhereInput[] = [];

  if (orgIds.length > 0) {
    scopes.push({
      scope: AnnouncementScope.ORG,
      orgId: { in: orgIds },
    });
  }

  if (franchiseRootIds.length > 0) {
    scopes.push({
      scope: AnnouncementScope.GLOBAL,
      OR: [
        { orgId: { in: franchiseRootIds } },
        { organization: { parentId: { in: franchiseRootIds } } },
      ],
    });
  }

  if (scopes.length === 0) return null;

  return {
    AND: [
      { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      { OR: scopes },
    ],
  };
}

/**
 * Creates a new announcement for an org and records an audit entry.
 */
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

/**
 * Updates an existing announcement for an org and records an audit entry.
 */
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

/**
 * Deletes an announcement after verifying ownership and records an audit entry.
 */
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

/**
 * Extends an announcement's expiry by one day and records an audit entry.
 */
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

/**
 * Returns a paginated list of announcements visible within an org.
 */
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

/**
 * Returns a paginated list of announcements visible to a user.
 */
export async function getPaginatedAnnouncementHistoryForUser(
  userId: string,
  page: number,
  pageSize: number = 10,
  options: { view?: "all" | "seen" | "unseen" } = {},
): Promise<AnnouncementFeedPage> {
  const { view = "all" } = options;
  const { orgIds, franchiseRootIds } = await getVisibleAnnouncementOrgScope(userId);
  const where = buildVisibleAnnouncementWhereForUser(orgIds, franchiseRootIds, new Date());
  if (!where) {
    return {
      items: [],
      totalCount: 0,
      totalPages: 1,
      page: 1,
      pageSize,
    };
  }

  const historyWhere =
    view === "seen"
      ? {
          AND: [
            where,
            {
              reads: {
                some: { userId },
              },
            },
          ],
        }
      : view === "unseen"
        ? {
            AND: [
              where,
              {
                reads: {
                  none: { userId },
                },
              },
            ],
          }
        : where;
  const totalCount = await prisma.announcement.count({ where: historyWhere });
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(Math.max(1, Math.floor(page)), totalPages);
  const skip = (currentPage - 1) * pageSize;
  const rows = await prisma.announcement.findMany({
    where: historyWhere,
    orderBy: { createdAt: "desc" },
    skip,
    take: pageSize,
    select: {
      id: true,
      orgId: true,
      scope: true,
      title: true,
      description: true,
      expiresAt: true,
      createdAt: true,
      updatedAt: true,
      reads: {
        where: { userId },
        take: 1,
        select: { seenAt: true },
      },
      organization: { select: { name: true } },
    },
  });

  return {
    items: rows.map((row) => ({
      id: row.id,
      orgId: row.orgId,
      orgName: row.organization.name,
      scope: row.scope,
      title: row.title,
      description: row.description,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      seenAt: (row.reads[0] as AnnouncementReadRow | undefined)?.seenAt ?? null,
    })),
    totalCount,
    totalPages,
    page: currentPage,
    pageSize,
  };
}

/**
 * Marks one announcement as seen for the current user.
 */
export async function markAnnouncementSeen(
  userId: string,
  announcementId: string,
): Promise<void> {
  const { orgIds, franchiseRootIds } = await getVisibleAnnouncementOrgScope(userId);
  const where = buildVisibleAnnouncementWhereForUser(orgIds, franchiseRootIds, new Date());
  if (!where) return;

  const announcement = await prisma.announcement.findFirst({
    where: { id: announcementId, AND: where.AND },
    select: { id: true },
  });
  if (!announcement) return;

  const announcementReads = prisma as typeof prisma & {
    announcementRead: {
      upsert: (args: unknown) => Promise<unknown>;
    };
  };

  await announcementReads.announcementRead.upsert({
    where: {
      userId_announcementId: {
        userId,
        announcementId,
      },
    },
    create: {
      userId,
      announcementId,
      seenAt: new Date(),
    },
    update: {
      seenAt: new Date(),
    },
  });
}

/**
 * Returns the count of announcements the user has not seen yet.
 */
export async function getUnseenAnnouncementCount(userId: string): Promise<number> {
  const { orgIds, franchiseRootIds } = await getVisibleAnnouncementOrgScope(userId);
  const where = buildVisibleAnnouncementWhereForUser(orgIds, franchiseRootIds, new Date());
  if (!where) return 0;

  return prisma.announcement.count({
    where: {
      ...where,
      reads: {
        none: { userId },
      },
    },
  });
}

/**
 * Returns a single announcement if it is visible in the requested org scope.
 */
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