import { PermissionAction } from "@prisma/client";
import { requireOrgPermissionPage } from "@/lib/authz";
import { getOrgTags } from "@/lib/services/tags";
import { RegisterPageSidebar } from "@/components/layout/contexts/page-sidebar-context";
import { TagsSidebarContent } from "./_components/tags-sidebar-content";
import { TagsClient } from "./tags-client";

// Tags settings stay server-rendered for the initial list, but the task picker
// inside the tag form now loads tasks lazily through the paginated API.

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
      <RegisterPageSidebar title="Tags" content={<TagsSidebarContent orgId={orgId} />} />
      <TagsClient orgId={orgId} tags={tags} />
    </>
  );
}
