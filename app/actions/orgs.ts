"use server";

/**
 * Server actions for organization management.
 *
 * These are the only entry-points from the UI into org creation logic.
 * Each action:
 *   1. Authenticates the caller via the session.
 *   2. Validates the raw form payload with Zod.
 *   3. Delegates to the org service (all DB writes happen there).
 *   4. Revalidates the layout so the sidebar org list refreshes immediately.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  createOrgSchema,
  joinFranchiseSchema,
  updateOrgSettingsSchema,
  transferOrgSchema,
  deleteOrgSchema,
} from "@/lib/validators/org";
import {
  createOrg as createOrgService,
  joinFranchise as joinFranchiseService,
  updateOrgSettings as updateOrgSettingsService,
  transferOrgOwnership as transferOrgOwnershipService,
  deleteOrg as deleteOrgService,
} from "@/lib/services/orgs";

type OrgResult = { ok: true; orgId: string } | { ok: false; error: string };

/**
 * Creates a new standalone organization owned by the current user.
 * On success, redirects to the new org's overview page.
 */
export async function createOrg(raw: unknown): Promise<OrgResult> {
  const session = await auth();
  const userId = session?.user?.id as string | undefined;
  const userEmail = session?.user?.email as string | undefined;
  if (!userId) return { ok: false, error: "Unauthorized" };

  const parsed = createOrgSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Validation failed" };

  const { org } = await createOrgService(userId, parsed.data, userEmail);

  revalidatePath("/", "layout");
  return { ok: true, orgId: org.id };
}

/**
 * Joins an existing franchise as a child org using a one-time invite token.
 *
 * The token is tied to the caller's email — anyone else attempting to use it
 * will be rejected. Tokens expire after 1 hour and can only be used once.
 * On success, the new child org is linked to the parent via `parentId`.
 */
export async function joinFranchise(raw: unknown): Promise<OrgResult> {
  const session = await auth();
  const userId = session?.user?.id as string | undefined;
  const userEmail = session?.user?.email as string | undefined;
  if (!userId || !userEmail) return { ok: false, error: "Unauthorized" };

  const parsed = joinFranchiseSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Validation failed" };

  try {
    const { org } = await joinFranchiseService(userId, userEmail, parsed.data);
    revalidatePath("/", "layout");
    return { ok: true, orgId: org.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to join franchise",
    };
  }
}

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Updates an org's location and schedule (timezone, address, operating hours).
 * Accessible to any org member with MANAGE_SETTINGS permission.
 */
export async function updateOrgSettings(
  orgId: string,
  raw: unknown,
): Promise<ActionResult> {
  const session = await auth();
  const userId = session?.user?.id as string | undefined;
  const userEmail = session?.user?.email as string | undefined;
  if (!userId) return { ok: false, error: "Unauthorized" };

  const parsed = updateOrgSettingsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Validation failed" };

  try {
    await updateOrgSettingsService(orgId, parsed.data, userId, userEmail);
    revalidatePath(`/orgs/${orgId}`, "layout");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to save settings",
    };
  }
}

/**
 * Transfers org ownership to another member.
 * Only the current owner of a non-franchisee org may call this.
 */
export async function transferOrgOwnership(
  orgId: string,
  raw: unknown,
): Promise<ActionResult> {
  const session = await auth();
  const userId = session?.user?.id as string | undefined;
  const userEmail = session?.user?.email as string | undefined;
  if (!userId) return { ok: false, error: "Unauthorized" };

  const parsed = transferOrgSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Validation failed" };

  try {
    await transferOrgOwnershipService(orgId, userId, parsed.data.newOwnerId, userEmail);
    // Revalidate the org's own pages as well as the root layout so both the
    // outgoing and incoming owner see updated sidebar state immediately.
    revalidatePath(`/orgs/${orgId}`, "layout");
    revalidatePath("/", "layout");
    redirect("/");
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Failed to transfer ownership",
    };
  }
}

/**
 * Permanently deletes an org. Caller must confirm by providing the exact org name.
 * Only the current owner of a non-franchisee org may call this.
 */
export async function deleteOrg(
  orgId: string,
  raw: unknown,
): Promise<ActionResult> {
  const session = await auth();
  const userId = session?.user?.id as string | undefined;
  const userEmail = session?.user?.email as string | undefined;
  if (!userId) return { ok: false, error: "Unauthorized" };

  const parsed = deleteOrgSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Validation failed" };

  try {
    await deleteOrgService(orgId, userId, parsed.data.confirmName, userEmail);
    revalidatePath("/", "layout");
    redirect("/");
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to delete org",
    };
  }
}
