"use server";

/**
 * Conversion server actions.
 * Handles conversion-set, tool-item, rate, and template mutations with org
 * permission checks and cache revalidation.
 */

import { revalidatePath } from "next/cache";
import { PermissionAction, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOrgPermissionAction } from "@/lib/authz";
import { renameToolItemImageIfNeeded } from "@/lib/services/images";
import {
  createConversionSetWithDefault,
  deleteConversionSet,
  renameConversionSet,
  createToolItem,
  updateToolItem,
  deleteToolItem,
  createConversionRate,
  deleteConversionRate,
  updateConversionRate,
  createConversionTemplate,
  deleteConversionTemplate,
  renameConversionTemplate,
  duplicateConversionTemplate,
  upsertTemplateEntry,
  deleteTemplateEntry,
} from "@/lib/services/tools";

function mapPrismaError(
  err: unknown,
  errorMessages: Record<string, string>,
): string | null {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return errorMessages[err.code] ?? null;
  }
  return null;
}

/**
 * Creates a new ConversionSet and automatically creates a "Default" template
 * for it. Navigating to the set page will land on this Default template.
 */
export async function createConversionSetAction(orgId: string, name: string) {
  const auth = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TASKS,
  );
  if (!auth.ok) return { ok: false as const };

  const trimmed = name.trim();
  if (!trimmed) return { ok: false as const, error: "Name is required." };

  try {
    await createConversionSetWithDefault(orgId, trimmed);
    revalidatePath(`/orgs/${orgId}/tools/conversion`);
    return { ok: true as const };
  } catch (err: unknown) {
    const mappedError = mapPrismaError(err, {
      P2002: "A set with that name already exists.",
    });
    return {
      ok: false as const,
      error: mappedError ?? "Failed to create set.",
    };
  }
}

export async function deleteConversionSetAction(orgId: string, id: string) {
  const auth = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TASKS,
  );
  if (!auth.ok) return { ok: false as const };

  try {
    await deleteConversionSet(orgId, id);
    revalidatePath(`/orgs/${orgId}/tools/conversion`);
    return { ok: true as const };
  } catch (err: unknown) {
    const mappedError = mapPrismaError(err, {
      P2025: "Set not found.",
    });
    return {
      ok: false as const,
      error: mappedError ?? "Failed to delete set.",
    };
  }
}

export async function renameConversionSetAction(
  orgId: string,
  id: string,
  name: string,
) {
  const auth = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TASKS,
  );
  if (!auth.ok) return { ok: false as const };

  const trimmed = name.trim();
  if (!trimmed) return { ok: false as const, error: "Name is required." };

  try {
    await renameConversionSet(orgId, id, trimmed);
    revalidatePath(`/orgs/${orgId}/tools/conversion`);
    return { ok: true as const };
  } catch (err: unknown) {
    const mappedError = mapPrismaError(err, {
      P2002: "A set with that name already exists.",
      P2025: "Set not found.",
    });
    return {
      ok: false as const,
      error: mappedError ?? "Failed to rename set.",
    };
  }
}

export async function createToolItemAction(
  orgId: string,
  name: string,
  unit: string,
) {
  const auth = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TASKS,
  );
  if (!auth.ok) return { ok: false as const };

  const trimmedName = name.trim();
  const trimmedUnit = unit.trim();
  if (!trimmedName) return { ok: false as const, error: "Name is required." };
  if (!trimmedUnit) return { ok: false as const, error: "Unit is required." };

  try {
    const item = await createToolItem(orgId, trimmedName, trimmedUnit);
    revalidatePath(`/orgs/${orgId}/tools/conversion`);
    return { ok: true as const, item };
  } catch (err: unknown) {
    const mappedError = mapPrismaError(err, {
      P2002: "An item with that name already exists.",
    });
    return {
      ok: false as const,
      error: mappedError ?? "Failed to create item.",
    };
  }
}

export async function updateToolItemAction(
  orgId: string,
  id: string,
  name: string,
  unit: string,
) {
  const auth = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TASKS,
  );
  if (!auth.ok) return { ok: false as const };

  const trimmedName = name.trim();
  const trimmedUnit = unit.trim();
  if (!trimmedName) return { ok: false as const, error: "Name is required." };
  if (!trimmedUnit) return { ok: false as const, error: "Unit is required." };

  try {
    await updateToolItem(orgId, id, trimmedName, trimmedUnit);
    try {
      await renameToolItemImageIfNeeded(orgId, id);
    } catch (renameErr) {
      console.error("Failed to rename tool item image in updateToolItemAction:", renameErr);
    }
    revalidatePath(`/orgs/${orgId}/tools/conversion`);
    return { ok: true as const };
  } catch (err: unknown) {
    const mappedError = mapPrismaError(err, {
      P2002: "An item with that name already exists.",
      P2025: "Item not found.",
    });
    return {
      ok: false as const,
      error: mappedError ?? "Failed to update item.",
    };
  }
}

export async function deleteToolItemAction(orgId: string, id: string) {
  const auth = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TASKS,
  );
  if (!auth.ok) return { ok: false as const };

  try {
    await deleteToolItem(orgId, id);
    revalidatePath(`/orgs/${orgId}/tools/conversion`);
    return { ok: true as const };
  } catch (err: unknown) {
    const mappedError = mapPrismaError(err, {
      P2003: "Cannot delete an item that is used in a conversion rate.",
      P2025: "Item not found.",
    });
    return {
      ok: false as const,
      error:
        mappedError ??
        (err instanceof Error && err.message === "Item is used in a menu."
          ? "Cannot delete an item that is used in a menu."
          : "Failed to delete item."),
    };
  }
}

export async function createConversionRateAction(
  orgId: string,
  setId: string,
  fromItemId: string,
  toItemId: string,
  fromQty: number,
  toQty: number,
) {
  const auth = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TASKS,
  );
  if (!auth.ok) return { ok: false as const };

  if (!Number.isFinite(fromQty) || fromQty <= 0)
    return {
      ok: false as const,
      error: "From quantity must be a finite number greater than 0.",
    };
  if (!Number.isFinite(toQty) || toQty <= 0)
    return {
      ok: false as const,
      error: "To quantity must be a finite number greater than 0.",
    };
  if (fromItemId === toItemId)
    return {
      ok: false as const,
      error: "From and To items must be different.",
    };

  try {
    const rate = await createConversionRate(
      orgId,
      setId,
      fromItemId,
      toItemId,
      fromQty,
      toQty,
    );
    revalidatePath(`/orgs/${orgId}/tools/conversion/${setId}`);
    return { ok: true as const, rate };
  } catch (err: unknown) {
    const mappedError = mapPrismaError(err, {
      P2002: "Rate already exists for this item pair.",
      P2003: "Invalid item or set reference.",
    });
    return {
      ok: false as const,
      error: mappedError ?? "Failed to create rate.",
    };
  }
}

export async function deleteConversionRateAction(
  orgId: string,
  setId: string,
  rateId: string,
) {
  const auth = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TASKS,
  );
  if (!auth.ok) return { ok: false as const };

  try {
    await deleteConversionRate(orgId, rateId);
    revalidatePath(`/orgs/${orgId}/tools/conversion/${setId}`);
    return { ok: true as const };
  } catch (err: unknown) {
    const mappedError = mapPrismaError(err, {
      P2025: "Rate not found.",
    });
    return {
      ok: false as const,
      error: mappedError ?? "Failed to delete rate.",
    };
  }
}

export async function updateConversionRateAction(
  orgId: string,
  setId: string,
  rateId: string,
  fromQty: number,
  toQty: number,
) {
  const auth = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TASKS,
  );
  if (!auth.ok) return { ok: false as const };

  if (!Number.isFinite(fromQty) || fromQty <= 0)
    return { ok: false as const, error: "From quantity must be > 0." };
  if (!Number.isFinite(toQty) || toQty <= 0)
    return { ok: false as const, error: "To quantity must be > 0." };

  try {
    await updateConversionRate(orgId, rateId, fromQty, toQty);
    revalidatePath(`/orgs/${orgId}/tools/conversion/${setId}`);
    return { ok: true as const, fromQty, toQty };
  } catch (err: unknown) {
    const mappedError = mapPrismaError(err, {
      P2025: "Rate not found.",
    });
    return {
      ok: false as const,
      error: mappedError ?? "Failed to update rate.",
    };
  }
}

export async function createConversionTemplateAction(
  orgId: string,
  setId: string,
  name: string,
) {
  const auth = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TASKS,
  );
  if (!auth.ok) return { ok: false as const };

  const trimmed = name.trim();
  if (!trimmed) return { ok: false as const, error: "Name is required." };

  try {
    const template = await createConversionTemplate(setId, trimmed, orgId);
    revalidatePath(`/orgs/${orgId}/tools/conversion/${setId}`);
    return { ok: true as const, template };
  } catch (err: unknown) {
    const mappedError = mapPrismaError(err, {
      P2002: "A template with that name already exists.",
      P2003: "Set not found.",
    });
    return {
      ok: false as const,
      error: mappedError ?? "Failed to create template.",
    };
  }
}

export async function deleteConversionTemplateAction(
  orgId: string,
  setId: string,
  templateId: string,
) {
  const auth = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TASKS,
  );
  if (!auth.ok) return { ok: false as const };

  try {
    const template = await prisma.conversionTemplate.findFirst({
      where: { id: templateId, set: { orgId } },
      select: { name: true },
    });
    if (template?.name === "Default") {
      return {
        ok: false as const,
        error: "The Default template cannot be deleted.",
      };
    }

    await deleteConversionTemplate(orgId, templateId);
    revalidatePath(`/orgs/${orgId}/tools/conversion/${setId}`);
    return { ok: true as const };
  } catch (err: unknown) {
    const mappedError = mapPrismaError(err, {
      P2025: "Template not found.",
    });
    return {
      ok: false as const,
      error: mappedError ?? "Failed to delete template.",
    };
  }
}

export async function renameConversionTemplateAction(
  orgId: string,
  setId: string,
  templateId: string,
  name: string,
) {
  const auth = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TASKS,
  );
  if (!auth.ok) return { ok: false as const };

  const trimmed = name.trim();
  if (!trimmed) return { ok: false as const, error: "Name is required." };

  try {
    const template = await prisma.conversionTemplate.findFirst({
      where: { id: templateId, set: { orgId } },
      select: { name: true },
    });
    if (template?.name === "Default") {
      return {
        ok: false as const,
        error: "The Default template cannot be renamed.",
      };
    }

    await renameConversionTemplate(orgId, templateId, trimmed);
    revalidatePath(`/orgs/${orgId}/tools/conversion/${setId}`);
    return { ok: true as const, name: trimmed };
  } catch (err: unknown) {
    const mappedError = mapPrismaError(err, {
      P2002: "A template with that name already exists.",
    });
    return {
      ok: false as const,
      error: mappedError ?? "Failed to rename template.",
    };
  }
}

export async function duplicateConversionTemplateAction(
  orgId: string,
  setId: string,
  templateId: string,
  newName: string,
) {
  const auth = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TASKS,
  );
  if (!auth.ok) return { ok: false as const };

  const trimmed = newName.trim();
  if (!trimmed) return { ok: false as const, error: "Name is required." };

  try {
    const template = await duplicateConversionTemplate(orgId, templateId, trimmed);
    revalidatePath(`/orgs/${orgId}/tools/conversion/${setId}`);
    return { ok: true as const, template };
  } catch (err: unknown) {
    const mappedError = mapPrismaError(err, {
      P2002: "A template with that name already exists.",
    });
    return {
      ok: false as const,
      error: mappedError ?? "Failed to duplicate template.",
    };
  }
}

export async function upsertTemplateEntryAction(
  orgId: string,
  templateId: string,
  itemId: string,
  quantity: number | null,
  pinnedOutput: number,
) {
  const auth = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TASKS,
  );
  if (!auth.ok) return { ok: false as const };

  if (![1, 2, 3].includes(pinnedOutput)) {
    return { ok: false as const, error: "pinnedOutput must be 1, 2, or 3." };
  }
  if (quantity !== null && (!Number.isInteger(quantity) || quantity < 0)) {
    return {
      ok: false as const,
      error: "quantity must be null or a non-negative integer.",
    };
  }

  try {
    await upsertTemplateEntry(orgId, templateId, itemId, quantity, pinnedOutput);
    return { ok: true as const };
  } catch (err: unknown) {
    const mappedError = mapPrismaError(err, {
      P2003: "Invalid template or item reference.",
      P2025: "Template not found.",
    });
    return {
      ok: false as const,
      error: mappedError ?? "Failed to update entry.",
    };
  }
}

export async function removeTemplateEntryAction(
  orgId: string,
  templateId: string,
  itemId: string,
) {
  const auth = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TASKS,
  );
  if (!auth.ok) return { ok: false as const };

  try {
    await deleteTemplateEntry(orgId, templateId, itemId);
    return { ok: true as const };
  } catch (err: unknown) {
    const mappedError = mapPrismaError(err, {
      P2025: "Entry not found.",
    });
    return {
      ok: false as const,
      error: mappedError ?? "Failed to delete entry.",
    };
  }
}

export async function getListPreviewAction(orgId: string, listId: string) {
  const auth = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TASKS,
  );
  if (!auth.ok) return { ok: false as const };

  try {
    const entries = await prisma.toolItemListEntry.findMany({
      where: { listId, list: { orgId } },
      select: {
        itemId: true,
        amount: true,
        item: { select: { id: true, name: true, unit: true } },
      },
    });

    const sumByItem = new Map<
      string,
      { name: string; unit: string; quantity: number }
    >();
    for (const entry of entries) {
      const existing = sumByItem.get(entry.itemId);
      if (existing) existing.quantity += entry.amount;
      else {
        sumByItem.set(entry.itemId, {
          name: entry.item.name,
          unit: entry.item.unit,
          quantity: entry.amount,
        });
      }
    }

    const items = Array.from(sumByItem.entries()).map(([id, value]) => ({
      id,
      ...value,
    }));
    return { ok: true as const, items };
  } catch (err: unknown) {
    const mappedError = mapPrismaError(err, {
      P2025: "List not found.",
    });
    return {
      ok: false as const,
      error: mappedError ?? "Failed to load list preview.",
    };
  }
}

export async function applyListToTemplateAction(
  orgId: string,
  setId: string,
  templateId: string,
  listId: string,
  mode: "replace" | "add",
) {
  const auth = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TASKS,
  );
  if (!auth.ok) return { ok: false as const };

  try {
    const template = await prisma.conversionTemplate.findFirst({
      where: { id: templateId, set: { orgId, id: setId } },
      select: { id: true },
    });
    if (!template) return { ok: false as const, error: "Template not found." };

    const listEntries = await prisma.toolItemListEntry.findMany({
      where: { listId, list: { orgId } },
      select: { itemId: true, amount: true },
    });
    if (listEntries.length === 0)
      return { ok: false as const, error: "List has no items." };

    const sumByItem = new Map<string, number>();
    for (const entry of listEntries) {
      sumByItem.set(entry.itemId, (sumByItem.get(entry.itemId) ?? 0) + entry.amount);
    }

    await prisma.$transaction(async (tx) => {
      if (mode === "replace") {
        await tx.conversionTemplateEntry.deleteMany({
          where: { templateId, pinnedOutput: 1 },
        });
        await tx.conversionTemplateEntry.updateMany({
          where: { templateId, pinnedOutput: 3 },
          data: { pinnedOutput: 2, quantity: null },
        });
        for (const [itemId, quantity] of sumByItem) {
          await tx.conversionTemplateEntry.upsert({
            where: { templateId_itemId: { templateId, itemId } },
            create: { templateId, itemId, quantity, pinnedOutput: 1 },
            update: { quantity, pinnedOutput: 3 },
          });
        }
      } else {
        for (const [itemId, quantity] of sumByItem) {
          const existing = await tx.conversionTemplateEntry.findUnique({
            where: { templateId_itemId: { templateId, itemId } },
          });
          if (existing) {
            const prevQty = existing.pinnedOutput & 1 ? (existing.quantity ?? 0) : 0;
            await tx.conversionTemplateEntry.update({
              where: { templateId_itemId: { templateId, itemId } },
              data: {
                quantity: prevQty + quantity,
                pinnedOutput: existing.pinnedOutput | 1,
              },
            });
          } else {
            await tx.conversionTemplateEntry.create({
              data: { templateId, itemId, quantity, pinnedOutput: 1 },
            });
          }
        }
      }
    });

    revalidatePath(`/orgs/${orgId}/tools/conversion/${setId}`);
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "Failed to apply list." };
  }
}