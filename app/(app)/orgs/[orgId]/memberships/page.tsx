import { getMemberships } from "@/lib/services/memberships";
import { getRoles } from "@/lib/services/roles";
import { requireOrgMemberPage } from "@/lib/authz";
import { memberHasPermission, getOrgMembership } from "@/lib/authz/_shared";
import { PermissionAction } from "@prisma/client";
import { RegisterPageSidebarSubContent } from "@/components/layout/page-sidebar-context";
import { MembersView } from "./_components/members-view";
import { MembersSidebarContent } from "./_components/members-sidebar-content";

/**
 * Members list page — server component.
 *
 * Guards access with `requireOrgMemberPage`; non-members are redirected.
 * Fetches all memberships for the org and checks whether the current user
 * holds the `MANAGE_MEMBERS` permission. Both fetches are parallelised with
 * `Promise.all` to avoid a waterfall.
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

  const [memberships, membership, roles] = await Promise.all([
    getMemberships(orgId),
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

  return (
    <>
      <RegisterPageSidebarSubContent
        content={
          <MembersSidebarContent
            orgId={orgId}
            roles={roles}
            canManage={canManage}
            roleId={roleId}
            view={view}
          />
        }
      />
      <MembersView
        members={memberships.map((m) => ({
          id: m.id,
          userId: m.userId,
          botName: m.botName,
          status: m.status,
          user: m.user,
          memberRoles: m.memberRoles,
        }))}
        orgId={orgId}
        canManage={canManage}
        roleId={roleId}
        view={view}
      />
    </>
  );
};

export default MembersPage;
