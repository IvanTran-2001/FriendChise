import { getMemberships } from "@/lib/services/memberships";
import { requireOrgMemberPage } from "@/lib/authz";
import { memberHasPermission, getOrgMembership } from "@/lib/authz/_shared";
import { PermissionAction } from "@prisma/client";
import { MembersView } from "./_components/members-view";

/**
 * Members list page — server component.
 *
 * Guards access with `requireOrgMemberPage`; non-members are redirected.
 * Fetches all memberships for the org and checks whether the current user
 * holds the `MANAGE_MEMBERS` permission. Both fetches are parallelised with
 * `Promise.all` to avoid a waterfall.
 *
 * The `canManage` flag is forwarded to `MembersView` so it can conditionally
 * show the "+ Add Member" button without performing another auth check on
 * the client.
 */
const MembersPage = async ({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) => {
  const { orgId } = await params;

  const { userId } = await requireOrgMemberPage(orgId);

  const [memberships, membership] = await Promise.all([
    getMemberships(orgId),
    getOrgMembership(orgId, userId),
  ]);

  const canManage = membership
    ? await memberHasPermission(
        membership.id,
        orgId,
        PermissionAction.MANAGE_MEMBERS,
      )
    : false;

  return (
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
    />
  );
};

export default MembersPage;
