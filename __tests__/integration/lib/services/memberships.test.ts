/**
 * Integration tests for lib/services/memberships.ts
 *
 * Tests real DB behaviour: unique constraint on duplicate membership (CONFLICT),
 * org owner cannot be removed (INVALID), and cascade cleanup of MemberRole rows
 * when a membership is deleted.
 */
import { prisma } from "@/lib/prisma";
import { createMembership, deleteMembership } from "@/lib/services/memberships";
import { ROLE_KEYS } from "@/lib/rbac";

const SEED_USER_EMAIL =
  process.env.INTEGRATION_TEST_USER_EMAIL ?? "alt28919@gmail.com";

async function getSeedOrg() {
  const user = await prisma.user.findFirstOrThrow({
    where: { email: SEED_USER_EMAIL },
  });
  const membership = await prisma.membership.findFirstOrThrow({
    where: { userId: user.id },
    include: { organization: true },
  });
  return membership.organization;
}

// Returns a user who is NOT already a member of the given org
async function getNonMember(orgId: string) {
  const existing = await prisma.membership.findMany({
    where: { orgId },
    select: { userId: true },
  });
  const memberIds = existing.map((m) => m.userId).filter(Boolean) as string[];
  return prisma.user.findFirstOrThrow({
    where: { id: { notIn: memberIds } },
  });
}

describe("createMembership", () => {
  it("creates a membership and assigns the role", async () => {
    const org = await getSeedOrg();
    const user = await getNonMember(org.id);
    const memberRole = await prisma.role.findFirstOrThrow({
      where: { orgId: org.id, key: ROLE_KEYS.DEFAULT_MEMBER },
    });

    const result = await createMembership(org.id, {
      userId: user.id,
      roleId: memberRole.id,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const memberRole2 = await prisma.memberRole.findFirst({
      where: { membershipId: result.data.id, roleId: memberRole.id },
    });
    expect(memberRole2).not.toBeNull();
  });

  it("returns CONFLICT when adding the same user twice", async () => {
    const org = await getSeedOrg();
    const user = await getNonMember(org.id);
    const memberRole = await prisma.role.findFirstOrThrow({
      where: { orgId: org.id, key: ROLE_KEYS.DEFAULT_MEMBER },
    });

    await createMembership(org.id, { userId: user.id, roleId: memberRole.id });

    // Second attempt — same user, same org
    const result = await createMembership(org.id, {
      userId: user.id,
      roleId: memberRole.id,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("CONFLICT");
  });

  it("returns INVALID when the roleId belongs to a different org", async () => {
    const org = await getSeedOrg();
    const user = await getNonMember(org.id);
    const otherOrg = await prisma.organization.findFirstOrThrow({
      where: { id: { not: org.id } },
    });
    const foreignRole = await prisma.role.findFirstOrThrow({
      where: { orgId: otherOrg.id },
    });

    const result = await createMembership(org.id, {
      userId: user.id,
      roleId: foreignRole.id,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INVALID");
  });
});

describe("deleteMembership", () => {
  it("removes the membership and cascades MemberRole rows", async () => {
    const org = await getSeedOrg();
    const user = await getNonMember(org.id);
    const memberRole = await prisma.role.findFirstOrThrow({
      where: { orgId: org.id, key: ROLE_KEYS.DEFAULT_MEMBER },
    });

    const created = await createMembership(org.id, {
      userId: user.id,
      roleId: memberRole.id,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const membershipId = created.data.id;
    const result = await deleteMembership(org.id, membershipId);
    expect(result.ok).toBe(true);

    const found = await prisma.membership.findUnique({
      where: { id: membershipId },
    });
    expect(found).toBeNull();

    const memberRoles = await prisma.memberRole.findMany({
      where: { membershipId },
    });
    expect(memberRoles).toHaveLength(0);
  });

  it("returns INVALID when trying to remove the org owner", async () => {
    const org = await getSeedOrg();

    // The owner's membership
    const ownerMembership = await prisma.membership.findFirstOrThrow({
      where: { orgId: org.id, userId: org.ownerId },
    });

    const result = await deleteMembership(org.id, ownerMembership.id);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INVALID");

    // Owner membership still intact
    const still = await prisma.membership.findUnique({
      where: { id: ownerMembership.id },
    });
    expect(still).not.toBeNull();
  });

  it("returns NOT_FOUND for a cross-org delete attempt", async () => {
    const org = await getSeedOrg();
    const user = await getNonMember(org.id);
    const memberRole = await prisma.role.findFirstOrThrow({
      where: { orgId: org.id, key: ROLE_KEYS.DEFAULT_MEMBER },
    });

    const created = await createMembership(org.id, {
      userId: user.id,
      roleId: memberRole.id,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const otherOrg = await prisma.organization.findFirstOrThrow({
      where: { id: { not: org.id } },
    });

    const result = await deleteMembership(otherOrg.id, created.data.id);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("NOT_FOUND");
  });
});
