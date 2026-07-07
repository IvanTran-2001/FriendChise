/**
 * Service layer for conversion tools and shared tool items.
 *
 * All functions scope writes/reads to the owning org via `orgId` to prevent
 * cross-org data access. No auth checks are done here — callers (server
 * actions, API routes) are responsible for permission gating before calling
 * these functions.
 */
import { prisma } from "@/lib/prisma";

/**
 * Conversion service layer.
 * Provides org-scoped reads and writes for conversion sets, tool items, and
 * conversion templates.
 */

// ─── ConversionSet ────────────────────────────────────────────────────────────

export async function getConversionSets(orgId: string) {
  return prisma.conversionSet.findMany({
    where: { orgId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      updatedAt: true,
      _count: { select: { templates: true } },
    },
  });
}

export async function getRecentConversionTemplates(orgId: string, limit = 3) {
  return prisma.conversionTemplate.findMany({
    where: { set: { orgId } },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      name: true,
      updatedAt: true,
      set: { select: { id: true, name: true } },
    },
  });
}

export async function getConversionSet(orgId: string, setId: string) {
  return prisma.conversionSet.findFirst({
    where: { id: setId, orgId },
    select: { id: true, name: true },
  });
}

export async function createConversionSet(orgId: string, name: string) {
  return prisma.conversionSet.create({
    data: { orgId, name },
    select: { id: true, name: true },
  });
}

export async function createConversionSetWithDefault(
  orgId: string,
  name: string,
) {
  return prisma.$transaction(async (tx) => {
    const set = await tx.conversionSet.create({
      data: { orgId, name },
      select: { id: true, name: true },
    });
    await tx.conversionTemplate.create({
      data: { setId: set.id, name: "Default" },
    });
    return set;
  });
}

export async function deleteConversionSet(orgId: string, id: string) {
  await prisma.conversionSet.deleteMany({ where: { id, orgId } });
}

export async function renameConversionSet(
  orgId: string,
  id: string,
  name: string,
) {
  return prisma.conversionSet.updateMany({
    where: { id, orgId },
    data: { name },
  });
}

// ─── ToolItem ─────────────────────────────────────────────────────────────────

export async function getToolItems(orgId: string) {
  return prisma.toolItem.findMany({
    where: { orgId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, unit: true },
  });
}

export async function getToolItemsFull(orgId: string) {
  return prisma.toolItem.findMany({
    where: { orgId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, unit: true, imgUrl: true },
  });
}

export async function getToolItemsPage(
  orgId: string,
  options: { page?: number; pageSize?: number; search?: string } = {},
) {
  const pageSize = Math.max(1, options.pageSize ?? 24);
  const search = options.search?.trim() ?? "";
  const where = search
    ? {
        orgId,
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { unit: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : { orgId };

  const totalCount = await prisma.toolItem.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(Math.max(1, Math.floor(options.page ?? 1)), totalPages);

  const items = await prisma.toolItem.findMany({
    where,
    orderBy: { name: "asc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: { id: true, name: true, unit: true, imgUrl: true },
  });

  return { items, totalCount, totalPages, page, pageSize, search };
}

export async function updateToolItemImageUrl(
  orgId: string,
  id: string,
  imgUrl: string | null,
) {
  await prisma.toolItem.updateMany({ where: { id, orgId }, data: { imgUrl } });
}

export async function createToolItem(
  orgId: string,
  name: string,
  unit: string,
) {
  return prisma.toolItem.create({
    data: { orgId, name, unit },
    select: { id: true, name: true, unit: true },
  });
}

export async function deleteToolItem(orgId: string, id: string) {
  const menuItemCount = await prisma.menuItem.count({ where: { toolItemId: id, menu: { orgId } } });
  if (menuItemCount > 0) {
    throw new Error("Item is used in a menu.");
  }

  await prisma.toolItem.deleteMany({ where: { id, orgId } });
}

export async function updateToolItem(
  orgId: string,
  id: string,
  name: string,
  unit: string,
) {
  await prisma.toolItem.updateMany({
    where: { id, orgId },
    data: { name, unit },
  });
}

// ─── ConversionRate ───────────────────────────────────────────────────────────

export async function getConversionRates(orgId: string, setId: string) {
  return prisma.conversionRate.findMany({
    where: { setId, set: { orgId } },
    select: {
      id: true,
      fromQty: true,
      toQty: true,
      fromItem: { select: { id: true, name: true, unit: true, imgUrl: true } },
      toItem: { select: { id: true, name: true, unit: true, imgUrl: true } },
    },
    orderBy: [{ fromItem: { name: "asc" } }, { toItem: { name: "asc" } }],
  });
}

export async function createConversionRate(
  orgId: string,
  setId: string,
  fromItemId: string,
  toItemId: string,
  fromQty: number,
  toQty: number,
) {
  return prisma.$transaction(async (tx) => {
    const set = await tx.conversionSet.findFirst({
      where: { id: setId, orgId },
      select: { id: true },
    });
    if (!set) throw new Error("Set not found or access denied");

    const items = await tx.toolItem.findMany({
      where: { id: { in: [fromItemId, toItemId] }, orgId },
      select: { id: true },
    });
    if (items.length !== 2) throw new Error("Items not found or access denied");

    return tx.conversionRate.create({
      data: { setId, fromItemId, toItemId, fromQty, toQty },
      select: {
        id: true,
        fromQty: true,
        toQty: true,
        fromItem: { select: { id: true, name: true, unit: true } },
        toItem: { select: { id: true, name: true, unit: true } },
      },
    });
  });
}

export async function deleteConversionRate(orgId: string, rateId: string) {
  await prisma.conversionRate.deleteMany({
    where: { id: rateId, set: { orgId } },
  });
}

export async function updateConversionRate(
  orgId: string,
  rateId: string,
  fromQty: number,
  toQty: number,
) {
  await prisma.conversionRate.updateMany({
    where: { id: rateId, set: { orgId } },
    data: { fromQty, toQty },
  });
}

// ─── ConversionTemplate ───────────────────────────────────────────────────────

export async function getConversionTemplates(orgId: string, setId: string) {
  const templates = await prisma.conversionTemplate.findMany({
    where: { setId, set: { orgId } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return templates.sort((a, b) =>
    a.name === "Default" ? -1 : b.name === "Default" ? 1 : 0,
  );
}

export async function createConversionTemplate(
  setId: string,
  name: string,
  orgId?: string,
) {
  if (orgId) {
    return prisma.$transaction(async (tx) => {
      const set = await tx.conversionSet.findFirst({
        where: { id: setId, orgId },
        select: { id: true },
      });
      if (!set) throw new Error("Set not found or access denied");

      return tx.conversionTemplate.create({
        data: { setId, name },
        select: { id: true, name: true },
      });
    });
  }

  return prisma.conversionTemplate.create({
    data: { setId, name },
    select: { id: true, name: true },
  });
}

export async function duplicateConversionTemplate(
  orgId: string,
  templateId: string,
  newName: string,
) {
  return prisma.$transaction(async (tx) => {
    const source = await tx.conversionTemplate.findFirst({
      where: { id: templateId, set: { orgId } },
      select: {
        setId: true,
        entries: {
          select: { itemId: true, quantity: true, pinnedOutput: true },
        },
      },
    });
    if (!source) throw new Error("Template not found or access denied");

    return tx.conversionTemplate.create({
      data: {
        setId: source.setId,
        name: newName,
        entries: {
          create: source.entries.map((entry) => ({
            itemId: entry.itemId,
            quantity: entry.quantity,
            pinnedOutput: entry.pinnedOutput,
          })),
        },
      },
      select: { id: true, name: true },
    });
  });
}

export async function deleteConversionTemplate(
  orgId: string,
  templateId: string,
) {
  await prisma.conversionTemplate.deleteMany({
    where: { id: templateId, set: { orgId } },
  });
}

export async function renameConversionTemplate(
  orgId: string,
  templateId: string,
  name: string,
) {
  return prisma.conversionTemplate.updateMany({
    where: { id: templateId, set: { orgId } },
    data: { name },
  });
}

// ─── ConversionTemplateEntry ──────────────────────────────────────────────────

export async function getTemplateEntries(orgId: string, templateId: string) {
  const rows = await prisma.conversionTemplateEntry.findMany({
    where: { template: { set: { orgId } }, templateId },
    select: { itemId: true, quantity: true, pinnedOutput: true },
  });
  return rows.map((row) => ({ ...row, pinnedOutput: row.pinnedOutput ?? 0 }));
}

export async function upsertTemplateEntry(
  orgId: string,
  templateId: string,
  itemId: string,
  quantity: number | null,
  pinnedOutput: number,
) {
  return prisma.$transaction(async (tx) => {
    const template = await tx.conversionTemplate.findFirst({
      where: { id: templateId, set: { orgId } },
      select: { id: true },
    });
    if (!template) throw new Error("Template not found or access denied");

    const item = await tx.toolItem.findFirst({
      where: { id: itemId, orgId },
      select: { id: true },
    });
    if (!item) throw new Error("Item not found or access denied");

    return tx.conversionTemplateEntry.upsert({
      where: { templateId_itemId: { templateId, itemId } },
      create: { templateId, itemId, quantity, pinnedOutput },
      update: { quantity, pinnedOutput },
    });
  });
}

export async function deleteTemplateEntry(
  orgId: string,
  templateId: string,
  itemId: string,
) {
  return prisma.$transaction(async (tx) => {
    const template = await tx.conversionTemplate.findFirst({
      where: { id: templateId, set: { orgId } },
      select: { id: true },
    });
    if (!template) throw new Error("Template not found or access denied");

    await tx.conversionTemplateEntry.deleteMany({
      where: { templateId, itemId },
    });
  });
}