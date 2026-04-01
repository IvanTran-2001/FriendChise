import { getTasks } from "@/lib/services/tasks";
import { getRoles } from "@/lib/services/roles";
import { requireOrgMemberPage } from "@/lib/authz";
import { TaskTable } from "./_components/task-table";

/**
 * Tasks list page — server component.
 *
 * Guards access with `requireOrgMemberPage`; redirects to `/` if the caller is not
 * a member. Fetches tasks (with role eligibility) and all org roles, then renders
 * the interactive TaskTable client component with search, sort, and filter.
 */
const TasksPage = async ({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) => {
  const { orgId } = await params;

  await requireOrgMemberPage(orgId);

  const [tasks, roles] = await Promise.all([getTasks(orgId), getRoles(orgId)]);

  return <TaskTable orgId={orgId} tasks={tasks} roles={roles} />;
};

export default TasksPage;
