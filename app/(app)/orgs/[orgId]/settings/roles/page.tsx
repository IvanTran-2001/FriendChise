import { PermissionAction } from "@prisma/client";
import Link from "next/link";
import { requireOrgPermissionPage } from "@/lib/authz";
import { getRoles } from "@/lib/services/roles";
import { Toolbar } from "@/components/layout/toolbar";
import { Button } from "@/components/ui/button";
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
      <Toolbar>
        <div className="flex-1" />
        <Button asChild size="sm">
          <Link href={`/orgs/${orgId}/settings/roles/new`}>+ Add Role</Link>
        </Button>
      </Toolbar>
      <div className="max-w-3xl mx-auto">
        <RolesClient orgId={orgId} roles={roles} />
      </div>
    </>
  );
}
