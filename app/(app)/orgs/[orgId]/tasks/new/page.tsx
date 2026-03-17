import { requireOrgMember } from "@/lib/authz";
import { redirect } from "next/navigation";
import { CreateTaskForm } from "./create-task-form";

const NewTaskPage = async ({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) => {
  const { orgId } = await params;

  const authz = await requireOrgMember(orgId);
  if (!authz.ok) redirect("/");

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-xl font-semibold mb-6">Create Task</h1>
      <CreateTaskForm orgId={orgId} />
    </div>
  );
};

export default NewTaskPage;
