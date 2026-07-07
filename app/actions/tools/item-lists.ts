"use server";

/**
 * Item-list server actions.
 * Wraps list, entry, and grid mutations behind org permission checks so the
 * client can stay focused on presentation state.
 */

import { revalidatePath } from "next/cache";
import { PermissionAction, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOrgPermissionAction } from "@/lib/authz";
import {
  addToolItemListEntry,
  addToolItemListEntryAtPosition,
  createToolItemList,
  deleteToolItemList,
  duplicateToolItemList,
  moveToolItemListEntry,
  moveToolItemListEntryById,
  removeToolItemListEntry,
  toggleChecklistEntry,
  updateToolItemGridConfig,
  updateToolItemList,
  updateToolItemListEntryAmount,
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

export async function createToolItemListAction(
  orgId: string,
  name: string,
  gridCols?: number,
  gridRows?: number,
) {
  const auth = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_TASKS);
  if (!auth.ok) return { ok: false as const };

  const trimmed = name.trim();
  if (!trimmed) return { ok: false as const, error: "Name is required." };

  const normalizedGridCols = Number.isFinite(gridCols) ? gridCols : 4;
  const normalizedGridRows = Number.isFinite(gridRows) ? gridRows : 4;

  try {
    const list = await prisma.$transaction(async (tx) => {
      const createdList = await createToolItemList(orgId, trimmed, tx);
      await tx.toolItemGridConfig.create({
        data: {
          listId: createdList.id,
          gridCols: normalizedGridCols,
          gridRows: normalizedGridRows,
        },
      });
      return createdList;
    });
    revalidatePath(`/orgs/${orgId}/tools/item-list/lists`);
    return { ok: true as const, list };
  } catch (err: unknown) {
    const mappedError = mapPrismaError(err, {
      P2002: "A set with that name already exists.",
    });
    return { ok: false as const, error: mappedError ?? "Failed to create list." };
  }
}

export async function updateToolItemListAction(
  orgId: string,
  listId: string,
  name: string,
  description?: string | null,
) {
  const auth = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_TASKS);
  if (!auth.ok) return { ok: false as const };
  const trimmed = name.trim();
  if (!trimmed) return { ok: false as const, error: "Name is required." };
  try {
    const result = await updateToolItemList(orgId, listId, { name: trimmed, description: description ?? null });
    if (result.count === 0) {
      return { ok: false as const, error: "List not found." };
    }
    revalidatePath(`/orgs/${orgId}/tools/item-list/lists`);
    return { ok: true as const };
  } catch (err: unknown) {
    const mappedError = mapPrismaError(err, { P2002: "A list with that name already exists." });
    return { ok: false as const, error: mappedError ?? "Failed to update list." };
  }
}

export async function deleteToolItemListAction(orgId: string, listId: string) {
  const auth = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_TASKS);
  if (!auth.ok) return { ok: false as const };
  try {
    await deleteToolItemList(orgId, listId);
    revalidatePath(`/orgs/${orgId}/tools/item-list/lists`);
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "Failed to delete list." };
  }
}

export async function duplicateToolItemListAction(orgId: string, listId: string) {
  const auth = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_TASKS);
  if (!auth.ok) return { ok: false as const };
  try {
    const list = await duplicateToolItemList(orgId, listId);
    revalidatePath(`/orgs/${orgId}/tools/item-list/lists`);
    return { ok: true as const, list };
  } catch {
    return { ok: false as const, error: "Failed to duplicate list." };
  }
}

export async function toggleChecklistEntryAction(
  listEntryId: string,
  listId: string,
  orgId: string,
) {
  const auth = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_TASKS);
  if (!auth.ok) return { ok: false as const };

  try {
    const result = await toggleChecklistEntry(listEntryId);
    revalidatePath(`/orgs/${orgId}/tools/item-list/lists/${listId}`);
    return { ok: true as const, checked: result.checked };
  } catch {
    return { ok: false as const };
  }
}

export async function addToolItemListEntryAction(
  orgId: string,
  listId: string,
  itemId: string,
  amount?: number,
) {
  const auth = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_TASKS);
  if (!auth.ok) return { ok: false as const };

  try {
    const entry = await addToolItemListEntry(listId, itemId, amount ?? 0);
    revalidatePath(`/orgs/${orgId}/tools/item-list/lists/${listId}`);
    return { ok: true as const, entry };
  } catch (err: unknown) {
    const mappedError = mapPrismaError(err, { P2002: "This item is already in the list." });
    return { ok: false as const, error: mappedError ?? "Failed to add item." };
  }
}

export async function addToolItemListEntryAtPositionAction(
  orgId: string,
  listId: string,
  itemId: string,
  position: number,
  amount?: number,
) {
  const auth = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_TASKS);
  if (!auth.ok) return { ok: false as const };

  try {
    const entry = await addToolItemListEntryAtPosition(
      listId,
      itemId,
      position,
      amount ?? 0,
    );
    revalidatePath(`/orgs/${orgId}/tools/item-list/lists/${listId}`);
    return { ok: true as const, entry };
  } catch (err: unknown) {
    const mappedError = mapPrismaError(err, { P2002: "This item is already in the list." });
    return { ok: false as const, error: mappedError ?? "Failed to add item." };
  }
}

export async function moveToolItemListEntryAction(
  orgId: string,
  listId: string,
  fromPosition: number,
  toPosition: number,
) {
  const auth = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_TASKS);
  if (!auth.ok) return { ok: false as const };

  try {
    await moveToolItemListEntry(listId, fromPosition, toPosition);
    revalidatePath(`/orgs/${orgId}/tools/item-list/lists/${listId}`);
    return { ok: true as const };
  } catch {
    return { ok: false as const };
  }
}

export async function moveToolItemListEntryByIdAction(
  orgId: string,
  listId: string,
  entryId: string,
  toPosition: number,
) {
  const auth = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_TASKS);
  if (!auth.ok) return { ok: false as const };

  try {
    await moveToolItemListEntryById(orgId, listId, entryId, toPosition);
    revalidatePath(`/orgs/${orgId}/tools/item-list/lists/${listId}`);
    return { ok: true as const };
  } catch {
    return { ok: false as const };
  }
}

export async function updateToolItemGridConfigAction(
  orgId: string,
  listId: string,
  gridCols: number,
  gridRows: number,
) {
  const auth = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_TASKS);
  if (!auth.ok) return { ok: false as const };

  try {
    await updateToolItemGridConfig(listId, gridCols, gridRows);
    revalidatePath(`/orgs/${orgId}/tools/item-list/lists/${listId}`);
    return { ok: true as const };
  } catch {
    return { ok: false as const };
  }
}

export async function removeToolItemListEntryAction(
  orgId: string,
  listId: string,
  entryId: string,
) {
  const auth = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_TASKS);
  if (!auth.ok) return { ok: false as const };

  try {
    await removeToolItemListEntry(listId, entryId);
    revalidatePath(`/orgs/${orgId}/tools/item-list/lists/${listId}`);
    return { ok: true as const };
  } catch {
    return { ok: false as const };
  }
}

export async function updateToolItemListEntryAmountAction(
  orgId: string,
  listId: string,
  entryId: string,
  amount: number,
) {
  const auth = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_TASKS);
  if (!auth.ok) return { ok: false as const };

  try {
    await updateToolItemListEntryAmount(entryId, amount);
    revalidatePath(`/orgs/${orgId}/tools/item-list/lists/${listId}`);
    return { ok: true as const };
  } catch {
    return { ok: false as const };
  }
}