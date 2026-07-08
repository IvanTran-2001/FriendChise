"use server";

/**
 * Menu server actions.
 * Keeps the page and sidebar mutations thin by handling permission checks,
 * Prisma calls, and cache revalidation in one place.
 */

import { revalidatePath } from "next/cache";
import { PermissionAction, Prisma } from "@prisma/client";
import { requireOrgPermissionAction } from "@/lib/authz";
import {
  createMenu,
  createMenuTab,
  createMenuItem,
  deleteMenu,
  deleteMenuTab,
  deleteMenuItem,
  duplicateMenu,
  moveMenuTab,
  reorderMenuTabs,
  updateMenu,
  updateMenuTab,
  updateMenuItem,
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

export async function createMenuAction(
  orgId: string,
  name: string,
  description?: string,
) {
  const auth = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_TASKS);
  if (!auth.ok) return { ok: false as const };

  const trimmed = name.trim();
  if (!trimmed) return { ok: false as const, error: "Name is required." };

  try {
    const menu = await createMenu(orgId, trimmed, description?.trim() || null);
    revalidatePath(`/orgs/${orgId}/tools/menu`);
    return { ok: true as const, menu };
  } catch (err: unknown) {
    const mappedError = mapPrismaError(err, {
      P2002: "A menu with that name already exists.",
    });
    return { ok: false as const, error: mappedError ?? "Failed to create menu." };
  }
}

export async function deleteMenuAction(orgId: string, menuId: string) {
  const auth = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_TASKS);
  if (!auth.ok) return { ok: false as const };

  try {
    await deleteMenu(orgId, menuId);
    revalidatePath(`/orgs/${orgId}/tools/menu`);
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "Failed to delete menu." };
  }
}

export async function updateMenuAction(
  orgId: string,
  menuId: string,
  name: string,
  description?: string,
) {
  const auth = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_TASKS);
  if (!auth.ok) return { ok: false as const };

  const trimmed = name.trim();
  if (!trimmed) return { ok: false as const, error: "Name is required." };

  try {
    const menu = await updateMenu(orgId, menuId, trimmed, description?.trim() || null);
    if (!menu) {
      return { ok: false as const, error: "Menu not found." };
    }
    revalidatePath(`/orgs/${orgId}/tools/menu`);
    revalidatePath(`/orgs/${orgId}/tools/menu/${menuId}`);
    return { ok: true as const, menu };
  } catch (err: unknown) {
    const mappedError = mapPrismaError(err, {
      P2002: "A menu with that name already exists.",
    });
    return { ok: false as const, error: mappedError ?? "Failed to update menu." };
  }
}

export async function duplicateMenuAction(orgId: string, menuId: string) {
  const auth = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_TASKS);
  if (!auth.ok) return { ok: false as const };

  try {
    const menu = await duplicateMenu(orgId, menuId);
    revalidatePath(`/orgs/${orgId}/tools/menu`);
    return { ok: true as const, menu };
  } catch {
    return { ok: false as const, error: "Failed to duplicate menu." };
  }
}

export async function createMenuTabAction(
  orgId: string,
  menuId: string,
  name: string,
  description?: string,
) {
  const auth = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_TASKS);
  if (!auth.ok) return { ok: false as const };

  const trimmedName = name.trim();
  if (!trimmedName) return { ok: false as const, error: "Name is required." };

  try {
    const menuTab = await createMenuTab(
      orgId,
      menuId,
      trimmedName,
      description?.trim() || null,
    );

    if (!menuTab) {
      return { ok: false as const, error: "Menu not found." };
    }

    revalidatePath(`/orgs/${orgId}/tools/menu`);
    revalidatePath(`/orgs/${orgId}/tools/menu/${menuId}`);
    return { ok: true as const, menuTab };
  } catch (err: unknown) {
    const mappedError = mapPrismaError(err, {
      P2002: "A category with that name already exists.",
    });
    return { ok: false as const, error: mappedError ?? "Failed to create category." };
  }
}

export async function updateMenuTabAction(
  orgId: string,
  menuId: string,
  tabId: string,
  name: string,
  description?: string,
) {
  const auth = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_TASKS);
  if (!auth.ok) return { ok: false as const };

  const trimmedName = name.trim();
  if (!trimmedName) return { ok: false as const, error: "Name is required." };

  try {
    const menuTab = await updateMenuTab(
      orgId,
      menuId,
      tabId,
      trimmedName,
      description?.trim() || null,
    );

    if (!menuTab) {
      return { ok: false as const, error: "Category not found." };
    }

    revalidatePath(`/orgs/${orgId}/tools/menu`);
    revalidatePath(`/orgs/${orgId}/tools/menu/${menuId}`);
    return { ok: true as const, menuTab };
  } catch (err: unknown) {
    const mappedError = mapPrismaError(err, {
      P2002: "A category with that name already exists.",
    });
    return { ok: false as const, error: mappedError ?? "Failed to update category." };
  }
}

export async function deleteMenuTabAction(orgId: string, menuId: string, tabId: string) {
  const auth = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_TASKS);
  if (!auth.ok) return { ok: false as const };

  try {
    const deleted = await deleteMenuTab(orgId, menuId, tabId);
    if (!deleted) {
      return { ok: false as const, error: "Category not found." };
    }

    revalidatePath(`/orgs/${orgId}/tools/menu`);
    revalidatePath(`/orgs/${orgId}/tools/menu/${menuId}`);
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "Failed to delete category." };
  }
}

export async function moveMenuTabAction(
  orgId: string,
  menuId: string,
  tabId: string,
  direction: "up" | "down",
) {
  const auth = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_TASKS);
  if (!auth.ok) return { ok: false as const };

  try {
    const menuTab = await moveMenuTab(orgId, menuId, tabId, direction);
    if (!menuTab) {
      return { ok: false as const, error: "Category not found." };
    }

    revalidatePath(`/orgs/${orgId}/tools/menu`);
    revalidatePath(`/orgs/${orgId}/tools/menu/${menuId}`);
    return { ok: true as const, menuTab };
  } catch {
    return { ok: false as const, error: "Failed to reorder category." };
  }
}

export async function reorderMenuTabsAction(
  orgId: string,
  menuId: string,
  orderedTabIds: string[],
) {
  const auth = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_TASKS);
  if (!auth.ok) return { ok: false as const };

  try {
    const tabs = await reorderMenuTabs(orgId, menuId, orderedTabIds);
    if (!tabs) {
      return { ok: false as const, error: "Category list not found." };
    }

    revalidatePath(`/orgs/${orgId}/tools/menu`);
    revalidatePath(`/orgs/${orgId}/tools/menu/${menuId}`);
    return { ok: true as const, tabs };
  } catch {
    return { ok: false as const, error: "Failed to reorder categories." };
  }
}

export async function createMenuItemAction(
  orgId: string,
  menuId: string,
  toolItemId: string,
  title: string,
  description?: string,
  price?: number | null,
  calories?: number | null,
  notes?: string | null,
  tabId?: string | null,
  imageUrl?: string | null,
) {
  const auth = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_TASKS);
  if (!auth.ok) return { ok: false as const };

  const trimmedTitle = title.trim();
  if (!trimmedTitle) return { ok: false as const, error: "Title is required." };

  try {
    const menuItem = await createMenuItem(
      orgId,
      menuId,
      toolItemId,
      trimmedTitle,
      description?.trim() || null,
      price ?? null,
      calories ?? null,
      notes?.trim() || null,
      tabId ?? null,
      imageUrl?.trim() || null,
    );

    if (!menuItem) {
      return { ok: false as const, error: "Menu, category, or item not found." };
    }

    revalidatePath(`/orgs/${orgId}/tools/menu`);
    revalidatePath(`/orgs/${orgId}/tools/menu/${menuId}`);
    return { ok: true as const, menuItem };
  } catch (err: unknown) {
    const mappedError = mapPrismaError(err, {
      P2002: "That item already exists in this menu.",
    });
    return { ok: false as const, error: mappedError ?? "Failed to create item." };
  }
}

export async function updateMenuItemAction(
  orgId: string,
  menuId: string,
  menuItemId: string,
  toolItemId: string,
  title: string,
  description?: string,
  price?: number | null,
  calories?: number | null,
  notes?: string | null,
  tabId?: string | null,
  imageUrl?: string | null,
) {
  const auth = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_TASKS);
  if (!auth.ok) return { ok: false as const };

  const trimmedTitle = title.trim();
  if (!trimmedTitle) return { ok: false as const, error: "Title is required." };

  try {
    const menuItem = await updateMenuItem(
      orgId,
      menuId,
      menuItemId,
      toolItemId,
      trimmedTitle,
      description?.trim() || null,
      price ?? null,
      calories ?? null,
      notes?.trim() || null,
      tabId ?? null,
      imageUrl?.trim() || null,
    );

    if (!menuItem) {
      return { ok: false as const, error: "Menu, category, or item not found." };
    }

    revalidatePath(`/orgs/${orgId}/tools/menu`);
    revalidatePath(`/orgs/${orgId}/tools/menu/${menuId}`);
    return { ok: true as const, menuItem };
  } catch (err: unknown) {
    const mappedError = mapPrismaError(err, {
      P2002: "That item already exists in this menu.",
    });
    return { ok: false as const, error: mappedError ?? "Failed to update item." };
  }
}

export async function deleteMenuItemAction(
  orgId: string,
  menuId: string,
  menuItemId: string,
) {
  const auth = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_TASKS);
  if (!auth.ok) return { ok: false as const };

  try {
    const deleted = await deleteMenuItem(orgId, menuId, menuItemId);
    if (!deleted) {
      return { ok: false as const, error: "Menu item not found." };
    }

    revalidatePath(`/orgs/${orgId}/tools/menu`);
    revalidatePath(`/orgs/${orgId}/tools/menu/${menuId}`);
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "Failed to delete item." };
  }
}