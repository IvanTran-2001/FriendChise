import { requireOrgPermissionPage } from "@/lib/authz";
import { PermissionAction } from "@prisma/client";
import { CreateTaskForm } from "./create-task-form";

/**
 * Create-task page — server component.
 *
 * Guards access with `requireOrgPermissionPage(TASK_CREATE)`; redirects to `/`
 * if the caller lacks the permission. Renders the `CreateTaskForm` client
 * component inside a constrained-width container.
 */
const NewTaskPage = async ({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) => {
  const { orgId } = await params;

  await requireOrgPermissionPage(orgId, PermissionAction.MANAGE_TASKS);

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-xl font-semibold mb-6">Create Task</h1>
      <CreateTaskForm orgId={orgId} />
    </div>
  );
};

export default NewTaskPage;
