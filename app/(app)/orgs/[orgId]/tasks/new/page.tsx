import { requireOrgPermission } from "@/lib/authz";
import { OrgPermission } from "@prisma/client";
import { redirect } from "next/navigation";
import { CreateTaskForm } from "./create-task-form";

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
