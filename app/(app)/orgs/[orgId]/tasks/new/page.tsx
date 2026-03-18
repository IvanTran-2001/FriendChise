import { requireOrgPermission } from "@/lib/authz";
import { OrgPermission } from "@prisma/client";
import { redirect } from "next/navigation";
import { CreateTaskForm } from "./create-task-form";

/**
 * Create-task page — server component.
 *
 * Guards access with `requireOrgPermission(TASK_CREATE)`; redirects to `/`
 * if the caller lacks the permission. Renders the `CreateTaskForm` client
 * component inside a constrained-width container.
 */
const NewTaskPage = async ({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) => {
  const { orgId } = await params;

  const authz = await requireOrgPermission(orgId, OrgPermission.TASK_CREATE);
  if (!authz.ok) redirect("/");

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-xl font-semibold mb-6">Create Task</h1>
      <CreateTaskForm orgId={orgId} />
    </div>
  );
};

export default NewTaskPage;
