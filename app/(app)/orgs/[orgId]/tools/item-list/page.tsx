import { requireOrgMemberPage } from "@/lib/authz";
import {
  getOrgMembership,
  memberHasPermission,
} from "@/lib/authz/_shared";
import { PermissionAction } from "@prisma/client";
import { RegisterPageSidebar } from "@/components/layout/page-sidebar-context";
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
  const { userId } = await requireOrgMemberPage(orgId);

  const membership = userId ? await getOrgMembership(orgId, userId) : null;
  const canManage = membership
    ? await memberHasPermission(membership.id, orgId, PermissionAction.MANAGE_TASKS)
    : false;

  return (
    <>
      <RegisterPageSidebar title="Item List" content={<ItemListSidebarShell />} />
      <ItemListPageClient orgId={orgId} canManage={canManage} view={view} />
    </>
  );
}
