import { NextResponse } from "next/server";
import { PermissionAction } from "@prisma/client";
import { prisma } from "@/lib/platform/prisma";
import { requireOrgPermission } from "@/lib/authz";
import { getMenuItemsPage, menuTabSelect } from "@/lib/services/tools/menus";
import { getMenuPreviewClicksThisMonth } from "@/lib/services/tools/menus";

const MENU_PAGE_SIZE = 24;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string; menuId: string }> },
) {
  const { orgId, menuId } = await params;

  const authz = await requireOrgPermission(orgId, PermissionAction.MANAGE_TASKS);
  if (!authz.ok) return authz.response;

  const menu = await prisma.menu.findFirst({
    where: { id: menuId, orgId },
    select: {
      id: true,
      name: true,
      description: true,
      publicToken: true,
      updatedAt: true,
      tabs: { orderBy: { position: "asc" }, select: menuTabSelect },
    },
  });

  if (!menu) {
    return NextResponse.json({ error: "Menu not found." }, { status: 404 });
  }

  const previewClicksThisMonth = await getMenuPreviewClicksThisMonth(menuId);
  const itemsPage = await getMenuItemsPage(menuId, { page: 1, pageSize: MENU_PAGE_SIZE });

  return NextResponse.json({
    ...menu,
    items: itemsPage.items,
    itemsTotalCount: itemsPage.totalCount,
    itemsTotalPages: itemsPage.totalPages,
    itemsPage: itemsPage.page,
    itemsPageSize: itemsPage.pageSize,
    previewClicksThisMonth,
  });
}
