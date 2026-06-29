"use server";

import { requireUserAction } from "@/lib/authz";
import { signOut } from "@/auth";
import { deleteUserAccount } from "@/lib/services/users";
export async function deleteUserAccountAction(
  confirmText: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const authz = await requireUserAction();
  if (!authz.ok) {
    return { ok: false, error: "Unauthorized" };
  }

  const result = await deleteUserAccount(authz.userId, confirmText);
  if (!result.ok) {
    return result;
  }

  await signOut({ redirectTo: "/signin" });
  return { ok: true };
}
