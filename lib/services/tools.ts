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
import { prisma } from "@/lib/prisma";

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
      fromItem: { select: { id: true, name: true, unit: true } },
      toItem: { select: { id: true, name: true, unit: true } },
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
  return prisma.conversionTemplate.findMany({
    where: { setId, set: { orgId } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
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
