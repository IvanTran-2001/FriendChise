import { getRoles } from "@/lib/services/roles";
import { requireOrgMemberPage } from "@/lib/authz";
import { memberHasPermission, getOrgMembership } from "@/lib/authz/_shared";
import { PermissionAction } from "@prisma/client";
import { MembersPageClient } from "./_components/members-page-client";

/**
 * Members list page — server component.
 *
 * Guards access with `requireOrgMemberPage`; non-members are redirected.
 * Fetches the available roles and checks whether the current user holds the
 * `MANAGE_MEMBERS` permission. The membership list itself is loaded from the
 * API by the client so pagination and local persistence can live together.
 *
 * Role filter and view (list/card) are URL-param driven so the sidebar
 * controls and the members list stay in sync without client state sharing.
 */
const MembersPage = async ({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ roleId?: string; view?: string }>;
}) => {
  const { orgId } = await params;
  const sp = await searchParams;

  const { userId } = await requireOrgMemberPage(orgId);

  const [membership, roles] = await Promise.all([
    getOrgMembership(orgId, userId),
    getRoles(orgId),
  ]);

  const canManage = membership
    ? await memberHasPermission(
        membership.id,
        orgId,
        PermissionAction.MANAGE_MEMBERS,
      )
    : false;

  const roleId =
    typeof sp.roleId === "string" && roles.some((r) => r.id === sp.roleId)
      ? sp.roleId
      : null;
  const view: "list" | "card" = sp.view === "list" ? "list" : "card";

  return <MembersPageClient orgId={orgId} canManage={canManage} roles={roles} initialRoleId={roleId} initialView={view} />;
};

export default MembersPage;
