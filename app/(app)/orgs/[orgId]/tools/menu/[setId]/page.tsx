import { notFound } from "next/navigation";
import { requireOrgPermissionPage } from "@/lib/authz";
import { PermissionAction } from "@prisma/client";
import { getMenuDetail, getToolItemsFull } from "@/lib/services/tools";
import { MenuDetailClient } from "./_components/menu-detail-client";

/**
 * Menu detail page.
 * Loads the selected menu and the org-wide tool items so the client page can
 * render the menu item cards, edit flows, and category filters.
 */

export default async function MenuDetailPage({
  params,
}: {
  params: Promise<{ orgId: string; setId: string }>;
}) {
  const { orgId, setId } = await params;
  await requireOrgPermissionPage(orgId, PermissionAction.MANAGE_TASKS);
  const canManage = true;

  const [menu, toolItems] = await Promise.all([
    getMenuDetail(orgId, setId),
    getToolItemsFull(orgId),
  ]);
  if (!menu) notFound();

  return (
    <MenuDetailClient
      orgId={orgId}
      menu={menu}
      canManage={canManage}
      toolItems={toolItems}
    />
  );
}