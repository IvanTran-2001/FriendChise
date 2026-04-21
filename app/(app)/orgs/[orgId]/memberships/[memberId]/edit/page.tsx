import { notFound } from "next/navigation";
import Link from "next/link";
import { PermissionAction } from "@prisma/client";
import { requireOrgPermissionPage } from "@/lib/authz";
import { getMembershipDetail } from "@/lib/services/memberships";
import { getRoles } from "@/lib/services/roles";
import { ROLE_KEYS } from "@/lib/rbac";
import { Toolbar } from "@/components/layout/toolbar";
import { MemberForm } from "../../_components/member-form";
import { MemberToolbarActions } from "../_components/member-toolbar-actions";

const EditMemberPage = async ({
  params,
}: {
  params: Promise<{ orgId: string; memberId: string }>;
}) => {
  const { orgId, memberId } = await params;

  await requireOrgPermissionPage(orgId, PermissionAction.MANAGE_MEMBERS);

  const [membership, roles] = await Promise.all([
    getMembershipDetail(orgId, memberId),
    getRoles(orgId),
  ]);

  if (!membership) notFound();

  const displayName = membership.userId === null
    ? (membership.botName ?? "Bot")
    : (membership.user?.name ?? "Unknown user");
  const initialRoleIds = membership.memberRoles.map(({ role }) => role.id);

  return (
    <>
      <Toolbar>
        <Link
          href={`/orgs/${orgId}/memberships/${memberId}`}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← {displayName}
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <MemberToolbarActions
            orgId={orgId}
            membershipId={memberId}
            memberName={displayName}
            status={membership.status as "ACTIVE" | "RESTRICTED"}
          />
        </div>
      </Toolbar>

      <div className="w-full max-w-lg mx-auto">
        <MemberForm
          mode="edit"
          orgId={orgId}
          membershipId={memberId}          isCurrentlyBot={membership.userId === null}          allRoles={roles
            .filter((r) => r.key !== ROLE_KEYS.OWNER)
            .map((r) => ({ id: r.id, name: r.name }))}
          initialRoleIds={initialRoleIds}
          initialWorkingDays={membership.workingDays}
          name={displayName}
          email={membership.user?.email ?? ""}
          image={membership.user?.image ?? null}
        />
      </div>
    </>
  );
};

export default EditMemberPage;