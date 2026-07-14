import { NextResponse } from "next/server";
import { PermissionAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOrgPermission } from "@/lib/authz";
import { getMenuItemsPage } from "@/lib/services/tools/menus";

const MENU_PAGE_SIZE = 24;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orgId: string; menuId: string }> },
) {
  const { orgId, menuId } = await params;

  const authz = await requireOrgPermission(orgId, PermissionAction.MANAGE_TASKS);
  if (!authz.ok) return authz.response;

  const menu = await prisma.menu.findFirst({
    where: { id: menuId, orgId },
    select: { id: true },
  });

  if (!menu) {
    return NextResponse.json({ error: "Menu not found." }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    Math.max(1, Number.parseInt(searchParams.get("pageSize") ?? String(MENU_PAGE_SIZE), 10) || MENU_PAGE_SIZE),
    100,
  );

  const pageData = await getMenuItemsPage(menuId, { page, pageSize });

  return NextResponse.json({
    items: pageData.items,
    totalCount: pageData.totalCount,
    totalPages: pageData.totalPages,
    page: pageData.page,
    pageSize: pageData.pageSize,
  });
}
