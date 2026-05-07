import { PermissionAction } from "@prisma/client";
import { requireOrgPermissionPage } from "@/lib/authz";
import { getOrgTags } from "@/lib/services/tags";
import { RegisterPageSidebar } from "@/components/layout/page-sidebar-context";
import { TagsSidebarContent } from "./_components/tags-sidebar-content";
import { TagsClient } from "./tags-client";

export default async function TagsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  await requireOrgPermissionPage(orgId, PermissionAction.MANAGE_SETTINGS);

  const tags = await getOrgTags(orgId);

  return (
    <>
      <RegisterPageSidebar content={<TagsSidebarContent orgId={orgId} />} />
      <TagsClient orgId={orgId} tags={tags} />
    </>
  );
}
