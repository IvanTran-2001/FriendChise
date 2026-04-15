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
import {
  createFranchiseToken,
  deleteFranchiseToken as deleteFranchiseTokenService,
  extendFranchiseToken as extendFranchiseTokenService,
  removeFranchisee as removeFranchiseeService,
  changeFranchiseeOwner as changeFranchiseeOwnerService,
} from "@/lib/services/franchise";

type Result = { ok: true } | { ok: false; error: string };

/** Generates a new franchise invite token for the given email (expires in 7 days). */
export async function generateFranchiseToken(
  orgId: string,
  email: string,
): Promise<Result> {
  const authz = await requireParentOrgOwnerAction(orgId);
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const result = await createFranchiseToken(orgId, email, authz.userId);
  if (!result.ok) return { ok: false, error: result.error };

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

  const result = await deleteFranchiseTokenService(orgId, tokenId);
  if (!result.ok) return { ok: false, error: result.error };

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

  const result = await extendFranchiseTokenService(orgId, tokenId);
  if (!result.ok) return { ok: false, error: result.error };

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

  const result = await removeFranchiseeService(orgId, childOrgId);
  if (!result.ok) return { ok: false, error: result.error };

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

  const result = await changeFranchiseeOwnerService(
    orgId,
    childOrgId,
    newOwnerEmail,
  );
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/orgs/${orgId}/franchisee`);
  return { ok: true };
}
