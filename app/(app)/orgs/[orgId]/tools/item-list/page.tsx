import { requireOrgMemberPage } from "@/lib/authz";
import {
  getOrgMembership,
  memberHasPermission,
  getAuthUserId,
} from "@/lib/authz/_shared";
import { PermissionAction } from "@prisma/client";
import { RegisterPageSidebar } from "@/components/layout/page-sidebar-context";
import { getToolItemsFull } from "@/lib/services/tools";
import { createSignedReadUrls } from "@/lib/supabase-storage";
import { ItemListSidebarContent } from "./_components/item-list-sidebar-content";
import { ItemListClient } from "./_components/item-list-client";

export default async function ItemListPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
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
      <RegisterPageSidebar content={<ItemListSidebarContent orgId={orgId} />} />
      <ItemListClient orgId={orgId} items={items} canManage={canManage} />
    </>
  );
}
