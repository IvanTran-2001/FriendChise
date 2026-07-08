import { NextResponse } from "next/server";
import { PermissionAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOrgPermission } from "@/lib/authz";
import { getMenuPreviewClicksThisMonth } from "@/lib/services/tools";

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
} as const;

const menuTabSelect = {
  id: true,
  name: true,
  description: true,
  position: true,
  placements: {
    orderBy: { position: "asc" as const },
    select: menuTabPlacementSelect,
  },
} as const;

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
      items: { orderBy: { title: "asc" }, select: menuItemSelect },
      tabs: { orderBy: { position: "asc" }, select: menuTabSelect },
    },
  });

  if (!menu) {
    return NextResponse.json({ error: "Menu not found." }, { status: 404 });
  }

  const previewClicksThisMonth = await getMenuPreviewClicksThisMonth(menuId);

  return NextResponse.json({
    ...menu,
    previewClicksThisMonth,
  });
}
