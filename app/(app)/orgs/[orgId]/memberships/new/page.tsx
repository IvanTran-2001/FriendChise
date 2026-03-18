import { requireOrgPermission } from "@/lib/authz";
import { OrgPermission } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CreateMembershipForm } from "./create-membership-form";

/**
 * Add-member page — server component.
 *
 * Guards access with `requireOrgPermission(ORG_MANAGE)`; redirects to `/`
 * if the caller lacks the permission. Fetches the org's roles and passes them
 * to the client form so the user can select a role when inviting a member.
 */
const NewMemberPage = async ({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) => {
  const { orgId } = await params;

  const authz = await requireOrgPermission(orgId, OrgPermission.ORG_MANAGE);
  if (!authz.ok) redirect("/");

  const roles = await prisma.role.findMany({
    where: { orgId },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-xl font-semibold mb-6">Add Member</h1>
      <CreateMembershipForm orgId={orgId} roles={roles} />
    </div>
  );
};

export default NewMemberPage;
