"use server";

/**
 * Server Actions for membership management.
 * Used by the create-membership form — resolves the email to a userId,
 * delegates to the membership service, then revalidates and redirects.
 */

import { PermissionAction } from "@prisma/client";
import { requireOrgPermissionAction } from "@/lib/authz";
import { createMembership } from "@/lib/services/memberships";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type CreateMembershipFormState =
  | { ok: false; errors: Record<string, string[]> }
  | { ok: true }
  | null;

/**
 * Server Action wired to the create-membership form via `useActionState`.
 *
 * Resolves the submitted email to a User record, then delegates to
 * `createMembership`. On success, revalidates the memberships page and
 * redirects. On failure, returns field-level errors for the form to display.
 *
 * @param orgId   - The org the new member is being added to.
 * @param _prev   - Previous form state (required by `useActionState` signature).
 * @param formData - Raw form fields: `email`, `roleId`.
 */
export async function createMembershipAction(
  orgId: string,
  _prev: CreateMembershipFormState,
  formData: FormData,
): Promise<CreateMembershipFormState> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_MEMBERS,
  );
  if (!authz.ok) return { ok: false, errors: { _: ["Unauthorized"] } };

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const roleId = String(formData.get("roleId") ?? "").trim();

  if (!email) return { ok: false, errors: { email: ["Email is required"] } };
  if (!roleId) return { ok: false, errors: { roleId: ["Role is required"] } };

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (!user) {
    return {
      ok: false,
      errors: { email: ["No user found with that email address"] },
    };
  }

  const result = await createMembership(orgId, { userId: user.id, roleId });

  if (!result.ok) {
    const field = result.code === "CONFLICT" ? "email" : "_";
    return { ok: false, errors: { [field]: [result.error] } };
  }

  revalidatePath(`/orgs/${orgId}/memberships`);
  redirect(`/orgs/${orgId}/memberships`);
}
