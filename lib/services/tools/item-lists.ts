import { prisma } from "@/lib/prisma";

/**
 * Item-list service layer.
 * Encapsulates the list, entry, and grid-configuration persistence used by
 * the item-list tool pages and API route.
 */
import type { Prisma } from "@prisma/client";

type ToolItemListClient = Pick<Prisma.TransactionClient, "toolItemList">;

export async function getToolItemLists(orgId: string) {
  return prisma.toolItemList.findMany({
    where: { orgId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      displayType: true,
      updatedAt: true,
      _count: { select: { entries: true } },
    },
  });
}

export async function getToolItemListDetail(listId: string, orgId: string) {
  return prisma.toolItemList.findUnique({
    where: { id: listId, orgId },
    include: {
      gridConfig: true,
      entries: {
        include: {
          item: true,
          checklistEntry: true,
        },
        orderBy: [{ position: "asc" }, { id: "asc" }],
      },
    },
  });
}

export async function addToolItemListEntry(
  listId: string,
  itemId: string,
  amount: number = 0,
) {
  const last = await prisma.toolItemListEntry.findFirst({
    where: { listId },
    select: { position: true },
    orderBy: { position: "desc" },
  });
  const position = last ? last.position + 1 : 0;

  return prisma.toolItemListEntry.create({
    data: { listId, itemId, position, amount },
    include: { item: true, checklistEntry: true },
  });
}

export async function addToolItemListEntryAtPosition(
  listId: string,
  itemId: string,
  position: number,
  amount: number = 0,
) {
  return prisma.toolItemListEntry.create({
    data: { listId, itemId, position, amount },
    include: { item: true, checklistEntry: true },
  });
}

export async function moveToolItemListEntryById(
  orgId: string,
  listId: string,
  entryId: string,
  toPosition: number,
) {
  return prisma.$transaction(async (tx) => {
    const entry = await tx.toolItemListEntry.findFirst({
      where: { id: entryId, listId, list: { orgId } },
      select: { id: true },
    });
    if (!entry) throw new Error("Entry not found or access denied");

    return tx.toolItemListEntry.update({
      where: { id: entryId },
      data: { position: toPosition },
      include: { item: true, checklistEntry: true },
    });
  });
}

export async function moveToolItemListEntry(
  listId: string,
  fromPosition: number,
  toPosition: number,
) {
  const [from, to] = await Promise.all([
    prisma.toolItemListEntry.findFirst({
      where: { listId, position: fromPosition },
      select: { id: true },
    }),
    prisma.toolItemListEntry.findFirst({
      where: { listId, position: toPosition },
      select: { id: true },
    }),
  ]);

  if (!from) return;

  if (to) {
    await prisma.$transaction([
      prisma.toolItemListEntry.update({
        where: { id: from.id },
        data: { position: toPosition },
      }),
      prisma.toolItemListEntry.update({
        where: { id: to.id },
        data: { position: fromPosition },
      }),
    ]);
  } else {
    await prisma.toolItemListEntry.update({
      where: { id: from.id },
      data: { position: toPosition },
    });
  }
}

export async function updateToolItemGridConfig(
  listId: string,
  gridCols: number,
  gridRows: number,
) {
  return prisma.toolItemGridConfig.upsert({
    where: { listId },
    update: { gridCols, gridRows },
    create: { listId, gridCols, gridRows },
  });
}

export async function removeToolItemListEntry(listId: string, entryId: string) {
  return prisma.toolItemListEntry.delete({
    where: { id: entryId, listId },
  });
}

export async function updateToolItemListEntryAmount(
  entryId: string,
  amount: number,
) {
  return prisma.toolItemListEntry.update({
    where: { id: entryId },
    data: { amount },
  });
}

export async function toggleChecklistEntry(
  listEntryId: string,
): Promise<{ checked: boolean }> {
  const existing = await prisma.toolItemChecklistEntry.findUnique({
    where: { listEntryId },
  });
  if (existing) {
    await prisma.toolItemChecklistEntry.delete({ where: { listEntryId } });
    return { checked: false };
  }
  await prisma.toolItemChecklistEntry.create({ data: { listEntryId } });
  return { checked: true };
}

export async function createToolItemList(
  orgId: string,
  name: string,
  client: ToolItemListClient = prisma,
  description?: string,
) {
  return client.toolItemList.create({
    data: { orgId, name, displayType: "GRID", description: description ?? null },
    select: {
      id: true,
      name: true,
      description: true,
      displayType: true,
      updatedAt: true,
      _count: { select: { entries: true } },
    },
  });
}

export async function updateToolItemList(
  orgId: string,
  listId: string,
  data: { name?: string; description?: string | null },
) {
  return prisma.toolItemList.updateMany({
    where: { id: listId, orgId },
    data,
  });
}

export async function deleteToolItemList(orgId: string, listId: string) {
  await prisma.toolItemList.deleteMany({ where: { id: listId, orgId } });
}

export async function duplicateToolItemList(orgId: string, listId: string) {
  const source = await prisma.toolItemList.findFirst({
    where: { id: listId, orgId },
    include: {
      gridConfig: true,
      entries: { select: { itemId: true, position: true, amount: true } },
    },
  });
  if (!source) throw new Error("List not found.");

  const base = `${source.name} (copy)`;
  const existing = await prisma.toolItemList.findMany({
    where: { orgId, name: { startsWith: base } },
    select: { name: true },
  });
  const existingNames = new Set(existing.map((list) => list.name));
  let candidateName = base;
  let n = 2;
  while (existingNames.has(candidateName)) {
    candidateName = `${base} ${n++}`;
  }

  return prisma.$transaction(async (tx) => {
    const newList = await tx.toolItemList.create({
      data: {
        orgId,
        name: candidateName,
        description: source.description,
        displayType: source.displayType,
      },
    });
    if (source.gridConfig) {
      await tx.toolItemGridConfig.create({
        data: {
          listId: newList.id,
          gridCols: source.gridConfig.gridCols,
          gridRows: source.gridConfig.gridRows,
        },
      });
    }
    if (source.entries.length > 0) {
      await tx.toolItemListEntry.createMany({
        data: source.entries.map((entry) => ({
          listId: newList.id,
          itemId: entry.itemId,
          position: entry.position,
          amount: entry.amount,
        })),
      });
    }
    return tx.toolItemList.findUniqueOrThrow({
      where: { id: newList.id },
      select: {
        id: true,
        name: true,
        description: true,
        displayType: true,
        updatedAt: true,
        _count: { select: { entries: true } },
      },
    });
  });
}