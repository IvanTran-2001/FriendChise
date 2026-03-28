import { requireOrgPermissionPage } from "@/lib/authz";
import { PermissionAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CreateMembershipForm } from "./create-membership-form";

/**
 * Add-member page — server component.
 *
 * Guards access with `requireOrgPermissionPage(ORG_MANAGE)`; redirects to `/`
 * if the caller lacks the permission. Fetches the org's roles and passes them
 * to the client form so the user can select a role when inviting a member.
 */
const NewMemberPage = async ({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) => {
  const { orgId } = await params;

  await requireOrgPermissionPage(orgId, PermissionAction.MANAGE_MEMBERS);

  const roles = await prisma.role.findMany({
    where: { orgId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-xl font-semibold mb-6">Add Member</h1>
      <CreateMembershipForm orgId={orgId} roles={roles} />
    </div>
  );
};

export default NewMemberPage;
