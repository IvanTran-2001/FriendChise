import { prisma } from "@/lib/platform/prisma";
import { convertMembershipToBot } from "@/lib/services/bots";

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
    await prisma.$transaction(async (tx) => {
      const [ownedOrgs, memberships] = await Promise.all([
        tx.organization.findMany({
          where: { ownerId: userId },
          select: { id: true },
        }),
        tx.membership.findMany({
          where: { userId },
          select: { id: true, orgId: true },
        }),
      ]);

      const ownedOrgIds = new Set(ownedOrgs.map((org) => org.id));
      if (ownedOrgIds.size > 0) {
        const ownedOrgIdList = [...ownedOrgIds];

        await tx.organization.updateMany({
          where: { id: { in: ownedOrgIdList } },
          data: { ownerId: null },
        });
      }

      const botName = user.name ?? user.email;
      await Promise.all(
        memberships.map((membership) =>
          convertMembershipToBot(tx, membership.id, botName),
        ),
      );

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