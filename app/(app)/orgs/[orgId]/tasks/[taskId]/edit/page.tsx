/**
 * Edit Task page — `/orgs/[orgId]/tasks/[taskId]/edit`
 *
 * Server component. Guards with `MANAGE_TASKS`. Fetches the task and all org
 * roles in parallel, then renders the shared `TaskForm` in edit mode.
 * Hydrates default field values and the current role eligibility list.
 * Returns 404 if the task does not belong to the org.
 */
import { notFound } from "next/navigation";
import { requireOrgPermissionPage } from "@/lib/authz";
import { PermissionAction } from "@prisma/client";
import { getTaskById } from "@/lib/services/tasks";
import { getRoles } from "@/lib/services/roles";
import { getOrgTags } from "@/lib/services/tags";
import { createSignedReadUrl } from "@/lib/supabase-storage";
import { TaskEditClient } from "./task-edit-client";

const EditTaskPage = async ({
  params,
}: {
  params: Promise<{ orgId: string; taskId: string }>;
}) => {
  const { orgId, taskId } = await params;

  await requireOrgPermissionPage(orgId, PermissionAction.MANAGE_TASKS);

  const [task, allRoles, allTags] = await Promise.all([
    getTaskById(orgId, taskId),
    getRoles(orgId),
    getOrgTags(orgId),
  ]);

  if (!task) notFound();

  const imageSignedUrl = task.imageUrl
    ? await createSignedReadUrl(task.imageUrl)
    : null;

  const eligibleRoles = task.eligibility.map((e) => e.role);
  const taskTags = task.tags.map((t) => t.tag);
  const taskTools = task.taskToolLinks.map((tool) => ({
    toolPath: tool.toolPath,
    toolLabel: tool.toolLabel ?? null,
  }));

  return (
    <TaskEditClient
      orgId={orgId}
      taskId={taskId}
      allRoles={allRoles}
      eligibleRoles={eligibleRoles}
      allTags={allTags}
      taskTags={taskTags}
      taskTools={taskTools}
      imageSignedUrl={imageSignedUrl}
      defaultValues={{
        color: task.color,
        title: task.name,
        description: task.description,
        durationMin: task.durationMin,
        preferredStartTimeMin: task.preferredStartTimeMin,
        peopleRequired: task.minPeople,
        minWaitDays: task.minWaitDays,
        maxWaitDays: task.maxWaitDays,
      }}
    />
  );
};

export default EditTaskPage;
