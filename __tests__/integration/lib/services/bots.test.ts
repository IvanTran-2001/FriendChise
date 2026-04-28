/**
 * Integration tests for lib/services/bots.ts
 *
 * Tests createBot, deleteBot, memberToBot, botToMember, and updateBot against
 * the real database. Tests that fill a bot slot with a real user use
 * createTempUser() + cleanup so the seeded non-member pool is not depleted.
 */
import { prisma } from "@/lib/prisma";
import {
  createBot,
  deleteBot,
  memberToBot,
  botToMember,
  updateBot,
} from "@/lib/services/bots";
import { ROLE_KEYS } from "@/lib/rbac";
import {
  getSeedOrg,
  getSeedUser,
  getDefaultRole,
  createTempUser,
} from "../../helpers";

describe("createBot", () => {
  it("creates a bot membership with null userId and correct roles", async () => {
    const org = await getSeedOrg();
    const role = await getDefaultRole(org.id);

    const result = await createBot(org.id, {
      botName: `Bot ${crypto.randomUUID()}`,
      roleIds: [role.id],
      workingDays: ["mon", "wed"],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const bot = result.data;
    expect(bot.orgId).toBe(org.id);
    expect(bot.memberRoles).toHaveLength(1);
    expect(bot.memberRoles[0].role.id).toBe(role.id);
    expect(bot.workingDays).toEqual(["mon", "wed"]);

    // Verify userId is null in DB
    const membership = await prisma.membership.findUnique({
      where: { id: bot.id },
    });
    expect(membership?.userId).toBeNull();
  });

  it("returns INVALID when roleIds is empty", async () => {
    const org = await getSeedOrg();

    const result = await createBot(org.id, { botName: "Bot", roleIds: [] });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INVALID");
  });

  it("returns INVALID when a roleId belongs to a different org", async () => {
    const org = await getSeedOrg();
    const crossOrgRole = await prisma.role.findFirstOrThrow({
      where: { orgId: { not: org.id }, key: ROLE_KEYS.DEFAULT_MEMBER },
    });

    const result = await createBot(org.id, {
      botName: "Bot",
      roleIds: [crossOrgRole.id],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INVALID");
  });

  it("returns INVALID when the Owner role is specified", async () => {
    const org = await getSeedOrg();
    const ownerRole = await prisma.role.findFirstOrThrow({
      where: { orgId: org.id, key: ROLE_KEYS.OWNER },
    });

    const result = await createBot(org.id, {
      botName: "Bot",
      roleIds: [ownerRole.id],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INVALID");
  });
});

describe("deleteBot", () => {
  it("removes the bot membership from the DB", async () => {
    const org = await getSeedOrg();
    const role = await getDefaultRole(org.id);
    const created = await createBot(org.id, {
      botName: `Bot ${crypto.randomUUID()}`,
      roleIds: [role.id],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await deleteBot(org.id, created.data.id);

    expect(result.ok).toBe(true);
    const membership = await prisma.membership.findUnique({
      where: { id: created.data.id },
    });
    expect(membership).toBeNull();
  });

  it("returns INVALID when the membershipId belongs to a real user", async () => {
    const org = await getSeedOrg();
    const user = await getSeedUser(); // Casey is a real member
    const membership = await prisma.membership.findFirstOrThrow({
      where: { userId: user.id, orgId: org.id },
    });

    const result = await deleteBot(org.id, membership.id);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INVALID");
  });

  it("returns NOT_FOUND for a cross-org bot", async () => {
    const org = await getSeedOrg();
    const role = await getDefaultRole(org.id);
    const otherOrg = await prisma.organization.findFirstOrThrow({
      where: { id: { not: org.id } },
    });

    const created = await createBot(org.id, {
      botName: `Bot ${crypto.randomUUID()}`,
      roleIds: [role.id],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await deleteBot(otherOrg.id, created.data.id);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("NOT_FOUND");

    // Cleanup — delete the bot we created
    await deleteBot(org.id, created.data.id);
  });
});

describe("memberToBot", () => {
  it("clears userId and sets botName on the membership", async () => {
    const org = await getSeedOrg();
    const role = await getDefaultRole(org.id);
    const tempUser = await createTempUser();

    // Create a real membership directly (bypass the service to avoid role guards)
    const membership = await prisma.membership.create({
      data: { orgId: org.id, userId: tempUser.id, workingDays: [] },
    });
    await prisma.memberRole.create({
      data: { membershipId: membership.id, roleId: role.id },
    });

    try {
      const result = await memberToBot(org.id, {
        membershipId: membership.id,
        overrideName: "Temp Bot",
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const updated = await prisma.membership.findUnique({
        where: { id: membership.id },
      });
      expect(updated?.userId).toBeNull();
      expect(updated?.botName).toBe("Temp Bot");
    } finally {
      await prisma.memberRole.deleteMany({
        where: { membershipId: membership.id },
      });
      await prisma.membership.deleteMany({ where: { id: membership.id } });
      await prisma.user.delete({ where: { id: tempUser.id } });
    }
  });

  it("returns INVALID when trying to convert the org owner", async () => {
    const org = await getSeedOrg();
    const orgRecord = await prisma.organization.findUniqueOrThrow({
      where: { id: org.id },
      select: { ownerId: true },
    });
    const ownerMembership = await prisma.membership.findFirstOrThrow({
      where: { userId: orgRecord.ownerId, orgId: org.id },
    });

    const result = await memberToBot(org.id, {
      membershipId: ownerMembership.id,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INVALID");
  });
});

describe("botToMember", () => {
  it("fills a bot slot with a real user (clears botName, sets userId)", async () => {
    const org = await getSeedOrg();
    const role = await getDefaultRole(org.id);
    const tempUser = await createTempUser();

    // Create a bot slot for this test
    const bot = await prisma.membership.create({
      data: {
        orgId: org.id,
        userId: null,
        botName: "Temp Slot",
        workingDays: [],
      },
    });
    await prisma.memberRole.create({
      data: { membershipId: bot.id, roleId: role.id },
    });

    try {
      const result = await botToMember(org.id, {
        membershipId: bot.id,
        userId: tempUser.id,
      });

      expect(result.ok).toBe(true);

      const updated = await prisma.membership.findUnique({
        where: { id: bot.id },
      });
      expect(updated?.userId).toBe(tempUser.id);
      expect(updated?.botName).toBeNull();
    } finally {
      await prisma.memberRole.deleteMany({ where: { membershipId: bot.id } });
      await prisma.membership.delete({ where: { id: bot.id } });
      await prisma.user.delete({ where: { id: tempUser.id } });
    }
  });

  it("returns CONFLICT when the user is already a member of the org", async () => {
    const org = await getSeedOrg();
    const user = await getSeedUser(); // Casey is already a member
    const role = await getDefaultRole(org.id);

    // Create a fresh bot slot
    const bot = await prisma.membership.create({
      data: {
        orgId: org.id,
        userId: null,
        botName: "Conflict Slot",
        workingDays: [],
      },
    });
    await prisma.memberRole.create({
      data: { membershipId: bot.id, roleId: role.id },
    });

    try {
      const result = await botToMember(org.id, {
        membershipId: bot.id,
        userId: user.id,
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("CONFLICT");
    } finally {
      await prisma.memberRole.deleteMany({ where: { membershipId: bot.id } });
      await prisma.membership.delete({ where: { id: bot.id } });
    }
  });
});

describe("updateBot", () => {
  it("replaces the bot name, working days, and role assignments", async () => {
    const org = await getSeedOrg();
    const role = await getDefaultRole(org.id);

    const created = await createBot(org.id, {
      botName: `Bot ${crypto.randomUUID()}`,
      roleIds: [role.id],
      workingDays: [],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    // Find a second role to replace with
    const otherRole = await prisma.role.findFirstOrThrow({
      where: {
        orgId: org.id,
        key: { not: ROLE_KEYS.OWNER },
        id: { not: role.id },
      },
    });

    const result = await updateBot(org.id, created.data.id, {
      botName: "Updated Bot",
      workingDays: ["mon", "fri"],
      roleIds: [otherRole.id],
    });

    expect(result.ok).toBe(true);

    const updated = await prisma.membership.findUnique({
      where: { id: created.data.id },
      include: { memberRoles: true },
    });
    expect(updated?.botName).toBe("Updated Bot");
    expect(updated?.workingDays).toEqual(["mon", "fri"]);
    expect(updated?.memberRoles).toHaveLength(1);
    expect(updated?.memberRoles[0].roleId).toBe(otherRole.id);
  });

  it("returns NOT_FOUND for a bot that does not exist in the org", async () => {
    const org = await getSeedOrg();
    const role = await getDefaultRole(org.id);

    const result = await updateBot(org.id, "nonexistent-bot-id", {
      botName: "Ghost",
      workingDays: [],
      roleIds: [role.id],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("NOT_FOUND");
  });
});
