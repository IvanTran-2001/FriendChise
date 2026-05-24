/**
 * Server actions for the Conversion tool.
 *
 * Every action follows the same pattern:
 *   1. Require `MANAGE_TASKS` permission via `requireOrgPermissionAction`.
 *   2. Validate trimmed inputs and return `{ ok: false, error }` on failure.
 *   3. Delegate to `lib/services/tools.ts` for the DB write.
 *   4. Call `revalidatePath` so the Next.js cache reflects the change.
 *
 * Return type is always `{ ok: true, ...payload }` on success or
 * `{ ok: false, error?: string }` on failure — never throws.
 */
"use server";

import { revalidatePath } from "next/cache";
import { PermissionAction, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOrgPermissionAction } from "@/lib/authz";
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

// ─── Error Handling Helpers ──────────────────────────────────────────────────

/**
 * Maps Prisma errors to user-friendly messages.
 * Returns null if the error should be handled with a generic message.
 */
function mapPrismaError(
  err: unknown,
  errorMessages: Record<string, string>,
): string | null {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return errorMessages[err.code] ?? null;
  }
  return null;
}

// ─── ConversionSet ────────────────────────────────────────────────────────────

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

/** Deletes a ConversionSet and all its rates, templates, and entries via DB cascade. */
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

/** Renames a ConversionSet. */
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

// ─── ToolItem ─────────────────────────────────────────────────────────────────

/**
 * Creates a new org-scoped ToolItem (ingredient + unit pair).
 * Items are shared across all ConversionSets in the org.
 * Returns the created item on success so the client can add it to local state.
 */
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

/** Updates the name and unit of an existing tool item. */
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

/** Deletes a tool item by ID. Will fail if the item is used in any ConversionRate. */
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
      error: mappedError ?? "Failed to delete item.",
    };
  }
}

// ─── ConversionRate ───────────────────────────────────────────────────────────

/**
 * Creates a directional rate between two items in a set.
 * Validates that:
 *   - Both quantities are > 0
 *   - From and To items are different
 * The DB unique constraint on (setId, fromItemId, toItemId) causes a throw if
 * the pair already exists — caught and returned as a friendly error.
 * Returns the full rate with item details on success.
 */
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

/** Deletes a single conversion rate by ID. Requires `setId` only for cache revalidation. */
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

/** Updates the rate scalar for an existing conversion rate pair. */
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

// ─── ConversionTemplate ───────────────────────────────────────────────────────

/**
 * Creates a new (empty) template in a set.
 * The DB unique constraint on (setId, name) causes a throw if a template with
 * the same name already exists — caught and returned as a friendly error.
 * Returns the created template so the client can switch to it immediately.
 */
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

/**
 * Deletes a template and all its entries.
 * The "Default" template is protected — attempting to delete it returns an error
 * without hitting the DB.
 */
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

/**
 * Renames an existing template. Protects "Default" from being renamed.
 */
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

/**
 * Duplicates an existing template (name + all entries) under a new name.
 * Returns the new template so the client can switch to it immediately.
 */
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
    const template = await duplicateConversionTemplate(
      orgId,
      templateId,
      trimmed,
    );
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

// ─── ConversionTemplateEntry ──────────────────────────────────────────────────

/**
 * Inserts or updates a single item slot in a template.
 * @param pinnedOutput  Side flag — 1=from, 2=to, 3=both
 */
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
    await upsertTemplateEntry(
      orgId,
      templateId,
      itemId,
      quantity,
      pinnedOutput,
    );
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

/**
 * Removes a single item slot from a template.
 * Called when the user clicks the × button on a From or To item in the calculator.
 */
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
