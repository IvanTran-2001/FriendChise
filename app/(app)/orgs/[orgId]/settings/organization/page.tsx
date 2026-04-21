import { notFound } from "next/navigation";
import { PermissionAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOrgPermissionPage } from "@/lib/authz";
import { OrgSettingsClient } from "./settings-client";

export default async function OrgSettingsOrganizationPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;

  const { userId } = await requireOrgPermissionPage(
    orgId,
    PermissionAction.MANAGE_SETTINGS,
  );

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
    },
  });
  if (!org) notFound();

  // Only the owner of a standalone (non-franchisee) org can transfer or delete.
  // A franchisee's lifecycle is controlled by the franchisor, not the franchisee owner.
  const isParentOwner = org.parentId === null && org.ownerId === userId;

  // Only needed for the transfer dropdown — skip the query for non-owners
  const transferableMembers = isParentOwner
    ? await prisma.membership.findMany({
        where: { orgId, NOT: { userId } }, userId: { not: null } },
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
    />
  );
}