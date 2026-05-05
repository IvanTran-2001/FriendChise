import { PermissionAction } from "@prisma/client";
import { requireOrgPermissionPage } from "@/lib/authz";
import { getTasks } from "@/lib/services/tasks";
import { RoleForm } from "../_components/role-form";

/**
 * Create-role page — server component.
 *
 * Guards access with `MANAGE_ROLES`. Fetches all org tasks so the form can
 * populate the task eligibility picker, then renders `<RoleForm>`.
 */

export default async function NewRolePage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;

  await requireOrgPermissionPage(orgId, PermissionAction.MANAGE_ROLES);

  const tasks = await getTasks(orgId);

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold mb-6">Create Role</h1>
      <RoleForm
        orgId={orgId}
        tasks={tasks.map((t) => ({ id: t.id, name: t.name }))}
      />
    </div>
  );
}
