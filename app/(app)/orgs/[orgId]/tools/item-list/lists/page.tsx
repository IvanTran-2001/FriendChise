import { requireOrgPermissionPage } from "@/lib/authz";
import { PermissionAction } from "@prisma/client";
import { getToolItemLists } from "@/lib/services/tools";
import {
  listRecentActivitiesByCategory,
  RECENT_ACTIVITY_CATEGORY,
} from "@/lib/services/recent-activity";
import { RegisterPageSidebar } from "@/components/layout/page-sidebar-context";
import { ItemListSidebarShell } from "../_components/item-list-sidebar-shell";
import { ItemListsPageClient } from "./_components/item-lists-page-client";

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
  await requireOrgPermissionPage(orgId, PermissionAction.MANAGE_TASKS);
  const canManage = true;

  const [lists, recentLists] = await Promise.all([
    getToolItemLists(orgId),
    listRecentActivitiesByCategory(orgId, RECENT_ACTIVITY_CATEGORY.ITEM_LISTS, 6),
  ]);

  return (
    <>
      <RegisterPageSidebar title="Item List" content={<ItemListSidebarShell />} />
      {/* ItemListsPageClient owns the lists state so create/edit/delete update immediately.
          Previously this page rendered ItemListsSidebarContent + ItemListsClient separately
          with no shared state between them. */}
      <ItemListsPageClient
        orgId={orgId}
        lists={lists}
        recentLists={recentLists}
        canManage={canManage}
        view={view}
      />
    </>
  );
}
