/**
 * Service layer for the Conversion tool.
 *
 * All functions scope writes/reads to the owning org via `orgId` to prevent
 * cross-org data access. No auth checks are done here — callers (server
 * actions, API routes) are responsible for permission gating before calling
 * these functions.
 *
 * Data model relationships:
 *   ConversionSet  ──< ConversionRate (fromItem → toItem, stored as toQty/fromQty scalar)
 *   ConversionSet  ──< ConversionTemplate ──< ConversionTemplateEntry
 *   ToolItem (org-scoped, shared across all sets)
 */
import { prisma } from "@/lib/platform/prisma";

// ─── ConversionSet ────────────────────────────────────────────────────────────

/** Returns all conversion sets for an org, sorted by name. */
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

/** Returns the N most recently updated templates across all sets for an org. */
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

/** Returns a single conversion set, or `null` if it doesn't exist or belongs to a different org. */
export async function getConversionSet(orgId: string, setId: string) {
  return prisma.conversionSet.findFirst({
    where: { id: setId, orgId },
    select: { id: true, name: true },
  });
}

/** Creates a new conversion set. Does **not** auto-create a Default template — callers must do that. */
export async function createConversionSet(orgId: string, name: string) {
  return prisma.conversionSet.create({
    data: { orgId, name },
    select: { id: true, name: true },
  });
}

/** Creates a new conversion set with a Default template atomically. */
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

/** Deletes a conversion set. Cascades to all its rates and templates via the DB schema. */
export async function deleteConversionSet(orgId: string, id: string) {
  await prisma.conversionSet.deleteMany({ where: { id, orgId } });
}

/** Renames a conversion set. Uses `updateMany` for implicit org-scope safety. */
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

/**
 * Returns all tool items for an org, sorted by name.
 * Items are org-scoped and shared across all ConversionSets — a single item
 * (e.g. "Boston Cream, doz") can appear in rates for any set in the org.
 */
export async function getToolItems(orgId: string) {
  return prisma.toolItem.findMany({
    where: { orgId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, unit: true },
  });
}

/** Returns all tool items for an org with image paths, sorted by name. */
export async function getToolItemsFull(orgId: string) {
  return prisma.toolItem.findMany({
    where: { orgId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, unit: true, imgUrl: true },
  });
}

/** Updates the imgUrl for a tool item. Pass null to clear it. */
export async function updateToolItemImageUrl(
  orgId: string,
  id: string,
  imgUrl: string | null,
) {
  await prisma.toolItem.updateMany({ where: { id, orgId }, data: { imgUrl } });
}

/** Creates a new org-scoped tool item. `unit` is a free-text label (e.g. "dozen", "kg"). */
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

/** Deletes a tool item. Will cascade-fail if the item is referenced by an existing ConversionRate. */
export async function deleteToolItem(orgId: string, id: string) {
  await prisma.toolItem.deleteMany({ where: { id, orgId } });
}

// ─── ToolItemList ─────────────────────────────────────────────────────────────

/** Returns all item lists for an org with entry count, sorted by name. */
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

/** Returns a single list with its entries, items, grid config, and checklist states. */
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

/**
/**
 * Appends a ToolItem to the end of a list (max position + 1).
 * Use addToolItemListEntryAtPosition to insert at a specific grid cell.
 */
export async function addToolItemListEntry(
  orgId: string,
  listId: string,
  itemId: string,
  amount: number = 0,
) {
  const list = await prisma.toolItemList.findFirst({
    where: { id: listId, orgId },
    select: { id: true },
  });
  if (!list) throw new Error("List not found or access denied");

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

/** Inserts a ToolItem at an exact grid cell position. */
export async function addToolItemListEntryAtPosition(
  orgId: string,
  listId: string,
  itemId: string,
  position: number,
  amount: number = 0,
) {
  const list = await prisma.toolItemList.findFirst({
    where: { id: listId, orgId },
    select: { id: true },
  });
  if (!list) throw new Error("List not found or access denied");

  return prisma.toolItemListEntry.create({
    data: { listId, itemId, position, amount },
    include: { item: true, checklistEntry: true },
  });
}

/**
 * Moves a specific entry (by ID) to a new position without swapping.
 * Used when stacking multiple items at the same grid cell position.
 */
export async function moveToolItemListEntryById(
  orgId: string,
  listId: string,
  entryId: string,
  toPosition: number,
) {
  return prisma.$transaction(async (tx) => {
    // Verify entry belongs to the specified list and org
    const entry = await tx.toolItemListEntry.findFirst({
      where: { id: entryId, listId, list: { orgId } },
      select: { id: true },
    });
    if (!entry) {
      throw new Error("Entry not found or access denied");
    }

    return tx.toolItemListEntry.update({
      where: { id: entryId },
      data: { position: toPosition },
      include: { item: true, checklistEntry: true },
    });
  });
}

/**
 * Moves a list entry to a new position.
 * If the target position is occupied, the two entries swap.
 */
export async function moveToolItemListEntry(
  orgId: string,
  listId: string,
  fromPosition: number,
  toPosition: number,
) {
  const list = await prisma.toolItemList.findFirst({
    where: { id: listId, orgId },
    select: { id: true },
  });
  if (!list) throw new Error("List not found or access denied");

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

/** Updates (or creates) the grid config for a list. */
export async function updateToolItemGridConfig(
  orgId: string,
  listId: string,
  gridCols: number,
  gridRows: number,
) {
  if (
    !Number.isInteger(gridCols) ||
    gridCols < 1 ||
    gridCols > 12 ||
    !Number.isInteger(gridRows) ||
    gridRows < 1 ||
    gridRows > 20
  ) {
    throw new Error("Invalid grid dimensions.");
  }

  const list = await prisma.toolItemList.findFirst({
    where: { id: listId, orgId },
    select: { id: true },
  });
  if (!list) throw new Error("List not found or access denied");

  return prisma.toolItemGridConfig.upsert({
    where: { listId },
    update: { gridCols, gridRows },
    create: { listId, gridCols, gridRows },
  });
}

/** Removes a list entry by ID. */
export async function removeToolItemListEntry(
  orgId: string,
  listId: string,
  entryId: string,
) {
  const entry = await prisma.toolItemListEntry.findFirst({
    where: { id: entryId, listId, list: { orgId } },
    select: { id: true },
  });
  if (!entry) throw new Error("Entry not found or access denied");

  return prisma.toolItemListEntry.delete({ where: { id: entryId } });
}

/** Updates the amount on a list entry. */
export async function updateToolItemListEntryAmount(
  orgId: string,
  listId: string,
  entryId: string,
  amount: number,
) {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Invalid amount");
  }

  const entry = await prisma.toolItemListEntry.findFirst({
    where: { id: entryId, listId, list: { orgId } },
    select: { id: true },
  });
  if (!entry) throw new Error("Entry not found or access denied");

  return prisma.toolItemListEntry.update({ where: { id: entryId }, data: { amount } });
}

/** Toggles the checked state of a list entry (existence = checked). Returns new state. */
export async function toggleChecklistEntry(
  orgId: string,
  listId: string,
  listEntryId: string,
): Promise<{ checked: boolean }> {
  const entry = await prisma.toolItemListEntry.findFirst({
    where: { id: listEntryId, listId, list: { orgId } },
    select: { id: true },
  });
  if (!entry) throw new Error("Entry not found or access denied");

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

/**
 * Creates a new ToolItemList for an org.
 * `displayType` is limited to GRID (station layout) or CHECKLIST — TABLE and
 * GALLERY exist in the schema/enum but have no implemented UI yet, so they are
 * not creatable. A gridConfig row is only created for GRID lists.
 */
export async function createToolItemList(
  orgId: string,
  name: string,
  displayType: "GRID" | "CHECKLIST" = "GRID",
  gridCols = 4,
  gridRows = 4,
  description?: string,
) {
  return prisma.$transaction(async (tx) => {
    const list = await tx.toolItemList.create({
      data: { orgId, name, displayType, description: description ?? null },
      select: {
        id: true,
        name: true,
        description: true,
        displayType: true,
        updatedAt: true,
        _count: { select: { entries: true } },
      },
    });

    if (displayType === "GRID") {
      await tx.toolItemGridConfig.create({
        data: {
          listId: list.id,
          gridCols,
          gridRows,
        },
      });
    }

    return list;
  });
}

/** Updates the name and description of a list. */
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

/** Deletes a list and all its entries (cascade handled by DB). */
export async function deleteToolItemList(orgId: string, listId: string) {
  await prisma.toolItemList.deleteMany({ where: { id: listId, orgId } });
}

/**
 * Duplicates a list — copies metadata, gridConfig (if any), and all entries.
 * Returns the new list in the same shape as `getToolItemLists`.
 */
export async function duplicateToolItemList(orgId: string, listId: string) {
  const source = await prisma.toolItemList.findFirst({
    where: { id: listId, orgId },
    include: {
      gridConfig: true,
      entries: { select: { itemId: true, position: true, amount: true } },
    },
  });
  if (!source) throw new Error("List not found.");

  // Find a unique name: "Name (copy)", "Name (copy 2)", etc.
  const base = `${source.name} (copy)`;
  const existing = await prisma.toolItemList.findMany({
    where: { orgId, name: { startsWith: base } },
    select: { name: true },
  });
  const existingNames = new Set(existing.map((l) => l.name));
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
        data: source.entries.map((e) => ({
          listId: newList.id,
          itemId: e.itemId,
          position: e.position,
          amount: e.amount,
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

/** Updates the name and unit of an existing tool item. */
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

/**
 * Returns all rates for a set, with from/to item details inlined.
 * The effective multiplier is `toQty / fromQty`, computed on the fly.
 */
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

/**
 * Creates a directional rate between two items.
 * The stored `rate` value is `toQty / fromQty` — a multiplier applied to a
 * From quantity to produce the equivalent To quantity.
 * The DB unique constraint on `(setId, fromItemId, toItemId)` will throw if
 * a rate for this pair already exists.
 */
export async function createConversionRate(
  orgId: string,
  setId: string,
  fromItemId: string,
  toItemId: string,
  fromQty: number,
  toQty: number,
) {
  return prisma.$transaction(async (tx) => {
    // Verify set belongs to org
    const set = await tx.conversionSet.findFirst({
      where: { id: setId, orgId },
      select: { id: true },
    });
    if (!set) {
      throw new Error("Set not found or access denied");
    }

    // Verify both items belong to org
    const items = await tx.toolItem.findMany({
      where: { id: { in: [fromItemId, toItemId] }, orgId },
      select: { id: true },
    });
    if (items.length !== 2) {
      throw new Error("Items not found or access denied");
    }

    return tx.conversionRate.create({
      data: {
        setId,
        fromItemId,
        toItemId,
        fromQty,
        toQty,
      },
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

/** Deletes a rate. Scoped to the org via a relation filter on `set.orgId`. */
export async function deleteConversionRate(orgId: string, rateId: string) {
  await prisma.conversionRate.deleteMany({
    where: { id: rateId, set: { orgId } },
  });
}

/**
 * Updates fromQty and toQty for an existing conversion rate.
 */
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

/**
 * Returns all templates for a set, sorted by name.
 * Every set has at least one template named "Default" (created automatically
 * by `createConversionSetAction`).
 */
export async function getConversionTemplates(orgId: string, setId: string) {
  const templates = await prisma.conversionTemplate.findMany({
    where: { setId, set: { orgId } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  // Always surface "Default" first
  return templates.sort((a, b) =>
    a.name === "Default" ? -1 : b.name === "Default" ? 1 : 0,
  );
}

/** Creates a new empty template. Names must be unique per set (DB constraint). */
export async function createConversionTemplate(
  setId: string,
  name: string,
  orgId?: string,
) {
  // orgId is optional for backward compatibility (e.g., when creating Default template during set creation)
  if (orgId) {
    return prisma.$transaction(async (tx) => {
      // Verify set belongs to org
      const set = await tx.conversionSet.findFirst({
        where: { id: setId, orgId },
        select: { id: true },
      });
      if (!set) {
        throw new Error("Set not found or access denied");
      }

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

/**
 * Duplicates a template and all its entries into a new template with the given name.
 * Runs in a single transaction so either everything succeeds or nothing changes.
 */
export async function duplicateConversionTemplate(
  orgId: string,
  templateId: string,
  newName: string,
) {
  return prisma.$transaction(async (tx) => {
    // Fetch source template (scoped to org)
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

    const created = await tx.conversionTemplate.create({
      data: {
        setId: source.setId,
        name: newName,
        entries: {
          create: source.entries.map((e) => ({
            itemId: e.itemId,
            quantity: e.quantity,
            pinnedOutput: e.pinnedOutput,
          })),
        },
      },
      select: { id: true, name: true },
    });
    return created;
  });
}

/**
 * Deletes a template and all its entries.
 * The "Default" template guard is enforced in the server action layer, not here.
 */
export async function deleteConversionTemplate(
  orgId: string,
  templateId: string,
) {
  await prisma.conversionTemplate.deleteMany({
    where: { id: templateId, set: { orgId } },
  });
}

/** Renames a conversion template. Uses `updateMany` for implicit org-scope safety. */
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

/**
 * Returns all entries for a template.
 * - `pinnedOutput` encodes which side the item appears on:
 *     1 = from only, 2 = to only, 3 = both from and to
 * - `quantity` is the saved input value for from-side rows; null when to-side only.
 */
export async function getTemplateEntries(orgId: string, templateId: string) {
  const rows = await prisma.conversionTemplateEntry.findMany({
    where: { template: { set: { orgId } }, templateId },
    select: { itemId: true, quantity: true, pinnedOutput: true },
  });
  return rows.map((r) => ({ ...r, pinnedOutput: r.pinnedOutput ?? 0 }));
}

/**
 * Inserts or updates a single entry in a template.
 * @param pinnedOutput  Side flag — 1=from, 2=to, 3=both
 */
export async function upsertTemplateEntry(
  orgId: string,
  templateId: string,
  itemId: string,
  quantity: number | null,
  pinnedOutput: number,
) {
  return prisma.$transaction(async (tx) => {
    // Verify template belongs to org via its set
    const template = await tx.conversionTemplate.findFirst({
      where: { id: templateId, set: { orgId } },
      select: { id: true },
    });
    if (!template) {
      throw new Error("Template not found or access denied");
    }

    // Verify item belongs to org
    const item = await tx.toolItem.findFirst({
      where: { id: itemId, orgId },
      select: { id: true },
    });
    if (!item) {
      throw new Error("Item not found or access denied");
    }

    return tx.conversionTemplateEntry.upsert({
      where: { templateId_itemId: { templateId, itemId } },
      create: { templateId, itemId, quantity, pinnedOutput },
      update: { quantity, pinnedOutput },
    });
  });
}

/** Removes a single item slot from a template (used when the user removes a From or To item). */
export async function deleteTemplateEntry(
  orgId: string,
  templateId: string,
  itemId: string,
) {
  return prisma.$transaction(async (tx) => {
    // Verify template belongs to org via its set
    const template = await tx.conversionTemplate.findFirst({
      where: { id: templateId, set: { orgId } },
      select: { id: true },
    });
    if (!template) {
      throw new Error("Template not found or access denied");
    }

    await tx.conversionTemplateEntry.deleteMany({
      where: { templateId, itemId },
    });
  });
}

export {
  getToolItemsPage,
} from "./tools/conversion";

export {
  getMenus,
  getPublicMenuDetail,
  getMenuItemsPage,
} from "./tools/menus";
