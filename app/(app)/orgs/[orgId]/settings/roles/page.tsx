import { PermissionAction } from "@prisma/client";
import { requireOrgPermissionPage } from "@/lib/authz";
import { getRoles } from "@/lib/services/roles";
import { Toolbar } from "@/components/layout/toolbar";
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

  const roles = await getRoles(orgId);

  return (
    <>
      <Toolbar
        actions={[
          { label: "+ Add Role", href: `/orgs/${orgId}/settings/roles/new` },
        ]}
      />
      <div className="max-w-3xl mx-auto">
        <RolesClient orgId={orgId} roles={roles} />
      </div>
    </>
  );
}
