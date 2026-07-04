import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireOrgOwnerOrParentOrgOwnerPage } from "@/lib/authz";
import { OrgSettingsClient } from "./organization-client";
import { TIMEZONES } from "@/lib/timezones";

export default async function OrgSettingsOrganizationPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;

  const { userId } = await requireOrgOwnerOrParentOrgOwnerPage(orgId);

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      name: true,
      ownerId: true,
      parentId: true,
      address: true,
      timezone: true,
      openTimeMin: true,
      closeTimeMin: true,
      image: true,
    },
  });
  if (!org) notFound();

  // Only the owner of a standalone (non-franchisee) org can transfer or delete.
  // A franchisee's lifecycle is controlled by the franchisor, not the franchisee owner.
  const isParentOwner = org.parentId === null && org.ownerId === userId;

  // Only needed for the transfer dropdown — skip the query for non-owners
  const transferableMembers = isParentOwner
    ? await prisma.membership.findMany({
        where: { orgId, NOT: { userId }, userId: { not: null } },
        select: {
          id: true,
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { user: { name: "asc" } },
      })
    : [];

  return (
    <OrgSettingsClient
      org={org}
      isParentOwner={isParentOwner}
      transferableMembers={transferableMembers}
      timezones={TIMEZONES}
    />
  );
}
