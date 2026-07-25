import { requireOrgPermissionPage } from "@/lib/authz";
import { PermissionAction } from "@prisma/client";
import { getMenus } from "@/lib/services/tools";
import { MenuListsPageClient } from "./_components/menu-client";

export default async function MenuPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { orgId } = await params;
  const sp = await searchParams;
  await requireOrgPermissionPage(orgId, PermissionAction.MANAGE_TASKS);
  const canManage = true;

  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const search = typeof sp.q === "string" ? sp.q : "";
  const menuPage = await getMenus(orgId, { page, search, pageSize: 12 });

  return (
    <MenuListsPageClient
      orgId={orgId}
      menus={menuPage.menus}
      canManage={canManage}
      page={menuPage.page}
      totalPages={menuPage.totalPages}
      totalCount={menuPage.totalCount}
      search={menuPage.search}
    />
  );
}
