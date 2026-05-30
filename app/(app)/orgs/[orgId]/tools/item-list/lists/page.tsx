import { requireOrgMemberPage } from "@/lib/authz";
import {
  getOrgMembership,
  memberHasPermission,
  getAuthUserId,
} from "@/lib/authz/_shared";
import { PermissionAction } from "@prisma/client";
import { getToolItemLists } from "@/lib/services/tools";
import { RegisterPageSidebar, RegisterPageSidebarSubContent } from "@/components/layout/page-sidebar-context";
import { ItemListSidebarShell } from "../_components/item-list-sidebar-shell";
import { ItemListsSidebarContent } from "./_components/item-lists-sidebar-content";
import { ItemListsClient } from "./_components/item-lists-client";

export default async function ItemListsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { orgId } = await params;
  const { view: viewParam } = await searchParams;
  const view: "list" | "card" = viewParam === "card" ? "card" : "list";
  await requireOrgMemberPage(orgId);

  const userId = await getAuthUserId();
  const membership = userId ? await getOrgMembership(orgId, userId) : null;
  const canManage = membership
    ? await memberHasPermission(membership.id, orgId, PermissionAction.MANAGE_TASKS)
    : false;

  const lists = await getToolItemLists(orgId);

  return (
    <>
      <RegisterPageSidebar title="Item List" content={<ItemListSidebarShell />} />
      <RegisterPageSidebarSubContent
        content={<ItemListsSidebarContent orgId={orgId} canManage={canManage} view={view} />}
      />
      <ItemListsClient orgId={orgId} lists={lists} canManage={canManage} view={view} />
    </>
  );
}
