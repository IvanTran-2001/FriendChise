import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { requireOrgPermissionPage } from "@/lib/authz";
import { PermissionAction } from "@prisma/client";
import type { MenuDetail } from "@/lib/services/tools/menus";
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

  const headerList = await headers();
  const origin = `${headerList.get("x-forwarded-proto") ?? "http"}://${headerList.get("host")}`;
  const response = await fetch(`${origin}/api/orgs/${orgId}/tools/menu/${setId}`, {
    headers: {
      cookie: headerList.get("cookie") ?? "",
    },
    cache: "no-store",
  });

  if (!response.ok) notFound();

  const menu = (await response.json()) as MenuDetail;

  return (
    <MenuDetailClient
      orgId={orgId}
      menu={menu}
      publicToken={menu.publicToken}
      canManage={canManage}
    />
  );
}