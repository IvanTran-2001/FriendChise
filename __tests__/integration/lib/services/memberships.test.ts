/**
 * Integration tests for lib/services/memberships.ts
 *
 * Tests real DB behaviour: unique constraint on duplicate membership (CONFLICT),
 * org owner cannot be removed (INVALID), and cascade cleanup of MemberRole rows
 * when a membership is deleted.
 *
 * Each test that needs a non-member user creates a temporary user via
 * createTempUser() and cleans it up in a finally block. This avoids relying on
 * a seeded non-member pool that may be empty (all seed users are connected to
 * every org via connectSeedUsersToOrg).
 */
import { prisma } from "@/lib/platform/prisma";
import { createMembership, deleteMembership } from "@/lib/services/memberships";
import {
  getSeedOrg,
  getDefaultRole,
  createTempUser,
  cleanupTempUser,
} from "../../helpers";

describe("createMembership", () => {
  it("creates a membership and assigns the role", async () => {
    const org = await getSeedOrg();
    const memberRole = await getDefaultRole(org.id);
    const user = await createTempUser();

    try {
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
    } finally {
      await cleanupTempUser(user.id);
    }
  });

  it("returns CONFLICT when adding the same user twice", async () => {
    const org = await getSeedOrg();
    const memberRole = await getDefaultRole(org.id);
    const user = await createTempUser();

    try {
      await createMembership(org.id, { userId: user.id, roleId: memberRole.id });

      // Second attempt — same user, same org
      const result = await createMembership(org.id, {
        userId: user.id,
        roleId: memberRole.id,
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("CONFLICT");
    } finally {
      await cleanupTempUser(user.id);
    }
  });

  it("returns INVALID when the roleId belongs to a different org", async () => {
    const org = await getSeedOrg();
    const user = await createTempUser();

    try {
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
    } finally {
      await cleanupTempUser(user.id);
    }
  });
});

describe("deleteMembership", () => {
  it("removes the membership and cascades MemberRole rows", async () => {
    const org = await getSeedOrg();
    const memberRole = await getDefaultRole(org.id);
    const user = await createTempUser();

    try {
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
    } finally {
      await cleanupTempUser(user.id);
    }
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
    const memberRole = await getDefaultRole(org.id);
    const user = await createTempUser();

    try {
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
    } finally {
      await cleanupTempUser(user.id);
    }
  });
});
