import { prisma } from "@/lib/prisma";

/**
 * Deletes the current user's account after confirming their display name or email.
 * Also clears ownership of child orgs before removing orgs to avoid FK issues.
 */
export async function deleteUserAccount(
  userId: string,
  confirmText: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
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
    const ownedOrgs = await prisma.organization.findMany({
      where: { ownerId: userId },
      select: { id: true },
    });
    const ownedOrgIds = ownedOrgs.map((org) => org.id);

    await prisma.$transaction(async (tx) => {
      if (ownedOrgIds.length > 0) {
        await tx.organization.updateMany({
          where: { parentId: { in: ownedOrgIds } },
          data: { parentId: null },
        });

        await tx.organization.deleteMany({
          where: { id: { in: ownedOrgIds } },
        });
      }

      await tx.user.delete({
        where: { id: userId },
      });
    });

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to delete account",
    };
  }
}