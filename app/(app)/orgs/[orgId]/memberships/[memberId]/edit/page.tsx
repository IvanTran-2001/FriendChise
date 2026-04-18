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

  const initialRoleIds = membership.memberRoles.map(({ role }) => role.id);

  return (
    <>
      <Toolbar>
        <Link
          href={`/orgs/${orgId}/memberships/${memberId}`}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← {membership.user.name ?? "Member"}
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <MemberToolbarActions
            orgId={orgId}
            userId={memberId}
            memberName={membership.user.name}
            status={membership.status as "ACTIVE" | "RESTRICTED"}
          />
        </div>
      </Toolbar>

      <div className="max-w-lg mx-auto">
        <MemberForm
          mode="edit"
          orgId={orgId}
          userId={memberId}
          allRoles={roles
            .filter((r) => r.key !== ROLE_KEYS.OWNER)
            .map((r) => ({ id: r.id, name: r.name }))}
          initialRoleIds={initialRoleIds}
          initialWorkingDays={membership.workingDays}
          name={membership.user.name}
          email={membership.user.email}
          image={membership.user.image}
        />
      </div>
    </>
  );
};

export default EditMemberPage;
