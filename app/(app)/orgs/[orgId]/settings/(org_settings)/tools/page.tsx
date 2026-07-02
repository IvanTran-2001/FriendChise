import { PermissionAction } from "@prisma/client";
import { requireOrgPermissionPage } from "@/lib/authz";


export default async function ToolsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {

  const { orgId } = await params;
  await requireOrgPermissionPage(orgId, PermissionAction.MANAGE_SETTINGS);

  return <div>Tools Page</div>;
};

