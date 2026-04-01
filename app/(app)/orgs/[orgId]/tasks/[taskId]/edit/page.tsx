import { notFound } from "next/navigation";
import { requireOrgPermissionPage } from "@/lib/authz";
import { PermissionAction } from "@prisma/client";
import { getTaskById } from "@/lib/services/tasks";
import { getRoles } from "@/lib/services/roles";
import { TaskForm } from "../../task-form";

const EditTaskPage = async ({
  params,
}: {
  params: Promise<{ orgId: string; taskId: string }>;
}) => {
  const { orgId, taskId } = await params;

  await requireOrgPermissionPage(orgId, PermissionAction.MANAGE_TASKS);

  const [task, allRoles] = await Promise.all([
    getTaskById(orgId, taskId),
    getRoles(orgId),
  ]);

  if (!task) notFound();

  const eligibleRoles = task.eligibility.map((e) => e.role);

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-xl font-semibold mb-6">Edit Task</h1>
      <TaskForm
        mode="edit"
        orgId={orgId}
        taskId={taskId}
        allRoles={allRoles}
        eligibleRoles={eligibleRoles}
        defaultValues={{
          title: task.name,
          description: task.description,
          durationMin: task.durationMin,
          preferredStartTimeMin: task.preferredStartTimeMin,
          peopleRequired: task.minPeople,
          minWaitDays: task.minWaitDays,
          maxWaitDays: task.maxWaitDays,
        }}
      />
    </div>
  );
};

export default EditTaskPage;
