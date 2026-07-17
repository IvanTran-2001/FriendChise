import { requireOrgPermissionPage } from "@/lib/authz";
import { PermissionAction } from "@prisma/client";
import { RegisterPageSidebar } from "@/components/layout/contexts/page-sidebar-context";
import { ItemListSidebarShell } from "./_components/item-list-sidebar-shell";
import { ItemListPageClient } from "./_components/item-list-page-client";

export default async function ItemListPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { orgId } = await params;
  const sp = await searchParams;
  const view: "grid" | "list" = sp.view === "list" ? "list" : "grid";
  await requireOrgPermissionPage(orgId, PermissionAction.MANAGE_TASKS);
  const canManage = true;

  return (
    <>
      <RegisterPageSidebar title="Item List" content={<ItemListSidebarShell />} />
      <ItemListPageClient orgId={orgId} canManage={canManage} view={view} />
    </>
  );
}
