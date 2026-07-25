import { PermissionAction } from "@prisma/client";
import { requireOrgPermissionPage } from "@/lib/authz";
import { getRoles } from "@/lib/services/roles";
import { getTasks } from "@/lib/services/tasks";
import { RegisterPageSidebar } from "@/components/layout/contexts/page-sidebar-context";
import { RolesSidebarContent } from "./_components/roles-sidebar-content";
import { RolesClient } from "./roles-client";

/**
 * Roles settings page — server component.
 *
 * Guards access with `MANAGE_ROLES`. Fetches all roles (with permissions and
 * task eligibility) and all org tasks in parallel — tasks are needed to
 * populate the eligibility picker inside the create/edit panel.
 *
 * Registers `RolesSidebarContent` as the page sidebar (provides the
 * "+ Create Role" action). Role creation and editing both happen inside
 * `ActionSidebar` panels — there are no standalone `/new` or `/[roleId]/edit`
 * pages for roles.
 */
export default async function RolesPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;

  await requireOrgPermissionPage(orgId, PermissionAction.MANAGE_ROLES);

  const [roles, tasks] = await Promise.all([getRoles(orgId), getTasks(orgId)]);

  return (
    <>
      <RegisterPageSidebar
        title="Roles"
        content={
          <RolesSidebarContent
            orgId={orgId}
            tasks={tasks.map((t) => ({ id: t.id, name: t.name }))}
          />
        }
      />
      <div className="max-w-3xl mx-auto">
        <RolesClient
          orgId={orgId}
          roles={roles}
          tasks={tasks.map((t) => ({ id: t.id, name: t.name }))}
        />
      </div>
    </>
  );
}
