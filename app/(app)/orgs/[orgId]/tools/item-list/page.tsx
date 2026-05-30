import { requireOrgMemberPage } from "@/lib/authz";
import {
  getOrgMembership,
  memberHasPermission,
  getAuthUserId,
} from "@/lib/authz/_shared";
import { PermissionAction } from "@prisma/client";
import { getToolItemsFull } from "@/lib/services/tools";
import { createSignedReadUrls } from "@/lib/supabase-storage";
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
  await requireOrgMemberPage(orgId);

  const userId = await getAuthUserId();
  const membership = userId ? await getOrgMembership(orgId, userId) : null;
  const canManage = membership
    ? await memberHasPermission(membership.id, orgId, PermissionAction.MANAGE_TASKS)
    : false;

  const rawItems = await getToolItemsFull(orgId);

  // Batch-resolve signed URLs for items that have images.
  const paths = rawItems.flatMap((i) => (i.imgUrl ? [i.imgUrl] : []));
  const signedUrls = await createSignedReadUrls(paths);

  const items = rawItems.map((i) => ({
    ...i,
    imageSignedUrl: i.imgUrl ? (signedUrls.get(i.imgUrl) ?? null) : null,
  }));

  return (
    <>
      <RegisterPageSidebar title="Item List" content={<ItemListSidebarShell />} />
      <ItemListPageClient orgId={orgId} items={items} canManage={canManage} view={view} />
    </>
  );
}
