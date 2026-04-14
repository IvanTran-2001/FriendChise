import { requireParentOrgOwnerPage } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { FranchiseeClient } from "./franchisee-client";

export default async function FranchiseePage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  await requireParentOrgOwnerPage(orgId);

  const [franchisees, tokens] = await Promise.all([
    prisma.organization.findMany({
      where: { parentId: orgId },
      select: {
        id: true,
        name: true,
        address: true,
        createdAt: true,
        owner: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.franchiseToken.findMany({
      where: { orgId },
      select: {
        id: true,
        token: true,
        invitedEmail: true,
        expiresAt: true,
        acceptedAt: true,
        usedByOrgId: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <FranchiseeClient orgId={orgId} franchisees={franchisees} tokens={tokens} />
  );
}
