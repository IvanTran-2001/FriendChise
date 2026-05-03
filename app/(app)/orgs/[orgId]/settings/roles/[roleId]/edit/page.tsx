import { notFound, redirect } from "next/navigation";
import { PermissionAction } from "@prisma/client";
import { requireOrgPermissionPage } from "@/lib/authz";
import { getRoleById } from "@/lib/services/roles";
import { getTasks } from "@/lib/services/tasks";
import { ROLE_KEYS } from "@/lib/rbac";
import { RoleForm } from "../../_components/role-form";

/**
 * Edit-role page — server component.
 *
 * Guards access with `MANAGE_ROLES`. Fetches the role (with its permissions and
 * task eligibility) and all org tasks in parallel, then renders `<RoleForm>`
 * in edit mode. Redirects to the roles list if the role doesn't exist or if the
 * caller tries to edit the protected Owner role.
 */

export default async function EditRolePage({
  params,
}: {
  params: Promise<{ orgId: string; roleId: string }>;
}) {
  const { orgId, roleId } = await params;

  await requireOrgPermissionPage(orgId, PermissionAction.MANAGE_ROLES);

  const [role, tasks] = await Promise.all([
    getRoleById(orgId, roleId),
    getTasks(orgId),
  ]);

  if (!role) notFound();
  if (role.key === ROLE_KEYS.OWNER) redirect(`/orgs/${orgId}/settings/roles`);

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold mb-6">Edit Role</h1>
      <RoleForm orgId={orgId} role={role} tasks={tasks.map((t) => ({ id: t.id, name: t.name }))} />
    </div>
  );
}
