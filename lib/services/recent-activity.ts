import { prisma } from "@/lib/prisma";

export const RECENT_ACTIVITY_CATEGORY = {
  TOOLS: "tools",
  ITEM_LISTS: "item-lists",
} as const;

export type RecentActivityCategory =
  (typeof RECENT_ACTIVITY_CATEGORY)[keyof typeof RECENT_ACTIVITY_CATEGORY];

export type RecentActivityInput = {
  orgId: string;
  category: string;
  entityKey: string;
  entityName: string;
  entityHref?: string | null;
  lastUsedAt?: Date;
};

export type RecentActivityRecord = {
  id: string;
  orgId: string;
  category: string;
  entityKey: string;
  entityName: string;
  entityHref: string | null;
  lastUsedAt: Date;
};

export async function recordRecentActivity({
  orgId,
  category,
  entityKey,
  entityName,
  entityHref = null,
  lastUsedAt = new Date(),
}: RecentActivityInput) {
  return prisma.recentActivity.upsert({
    where: {
      orgId_category_entityKey: {
        orgId,
        category,
        entityKey,
      },
    },
    create: {
      orgId,
      category,
      entityKey,
      entityName,
      entityHref,
      lastUsedAt,
    },
    update: {
      entityName,
      entityHref,
      lastUsedAt,
    },
    select: {
      id: true,
      orgId: true,
      category: true,
      entityKey: true,
      entityName: true,
      entityHref: true,
      lastUsedAt: true,
    },
  }) as Promise<RecentActivityRecord>;
}

export async function listRecentActivitiesByCategory(
  orgId: string,
  category: string,
  limit = 10,
): Promise<RecentActivityRecord[]> {
  return prisma.recentActivity.findMany({
    where: { orgId, category },
    orderBy: { lastUsedAt: "desc" },
    take: limit,
    select: {
      id: true,
      orgId: true,
      category: true,
      entityKey: true,
      entityName: true,
      entityHref: true,
      lastUsedAt: true,
    },
  }) as Promise<RecentActivityRecord[]>;
}

export async function listRecentActivitiesByCategories(
  orgId: string,
  categories: string[],
  limit = 10,
): Promise<RecentActivityRecord[]> {
  if (categories.length === 0) return [];

  return prisma.recentActivity.findMany({
    where: { orgId, category: { in: categories } },
    orderBy: { lastUsedAt: "desc" },
    take: limit,
    select: {
      id: true,
      orgId: true,
      category: true,
      entityKey: true,
      entityName: true,
      entityHref: true,
      lastUsedAt: true,
    },
  }) as Promise<RecentActivityRecord[]>;
}
