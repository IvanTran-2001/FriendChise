import Link from "next/link";
import { PermissionAction } from "@prisma/client";
import { requireOrgPermissionPage } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { Toolbar } from "@/components/layout/toolbar";
import { CreateMembershipForm } from "./create-membership-form";

const NewMemberPage = async ({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) => {
  const { orgId } = await params;

  await requireOrgPermissionPage(orgId, PermissionAction.MANAGE_MEMBERS);

  const roles = await prisma.role.findMany({
    where: { orgId, NOT: { key: "owner" } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <Toolbar>
        <Link
          href={`/orgs/${orgId}/memberships`}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Members
        </Link>
      </Toolbar>
      <div className="max-w-lg mx-auto">
        <CreateMembershipForm orgId={orgId} roles={roles} />
      </div>
    </>
  );
};

export default NewMemberPage;
