import { notFound } from "next/navigation";
import { prisma } from "@/lib/platform/prisma";
import { requireOrgOwnerOrParentOrgOwnerPage } from "@/lib/authz";
import { OrgSettingsClient } from "./organization-client";
import { TIMEZONES } from "@/lib/core/timezones";

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

  return (
    <OrgSettingsClient
      org={org}
      isParentOwner={isParentOwner}
      timezones={TIMEZONES}
    />
  );
}
