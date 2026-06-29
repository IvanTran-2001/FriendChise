"use server";

import { prisma } from "@/lib/prisma";
import { requireUserAction } from "@/lib/authz";
import { signOut } from "@/auth";

/**
 * Permanently deletes the user's account and all associated owned organizations.
 * Verifies the caller's identity and checks confirmation text.
 */
export async function deleteUserAccountAction(
  confirmText: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // 1. Verify user session
  const authz = await requireUserAction();
  if (!authz.ok) {
    return { ok: false, error: "Unauthorized" };
  }

  // 2. Fetch the user details to match name or email
  const user = await prisma.user.findUnique({
    where: { id: authz.userId },
    select: { name: true, email: true },
  });

  if (!user) {
    return { ok: false, error: "User not found" };
  }

  const expectedMatch = user.name ?? user.email;
  if (confirmText !== expectedMatch) {
    return { ok: false, error: "Confirmation text does not match" };
  }

  try {
    // 3. Find all organizations owned by this user
    const ownedOrgs = await prisma.organization.findMany({
      where: { ownerId: authz.userId },
      select: { id: true },
    });
    const ownedOrgIds = ownedOrgs.map((o) => o.id);

    await prisma.$transaction(async (tx) => {
      if (ownedOrgIds.length > 0) {
        // Clear parentId links to these orgs for any child orgs to avoid foreign key violations
        await tx.organization.updateMany({
          where: { parentId: { in: ownedOrgIds } },
          data: { parentId: null },
        });

        // Delete all organizations owned by the user
        await tx.organization.deleteMany({
          where: { id: { in: ownedOrgIds } },
        });
      }

      // 4. Delete the user
      await tx.user.delete({
        where: { id: authz.userId },
      });
    });

    // 5. Sign out user and redirect to signin page
    await signOut({ redirectTo: "/signin" });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Failed to delete account",
    };
  }
}
