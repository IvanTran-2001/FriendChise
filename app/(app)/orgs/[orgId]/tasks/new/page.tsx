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
import { TaskForm } from "../task-form";

const NewTaskPage = async ({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) => {
  const { orgId } = await params;

  await requireOrgPermissionPage(orgId, PermissionAction.MANAGE_TASKS);

  const allRoles = await getRoles(orgId);

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-xl font-semibold mb-6">Create Task</h1>
      <TaskForm mode="create" orgId={orgId} allRoles={allRoles} />
    </div>
  );
};

export default NewTaskPage;
