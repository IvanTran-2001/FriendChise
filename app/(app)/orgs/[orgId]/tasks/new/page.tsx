/**
 * New Task page — `/orgs/[orgId]/tasks/new`
 *
 * Server component. Guards with `MANAGE_TASKS`. Fetches all org roles so the
 * create form can pre-populate the eligibility selector, then renders the
 * shared `TaskForm` in create mode.
 */
import { requireOrgPermissionPage } from "@/lib/authz";
import { PermissionAction } from "@prisma/client";
import { getRoles } from "@/lib/services/roles";
import { getOrgTags } from "@/lib/services/tags";
import { TaskCreateClient } from "./task-create-client";

const NewTaskPage = async ({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) => {
  const { orgId } = await params;

  await requireOrgPermissionPage(orgId, PermissionAction.MANAGE_TASKS);

  const [allRoles, allTags] = await Promise.all([
    getRoles(orgId),
    getOrgTags(orgId),
  ]);

  return (
    <TaskCreateClient
      orgId={orgId}
      allRoles={allRoles}
      allTags={allTags}
    />
  );
};

export default NewTaskPage;
