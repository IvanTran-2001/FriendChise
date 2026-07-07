import { prisma } from "@/lib/prisma";

/**
 * Menu service layer.
 * Encapsulates all menu, category, and item persistence so the UI can share
 * the same data shape across lists, cards, edit forms, and sidebar panels.
 */

type MenuSummary = {
  id: string;
  name: string;
  description: string | null;
  updatedAt: Date;
  _count: { tabs: number; items: number };
};

export type MenuItemDetail = {
  id: string;
  toolItemId: string;
  title: string;
  description: string | null;
  price: number | null;
  calories: number | null;
  notes: string | null;
  imageUrl: string | null;
  toolItem: {
    id: string;
    name: string;
    unit: string;
    imgUrl: string | null;
  };
};

export type ToolItemOption = {
  id: string;
  name: string;
  unit: string;
  imgUrl: string | null;
};

export type MenuTabPlacementDetail = {
  id: string;
  position: number;
  menuItemId: string;
  menuItem: MenuItemDetail;
};

export type MenuTabDetail = {
  id: string;
  name: string;
  description: string | null;
  position: number;
  placements: MenuTabPlacementDetail[];
};

export type MenuDetail = {
  id: string;
  name: string;
  description: string | null;
  updatedAt: Date;
  items: MenuItemDetail[];
  tabs: MenuTabDetail[];
};

export type MenusPage = {
  menus: MenuSummary[];
  totalCount: number;
  totalPages: number;
  page: number;
  pageSize: number;
  search: string;
};

const menuItemSelect = {
  id: true,
  toolItemId: true,
  title: true,
  description: true,
  price: true,
  calories: true,
  notes: true,
  imageUrl: true,
  toolItem: {
    select: {
      id: true,
      name: true,
      unit: true,
      imgUrl: true,
    },
  },
} as const;

export async function getMenus(
  orgId: string,
  options: { page?: number; pageSize?: number; search?: string } = {},
): Promise<MenusPage> {
  const pageSize = Math.max(1, options.pageSize ?? 12);
  const search = options.search?.trim() ?? "";
  const where = search
    ? {
        orgId,
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { description: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : { orgId };

  const totalCount = await prisma.menu.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(Math.max(1, Math.floor(options.page ?? 1)), totalPages);

  const menus = await prisma.menu.findMany({
    where,
    orderBy: { name: "asc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      name: true,
      description: true,
      updatedAt: true,
      _count: { select: { tabs: true, items: true } },
    },
  });

  return { menus, totalCount, totalPages, page, pageSize, search };
}

export async function getMenuDetail(
  orgId: string,
  menuId: string,
): Promise<MenuDetail | null> {
  return prisma.menu.findFirst({
    where: { id: menuId, orgId },
    select: {
      id: true,
      name: true,
      description: true,
      updatedAt: true,
      items: {
        orderBy: { title: "asc" },
        select: {
          id: true,
          toolItemId: true,
          title: true,
          description: true,
          price: true,
          calories: true,
          notes: true,
          imageUrl: true,
          toolItem: {
            select: {
              id: true,
              name: true,
              unit: true,
              imgUrl: true,
            },
          },
        },
      },
      tabs: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
          position: true,
          placements: {
            orderBy: { position: "asc" },
            select: {
              id: true,
              position: true,
              menuItemId: true,
              menuItem: {
                select: {
                  id: true,
                  toolItemId: true,
                  title: true,
                  description: true,
                  price: true,
                  calories: true,
                  notes: true,
                  imageUrl: true,
                  toolItem: {
                    select: {
                      id: true,
                      name: true,
                      unit: true,
                      imgUrl: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
}

export async function createMenu(
  orgId: string,
  name: string,
  description?: string | null,
) {
  return prisma.menu.create({
    data: { orgId, name, description: description ?? null },
    select: {
      id: true,
      name: true,
      description: true,
      updatedAt: true,
      _count: { select: { tabs: true, items: true } },
    },
  }) as Promise<MenuSummary>;
}

export async function updateMenu(
  orgId: string,
  menuId: string,
  name: string,
  description?: string | null,
) {
  await prisma.menu.updateMany({
    where: { id: menuId, orgId },
    data: { name, description: description ?? null },
  });

  return prisma.menu.findFirst({
    where: { id: menuId, orgId },
    select: {
      id: true,
      name: true,
      description: true,
      updatedAt: true,
      _count: { select: { tabs: true, items: true } },
    },
  }) as Promise<MenuSummary | null>;
}

export async function deleteMenu(orgId: string, menuId: string) {
  await prisma.menu.deleteMany({ where: { id: menuId, orgId } });
}

export async function duplicateMenu(orgId: string, menuId: string) {
  const source = await prisma.menu.findFirst({
    where: { id: menuId, orgId },
    include: {
      tabs: {
        orderBy: { position: "asc" },
        include: {
          placements: {
            orderBy: { position: "asc" },
            include: {
              menuItem: { select: { toolItemId: true } },
            },
          },
        },
      },
      items: {
        select: {
          toolItemId: true,
          title: true,
          description: true,
          price: true,
          calories: true,
          notes: true,
          imageUrl: true,
        },
      },
    },
  });
  if (!source) throw new Error("Menu not found.");

  const base = `${source.name} (copy)`;
  const existing = await prisma.menu.findMany({
    where: { orgId, name: { startsWith: base } },
    select: { name: true },
  });
  const existingNames = new Set(existing.map((menu) => menu.name));
  let candidateName = base;
  let suffix = 2;
  while (existingNames.has(candidateName)) {
    candidateName = `${base} ${suffix++}`;
  }

  return prisma.$transaction(async (tx) => {
    const menu = await tx.menu.create({
      data: { orgId, name: candidateName, description: source.description },
      select: {
        id: true,
        name: true,
        description: true,
        updatedAt: true,
        _count: { select: { tabs: true, items: true } },
      },
    });

    if (source.items.length === 0 && source.tabs.length === 0) {
      return menu;
    }

    const copiedItems = new Map<string, string>();
    for (const item of source.items) {
      const created = await tx.menuItem.create({
        data: {
          menuId: menu.id,
          toolItemId: item.toolItemId,
          title: item.title,
          description: item.description,
          price: item.price,
          calories: item.calories,
          notes: item.notes,
          imageUrl: item.imageUrl,
        },
        select: { id: true, toolItemId: true },
      });
      copiedItems.set(created.toolItemId, created.id);
    }

    for (const tab of source.tabs) {
      const createdTab = await tx.menuTab.create({
        data: {
          menuId: menu.id,
          name: tab.name,
          description: tab.description,
          position: tab.position,
        },
        select: { id: true },
      });

      if (tab.placements.length === 0) continue;

      await tx.menuTabPlacement.createMany({
        data: tab.placements
          .map((placement) => {
            const copiedItemId = copiedItems.get(placement.menuItem.toolItemId);
            if (!copiedItemId) return null;
            return {
              menuTabId: createdTab.id,
              menuItemId: copiedItemId,
              position: placement.position,
            };
          })
          .filter(
            (
              value,
            ): value is { menuTabId: string; menuItemId: string; position: number } =>
              value !== null,
          ),
      });
    }

    return menu;
  });
}

export async function createMenuTab(
  orgId: string,
  menuId: string,
  name: string,
  description?: string | null,
) {
  return prisma.$transaction(async (tx) => {
    const menu = await tx.menu.findFirst({
      where: { id: menuId, orgId },
      select: { id: true },
    });
    if (!menu) return null;

    const position = await tx.menuTab.count({ where: { menuId } });

    return tx.menuTab.create({
      data: {
        menuId,
        name,
        description: description ?? null,
        position,
      },
      select: {
        id: true,
        name: true,
        description: true,
        position: true,
      },
    });
  });
}

export async function createMenuItem(
  orgId: string,
  menuId: string,
  toolItemId: string,
  title: string,
  description?: string | null,
  price?: number | null,
  calories?: number | null,
  notes?: string | null,
  tabId?: string | null,
  imageUrl?: string | null,
) {
  return prisma.$transaction(async (tx) => {
    const menu = await tx.menu.findFirst({
      where: { id: menuId, orgId },
      select: { id: true },
    });
    if (!menu) return null;

    const toolItem = await tx.toolItem.findFirst({
      where: { id: toolItemId, orgId },
      select: { id: true },
    });
    if (!toolItem) return null;

    if (tabId) {
      const tab = await tx.menuTab.findFirst({
        where: { id: tabId, menuId },
        select: { id: true },
      });
      if (!tab) return null;
    }

    const menuItem = await tx.menuItem.create({
      data: {
        menuId,
        toolItemId,
        title,
        description: description ?? null,
        price: price ?? null,
        calories: calories ?? null,
        notes: notes ?? null,
        imageUrl: imageUrl ?? null,
      },
      select: menuItemSelect,
    });

    if (!tabId) {
      return menuItem;
    }

    const position = await tx.menuTabPlacement.count({
      where: { menuTabId: tabId },
    });

    await tx.menuTabPlacement.create({
      data: {
        menuTabId: tabId,
        menuItemId: menuItem.id,
        position,
      },
    });

    return menuItem;
  });
}

export async function updateMenuItem(
  orgId: string,
  menuId: string,
  menuItemId: string,
  toolItemId: string,
  title: string,
  description?: string | null,
  price?: number | null,
  calories?: number | null,
  notes?: string | null,
  tabId?: string | null,
  imageUrl?: string | null,
) {
  return prisma.$transaction(async (tx) => {
    const menu = await tx.menu.findFirst({
      where: { id: menuId, orgId },
      select: { id: true },
    });
    if (!menu) return null;

    const toolItem = await tx.toolItem.findFirst({
      where: { id: toolItemId, orgId },
      select: { id: true },
    });
    if (!toolItem) return null;

    const item = await tx.menuItem.findFirst({
      where: { id: menuItemId, menuId },
      select: { id: true },
    });
    if (!item) return null;

    if (tabId) {
      const tab = await tx.menuTab.findFirst({
        where: { id: tabId, menuId },
        select: { id: true },
      });
      if (!tab) return null;
    }

    const updatedMenuItem = await tx.menuItem.update({
      where: { id: menuItemId },
      data: {
        toolItemId,
        title,
        description: description ?? null,
        price: price ?? null,
        calories: calories ?? null,
        notes: notes ?? null,
        imageUrl: imageUrl ?? null,
      },
      select: menuItemSelect,
    });

    if (tabId !== undefined) {
      const existingPlacements = await tx.menuTabPlacement.findMany({
        where: { menuItemId },
        select: { menuTabId: true },
      });
      const shouldKeepCurrentPlacement =
        tabId !== null &&
        existingPlacements.length === 1 &&
        existingPlacements[0]?.menuTabId === tabId;

      if (!shouldKeepCurrentPlacement) {
        await tx.menuTabPlacement.deleteMany({ where: { menuItemId } });

        if (tabId) {
          const position = await tx.menuTabPlacement.count({
            where: { menuTabId: tabId },
          });
          await tx.menuTabPlacement.create({
            data: {
              menuTabId: tabId,
              menuItemId,
              position,
            },
          });
        }
      }
    }

    return updatedMenuItem;
  });
}

export async function deleteMenuItem(
  orgId: string,
  menuId: string,
  menuItemId: string,
) {
  const result = await prisma.menuItem.deleteMany({
    where: { id: menuItemId, menuId, menu: { orgId } },
  });
  return result.count > 0;
}