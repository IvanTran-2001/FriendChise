import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

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
  publicToken: string;
  updatedAt: Date;
  items: MenuItemDetail[];
  tabs: MenuTabDetail[];
};

export type PublicMenuDetail = MenuDetail & {
  orgId: string;
  org: {
    name: string;
    image: string | null;
  };
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

const menuTabPlacementSelect = {
  id: true,
  position: true,
  menuItemId: true,
  menuItem: {
    select: menuItemSelect,
  },
} satisfies Prisma.MenuTabPlacementSelect;

const menuTabSelect = {
  id: true,
  name: true,
  description: true,
  position: true,
  placements: {
    orderBy: { position: "asc" },
    select: menuTabPlacementSelect,
  },
} satisfies Prisma.MenuTabSelect;

const MENU_TAB_POSITION_STEP = 1000;

type MenuTabOrderRow = {
  id: string;
  position: number;
};

async function getOrderedMenuTabs(tx: Prisma.TransactionClient, menuId: string) {
  return tx.menuTab.findMany({
    where: { menuId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      position: true,
    },
  }) as Promise<MenuTabOrderRow[]>;
}

async function normalizeMenuTabPositions(tx: Prisma.TransactionClient, menuId: string) {
  const tabs = await getOrderedMenuTabs(tx, menuId);
  await Promise.all(
    tabs.map((tab, index) =>
      tx.menuTab.update({
        where: { id: tab.id },
        data: { position: (index + 1) * MENU_TAB_POSITION_STEP },
      }),
    ),
  );
}

export async function reorderMenuTabs(
  orgId: string,
  menuId: string,
  orderedTabIds: string[],
) {
  return prisma.$transaction(async (tx) => {
    const menu = await tx.menu.findFirst({
      where: { id: menuId, orgId },
      select: { id: true },
    });
    if (!menu) return null;

    const currentTabs = await getOrderedMenuTabs(tx, menuId);
    if (currentTabs.length !== orderedTabIds.length) return null;

    const currentTabIds = new Set(currentTabs.map((tab) => tab.id));
    const orderedTabIdSet = new Set(orderedTabIds);
    if (
      orderedTabIdSet.size !== orderedTabIds.length ||
      orderedTabIds.some((tabId) => !currentTabIds.has(tabId))
    ) {
      return null;
    }

    await Promise.all(
      orderedTabIds.map((tabId, index) =>
        tx.menuTab.update({
          where: { id: tabId },
          data: { position: (index + 1) * MENU_TAB_POSITION_STEP },
        }),
      ),
    );

    return tx.menuTab.findMany({
      where: { menuId },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        position: true,
      },
    });
  });
}

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

export async function getPublicMenuDetail(
  publicToken: string,
): Promise<PublicMenuDetail | null> {
  const publicMenuSelect = {
    id: true,
    orgId: true,
    name: true,
    description: true,
    publicToken: true,
    updatedAt: true,
    org: {
      select: {
        name: true,
        image: true,
      },
    },
    items: { orderBy: { title: "asc" }, select: menuItemSelect },
    tabs: { orderBy: { position: "asc" }, select: menuTabSelect },
  } satisfies Prisma.MenuSelect;

  return prisma.menu.findUnique({
    where: { publicToken },
    select: publicMenuSelect,
  }) as Promise<PublicMenuDetail | null>;
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

export async function updateMenuTab(
  orgId: string,
  menuId: string,
  tabId: string,
  name: string,
  description?: string | null,
) {
  return prisma.$transaction(async (tx) => {
    const menu = await tx.menu.findFirst({
      where: { id: menuId, orgId },
      select: { id: true },
    });
    if (!menu) return null;

    const tab = await tx.menuTab.findFirst({
      where: { id: tabId, menuId },
      select: { id: true },
    });
    if (!tab) return null;

    return tx.menuTab.update({
      where: { id: tabId },
      data: {
        name,
        description: description ?? null,
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

export async function deleteMenuTab(orgId: string, menuId: string, tabId: string) {
  return prisma.$transaction(async (tx) => {
    const menu = await tx.menu.findFirst({
      where: { id: menuId, orgId },
      select: { id: true },
    });
    if (!menu) return false;

    const deleted = await tx.menuTab.deleteMany({
      where: { id: tabId, menuId },
    });
    return deleted.count > 0;
  });
}

export async function moveMenuTab(
  orgId: string,
  menuId: string,
  tabId: string,
  direction: "up" | "down",
) {
  return prisma.$transaction(async (tx) => {
    const menu = await tx.menu.findFirst({
      where: { id: menuId, orgId },
      select: { id: true },
    });
    if (!menu) return null;

    const tabs = await getOrderedMenuTabs(tx, menuId);
    const currentIndex = tabs.findIndex((tab) => tab.id === tabId);
    if (currentIndex < 0) return null;

    const adjacentIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (adjacentIndex < 0 || adjacentIndex >= tabs.length) {
      return tx.menuTab.findFirst({
        where: { id: tabId, menuId },
        select: {
          id: true,
          name: true,
          description: true,
          position: true,
        },
      });
    }

    const currentTab = tabs[currentIndex];
    const adjacentTab = tabs[adjacentIndex];
    if (!currentTab || !adjacentTab) return null;

    if (currentTab.position === adjacentTab.position) {
      await normalizeMenuTabPositions(tx, menuId);
      const refreshedTabs = await getOrderedMenuTabs(tx, menuId);
      const refreshedIndex = refreshedTabs.findIndex((tab) => tab.id === tabId);
      const refreshedAdjacentIndex =
        direction === "up" ? refreshedIndex - 1 : refreshedIndex + 1;
      const refreshedCurrent = refreshedTabs[refreshedIndex];
      const refreshedAdjacent = refreshedTabs[refreshedAdjacentIndex];
      if (!refreshedCurrent || !refreshedAdjacent) return null;

      return Promise.all([
        tx.menuTab.update({
          where: { id: refreshedCurrent.id },
          data: { position: refreshedAdjacent.position },
          select: { id: true, name: true, description: true, position: true },
        }),
        tx.menuTab.update({
          where: { id: refreshedAdjacent.id },
          data: { position: refreshedCurrent.position },
          select: { id: true, name: true, description: true, position: true },
        }),
      ]).then(([updated]) => updated);
    }

    return Promise.all([
      tx.menuTab.update({
        where: { id: currentTab.id },
        data: { position: adjacentTab.position },
        select: { id: true, name: true, description: true, position: true },
      }),
      tx.menuTab.update({
        where: { id: adjacentTab.id },
        data: { position: currentTab.position },
        select: { id: true, name: true, description: true, position: true },
      }),
    ]).then(([updated]) => updated);
  });
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

    const lastTab = await tx.menuTab.findFirst({
      where: { menuId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const position = (lastTab?.position ?? 0) + MENU_TAB_POSITION_STEP;

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