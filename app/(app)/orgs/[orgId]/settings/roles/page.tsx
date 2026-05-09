import { PermissionAction } from "@prisma/client";
import { requireOrgPermissionPage } from "@/lib/authz";
import { getRoles } from "@/lib/services/roles";
import { getTasks } from "@/lib/services/tasks";
import { RegisterPageSidebar } from "@/components/layout/page-sidebar-context";
import { RolesSidebarContent } from "./_components/roles-sidebar-content";
import { RolesClient } from "./roles-client";

/**
 * Roles settings page — server component.
 *
 * Guards access with `MANAGE_ROLES`; only members whose role grants that
 * permission can view this page. Fetches all roles for the org (with their
 * associated permissions) and delegates rendering to `RolesClient`.
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
        content={
          <RolesSidebarContent
            orgId={orgId}
            tasks={tasks.map((t) => ({ id: t.id, name: t.name }))}
          />
        }
      />
      <div className="max-w-3xl mx-auto">
        <RolesClient orgId={orgId} roles={roles} tasks={tasks.map((t) => ({ id: t.id, name: t.name }))} />
      </div>
    </>
  );
}
