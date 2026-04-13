"use server";

/**
 * @file franchisee.ts
 * Server Actions for franchise management.
 *
 * All actions require `requireParentOrgOwnerAction` — the caller must be the
 * owner of a parent org (no `parentId`). Franchisee changes are scoped to
 * child orgs that belong to that parent.
 *
 * generateFranchiseToken   — issues a 7-day single-use invite token tied to an email.
 * deleteFranchiseToken     — revokes an unused token.
 * extendFranchiseToken     — extends a token's expiry by 1 day.
 * removeFranchisee         — detaches a child org from this parent (clears parentId).
 * changeFranchiseeOwner    — transfers ownership of a child org to a different user.
 */

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

/** Extends a franchise token's expiry by 1 day from its current expiry
 * (or from now if the token has already expired). */
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

/**
 * Permanently deletes a franchisee org from the database.
 * All related data (memberships, roles, tasks, timetable entries, templates)
 * is removed automatically via cascade deletes defined in the schema.
 */
export async function removeFranchisee(
  orgId: string,
  childOrgId: string,
): Promise<Result> {
  const authz = await requireParentOrgOwnerAction(orgId);
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const { count } = await prisma.organization.deleteMany({
    where: { id: childOrgId, parentId: orgId },
  });
  if (count === 0) return { ok: false, error: "Franchisee not found" };

  revalidatePath(`/orgs/${orgId}/franchisee`);
  return { ok: true };
}

/**
 * Transfers ownership of a franchisee org to a different user (by email).
 * The target user must have an account. If they are not yet a member of the
 * child org, a membership is created automatically. The previous owner's
 * Owner role is removed. All steps are atomic.
 */
export async function changeFranchiseeOwner(
  orgId: string,
  childOrgId: string,
  newOwnerEmail: string,
): Promise<Result> {
  const authz = await requireParentOrgOwnerAction(orgId);
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const newOwner = await prisma.user.findUnique({
    where: { email: newOwnerEmail.trim().toLowerCase() },
    select: { id: true },
  });
  if (!newOwner) return { ok: false, error: "User not found" };

  try {
    await prisma.$transaction(async (tx) => {
      // Read child inside the transaction so ownerId and parentId are current
      const child = await tx.organization.findFirst({
        where: { id: childOrgId, parentId: orgId },
        select: { id: true, ownerId: true },
      });
      if (!child) throw new Error("Franchisee not found");

      const ownerRole = await tx.role.findFirst({
        where: { orgId: childOrgId, key: "owner" },
        select: { id: true },
      });
      if (!ownerRole) throw new Error("Owner role not found");

      const oldMembership = await tx.membership.findFirst({
        where: { orgId: childOrgId, userId: child.ownerId },
        select: { id: true },
      });
      if (oldMembership) {
        await tx.memberRole.deleteMany({
          where: { membershipId: oldMembership.id, roleId: ownerRole.id },
        });
      }

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

      // Include parentId in the where clause so we never update an org that
      // has been reparented between the child read and this write
      const { count } = await tx.organization.updateMany({
        where: { id: childOrgId, parentId: orgId },
        data: { ownerId: newOwner.id },
      });
      if (count === 0) throw new Error("Franchisee not found");
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to change owner",
    };
  }

  revalidatePath(`/orgs/${orgId}/franchisee`);
  return { ok: true };
}