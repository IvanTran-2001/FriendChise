import { getTasks } from "@/lib/services/tasks";
import { getRoles } from "@/lib/services/roles";
import { requireOrgMemberPage } from "@/lib/authz";
import {
  getOrgMembership,
  memberHasPermission,
  getAuthUserId,
} from "@/lib/authz/_shared";
import { PermissionAction } from "@prisma/client";
import { RegisterPageSidebarSubContent } from "@/components/layout/page-sidebar-context";
import { TaskTable } from "./_components/task-table";
import { TasksSidebarContent } from "./_components/tasks-sidebar-content";
import {
  SORT_OPTIONS,
  type SortOption,
} from "./_components/tasks-config";

/**
 * Tasks list page — server component.
 *
 * Guards access with `requireOrgMemberPage`; redirects to `/` if the caller is not
 * a member. Fetches tasks (with role eligibility) and all org roles, then renders
 * the interactive TaskTable client component with search, sort, and filter.
 *
 * Sort, role filter, and view (list/card) are URL-param driven so the sidebar
 * controls and the table stay in sync without client state sharing.
 */
const VALID_SORT_VALUES = SORT_OPTIONS.map((o) => o.value);

const TasksPage = async ({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ sort?: string; roleId?: string; view?: string }>;
}) => {
  const { orgId } = await params;
  const sp = await searchParams;

  await requireOrgMemberPage(orgId);

  const userId = await getAuthUserId();
  const membership = userId ? await getOrgMembership(orgId, userId) : null;
  const canManageTasks = membership
    ? await memberHasPermission(
        membership.id,
        orgId,
        PermissionAction.MANAGE_TASKS,
      )
    : false;

  const [tasks, roles] = await Promise.all([getTasks(orgId), getRoles(orgId)]);

  const sort: SortOption = VALID_SORT_VALUES.includes(sp.sort as SortOption)
    ? (sp.sort as SortOption)
    : "name-asc";
  const roleId =
    typeof sp.roleId === "string" && roles.some((r) => r.id === sp.roleId)
      ? sp.roleId
      : null;
  const view: "list" | "card" = sp.view === "card" ? "card" : "list";

  return (
    <>
      <RegisterPageSidebarSubContent
        content={
          <TasksSidebarContent
            orgId={orgId}
            roles={roles}
            canManageTasks={canManageTasks}
            sort={sort}
            roleId={roleId}
            view={view}
          />
        }
      />
      <TaskTable
        orgId={orgId}
        tasks={tasks}
        canManageTasks={canManageTasks}
        sort={sort}
        filterRoleId={roleId}
        view={view}
      />
    </>
  );
};

export default TasksPage;
