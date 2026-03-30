"use server";

import { revalidatePath } from "next/cache";
import { requireParentOrgOwnerAction } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

type Result = { ok: true } | { ok: false; error: string };

/** Generates a new franchise invite token for the given email (expires in 7 days). */
export async function generateFranchiseToken(
  orgId: string,
  email: string,
): Promise<Result> {
  const authz = await requireParentOrgOwnerAction(orgId);
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return { ok: false, error: "Email is required" };

  const user = await prisma.user.findUnique({
    where: { email: trimmed },
    select: { id: true },
  });
  if (!user) return { ok: false, error: "No account found with that email" };

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await prisma.franchiseToken.create({
    data: { orgId, invitedEmail: trimmed, expiresAt },
  });

  revalidatePath(`/orgs/${orgId}/franchisee`);
  return { ok: true };
}

/** Deletes a franchise invite token. */
export async function deleteFranchiseToken(
  orgId: string,
  tokenId: string,
): Promise<Result> {
  const authz = await requireParentOrgOwnerAction(orgId);
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const token = await prisma.franchiseToken.findFirst({
    where: { id: tokenId, orgId },
    select: { id: true },
  });
  if (!token) return { ok: false, error: "Token not found" };

  await prisma.franchiseToken.delete({ where: { id: tokenId } });
  revalidatePath(`/orgs/${orgId}/franchisee`);
  return { ok: true };
}

/** Extends a franchise token's expiry by 1 day. */
export async function extendFranchiseToken(
  orgId: string,
  tokenId: string,
): Promise<Result> {
  const authz = await requireParentOrgOwnerAction(orgId);
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const token = await prisma.franchiseToken.findFirst({
    where: { id: tokenId, orgId },
    select: { id: true, expiresAt: true },
  });
  if (!token) return { ok: false, error: "Token not found" };

  const now = new Date();
  const base = token.expiresAt > now ? token.expiresAt : now;
  const newExpiry = new Date(base);
  newExpiry.setDate(newExpiry.getDate() + 1);

  await prisma.franchiseToken.update({
    where: { id: tokenId },
    data: { expiresAt: newExpiry },
  });

  revalidatePath(`/orgs/${orgId}/franchisee`);
  return { ok: true };
}

/** Removes a franchisee from this org (detaches it by clearing parentId). */
export async function removeFranchisee(
  orgId: string,
  childOrgId: string,
): Promise<Result> {
  const authz = await requireParentOrgOwnerAction(orgId);
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const child = await prisma.organization.findFirst({
    where: { id: childOrgId, parentId: orgId },
    select: { id: true },
  });
  if (!child) return { ok: false, error: "Franchisee not found" };

  await prisma.organization.update({
    where: { id: childOrgId },
    data: { parentId: null },
  });

  revalidatePath(`/orgs/${orgId}/franchisee`);
  return { ok: true };
}

/** Changes the owner of a franchisee org (by email). */
export async function changeFranchiseeOwner(
  orgId: string,
  childOrgId: string,
  newOwnerEmail: string,
): Promise<Result> {
  const authz = await requireParentOrgOwnerAction(orgId);
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const child = await prisma.organization.findFirst({
    where: { id: childOrgId, parentId: orgId },
    select: { id: true, ownerId: true },
  });
  if (!child) return { ok: false, error: "Franchisee not found" };

  const newOwner = await prisma.user.findUnique({
    where: { email: newOwnerEmail.trim().toLowerCase() },
    select: { id: true },
  });
  if (!newOwner) return { ok: false, error: "User not found" };

  // Find the Owner role in the child org
  const ownerRole = await prisma.role.findFirst({
    where: { orgId: childOrgId, key: "owner" },
    select: { id: true },
  });
  if (!ownerRole) return { ok: false, error: "Owner role not found" };

  await prisma.$transaction(async (tx) => {
    const oldMembership = await tx.membership.findFirst({
      where: { orgId: childOrgId, userId: child.ownerId },
      select: { id: true },
    });
    if (oldMembership) {
      await tx.memberRole.deleteMany({
        where: { membershipId: oldMembership.id, roleId: ownerRole.id },
      });
    }

    // Upsert membership for new owner and assign Owner role
    const newMembership = await tx.membership.upsert({
      where: { userId_orgId: { userId: newOwner.id, orgId: childOrgId } },
      create: { orgId: childOrgId, userId: newOwner.id, workingDays: [] },
      update: {},
    });

    await tx.memberRole.upsert({
      where: {
        membershipId_roleId: {
          membershipId: newMembership.id,
          roleId: ownerRole.id,
        },
      },
      create: { membershipId: newMembership.id, roleId: ownerRole.id },
      update: {},
    });

    await tx.organization.update({
      where: { id: childOrgId },
      data: { ownerId: newOwner.id },
    });
  });

  revalidatePath(`/orgs/${orgId}/franchisee`);
  return { ok: true };
}
