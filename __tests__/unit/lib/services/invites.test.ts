import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  getInvitesForUser,
  getUnseenInviteCount,
  markInvitesSeen,
  getNotificationsForUser,
  getUnseenNotificationCount,
  markNotificationsSeen,
  createMemberInvite,
  acceptMemberInvite,
  acceptBotSlotInvite,
  declineMemberInvite,
  declineBotSlotInvite,
  declineFranchiseInvite,
} from "@/lib/services/invites";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    invite: {
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    notification: {
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    organization: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    role: {
      findMany: vi.fn(),
    },
    membership: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    memberRole: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    franchiseToken: {
      updateMany: vi.fn(),
    },
  },
}));

beforeEach(() => vi.clearAllMocks());

// ─── getInvitesForUser ────────────────────────────────────────────────────────

describe("getInvitesForUser", () => {
  it("returns invites for the user", async () => {
    const invites = [{ id: "inv-1", type: "MEMBER", status: "PENDING" }];
    vi.mocked(prisma.invite.findMany).mockResolvedValue(invites as any);

    const result = await getInvitesForUser("user-1");

    expect(result).toBe(invites);
    expect(prisma.invite.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ recipientId: "user-1" }) }),
    );
  });

  it("returns empty array when user has no invites", async () => {
    vi.mocked(prisma.invite.findMany).mockResolvedValue([]);

    const result = await getInvitesForUser("user-no-invites");

    expect(result).toEqual([]);
  });

  it("filters to include PENDING invites regardless of age", async () => {
    await getInvitesForUser("user-1");

    const call = vi.mocked(prisma.invite.findMany).mock.calls[0][0];
    const orClause = (call as any).where.OR;
    expect(orClause).toContainEqual({ status: "PENDING" });
  });

  it("filters ACCEPTED/DECLINED to last 7 days", async () => {
    vi.mocked(prisma.invite.findMany).mockResolvedValue([]);

    await getInvitesForUser("user-1");

    const call = vi.mocked(prisma.invite.findMany).mock.calls[0][0];
    const orClause = (call as any).where.OR;
    const acceptedClause = orClause.find((c: any) => c.status === "ACCEPTED");
    const declinedClause = orClause.find((c: any) => c.status === "DECLINED");
    expect(acceptedClause.acceptedAt.gte).toBeInstanceOf(Date);
    expect(declinedClause.declinedAt.gte).toBeInstanceOf(Date);
  });
});

// ─── getUnseenInviteCount ─────────────────────────────────────────────────────

describe("getUnseenInviteCount", () => {
  it("returns the count of unseen invites", async () => {
    vi.mocked(prisma.invite.count).mockResolvedValue(3);

    const result = await getUnseenInviteCount("user-1");

    expect(result).toBe(3);
    expect(prisma.invite.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ recipientId: "user-1", seenAt: null }),
      }),
    );
  });

  it("returns 0 when all invites are seen", async () => {
    vi.mocked(prisma.invite.count).mockResolvedValue(0);

    const result = await getUnseenInviteCount("user-1");

    expect(result).toBe(0);
  });
});

// ─── markInvitesSeen ──────────────────────────────────────────────────────────

describe("markInvitesSeen", () => {
  it("marks all unseen invites as seen for the user", async () => {
    vi.mocked(prisma.invite.updateMany).mockResolvedValue({ count: 2 });

    await markInvitesSeen("user-1");

    expect(prisma.invite.updateMany).toHaveBeenCalledWith({
      where: { recipientId: "user-1", seenAt: null },
      data: { seenAt: expect.any(Date) },
    });
  });
});

// ─── getNotificationsForUser ──────────────────────────────────────────────────

describe("getNotificationsForUser", () => {
  it("returns notifications for the user ordered newest-first", async () => {
    const notifications = [
      { id: "notif-1", message: "You got an invite", seenAt: null, createdAt: new Date() },
    ];
    vi.mocked(prisma.notification.findMany).mockResolvedValue(notifications as any);

    const result = await getNotificationsForUser("user-1");

    expect(result).toBe(notifications);
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } }),
    );
  });

  it("limits to 30 notifications", async () => {
    vi.mocked(prisma.notification.findMany).mockResolvedValue([]);

    await getNotificationsForUser("user-1");

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 30 }),
    );
  });
});

// ─── getUnseenNotificationCount ───────────────────────────────────────────────

describe("getUnseenNotificationCount", () => {
  it("returns the count of unseen notifications", async () => {
    vi.mocked(prisma.notification.count).mockResolvedValue(5);

    const result = await getUnseenNotificationCount("user-1");

    expect(result).toBe(5);
    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: { userId: "user-1", seenAt: null },
    });
  });
});

// ─── markNotificationsSeen ────────────────────────────────────────────────────

describe("markNotificationsSeen", () => {
  it("marks all unseen notifications as seen", async () => {
    vi.mocked(prisma.notification.updateMany).mockResolvedValue({ count: 3 });

    await markNotificationsSeen("user-1");

    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", seenAt: null },
      data: { seenAt: expect.any(Date) },
    });
  });
});

// ─── createMemberInvite ───────────────────────────────────────────────────────

describe("createMemberInvite", () => {
  const setup = () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({ name: "Acme" } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ name: "Alice" } as any);
    vi.mocked(prisma.role.findMany).mockResolvedValue([{ id: "role-1", key: "manager" }] as any);
    vi.mocked(prisma.membership.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.invite.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.invite.create).mockResolvedValue({} as any);
  };

  it("creates invite and returns ok: true for valid input", async () => {
    setup();

    const result = await createMemberInvite("org-1", "user-inviter", "user-recipient", ["role-1"], ["mon"]);

    expect(result).toEqual({ ok: true, data: null });
    expect(prisma.invite.create).toHaveBeenCalled();
  });

  it("returns NOT_FOUND when org does not exist", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue(null);

    const result = await createMemberInvite("org-bad", "inv", "rec", ["role-1"], []);

    expect(result).toEqual({
      ok: false,
      error: "Organization not found",
      code: "NOT_FOUND",
    });
  });

  it("returns INVALID when a roleId is not found in the org", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({ name: "Acme" } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ name: "Alice" } as any);
    // Only 0 of 2 requested roles found
    vi.mocked(prisma.role.findMany).mockResolvedValue([]);

    const result = await createMemberInvite("org-1", "inv", "rec", ["role-1", "role-2"], []);

    expect(result).toEqual({
      ok: false,
      error: "One or more roles not found",
      code: "INVALID",
    });
  });

  it("returns INVALID when trying to invite with owner role", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({ name: "Acme" } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ name: "Alice" } as any);
    vi.mocked(prisma.role.findMany).mockResolvedValue([{ id: "role-owner", key: "owner" }] as any);

    const result = await createMemberInvite("org-1", "inv", "rec", ["role-owner"], []);

    expect(result).toEqual({
      ok: false,
      error: "Cannot assign the owner role",
      code: "INVALID",
    });
  });

  it("returns CONFLICT when recipient is already a member", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({ name: "Acme" } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ name: "Alice" } as any);
    vi.mocked(prisma.role.findMany).mockResolvedValue([{ id: "role-1", key: "manager" }] as any);
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({ id: "mem-exists" } as any);

    const result = await createMemberInvite("org-1", "inv", "rec", ["role-1"], []);

    expect(result).toEqual({
      ok: false,
      error: "This user is already a member",
      code: "CONFLICT",
    });
    expect(prisma.invite.create).not.toHaveBeenCalled();
  });

  it("returns CONFLICT when a pending invite already exists", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({ name: "Acme" } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ name: "Alice" } as any);
    vi.mocked(prisma.role.findMany).mockResolvedValue([{ id: "role-1", key: "manager" }] as any);
    vi.mocked(prisma.membership.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.invite.findFirst).mockResolvedValue({ id: "inv-pending" } as any);

    const result = await createMemberInvite("org-1", "inv", "rec", ["role-1"], []);

    expect(result).toEqual({
      ok: false,
      error: "This user already has a pending invite",
      code: "CONFLICT",
    });
    expect(prisma.invite.create).not.toHaveBeenCalled();
  });

  it("handles null invitedById (anonymous invite)", async () => {
    setup();

    const result = await createMemberInvite("org-1", null, "user-recipient", ["role-1"], []);

    expect(result.ok).toBe(true);
  });
});

// ─── acceptMemberInvite ───────────────────────────────────────────────────────

describe("acceptMemberInvite", () => {
  const pendingInvite = {
    id: "inv-1",
    recipientId: "user-1",
    type: "MEMBER",
    status: "PENDING",
    expiresAt: null,
    orgId: "org-1",
    orgName: "Acme",
    invitedById: "inviter-1",
    metadata: { roleIds: ["role-1"], workingDays: ["MON"] },
  };

  beforeEach(() => {
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(prisma));
    vi.mocked(prisma.invite.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.role.findMany).mockResolvedValue([{ id: "role-1" }] as any);
    vi.mocked(prisma.membership.upsert).mockResolvedValue({ id: "mem-1" } as any);
    vi.mocked(prisma.memberRole.createMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ name: "Alice" } as any);
    vi.mocked(prisma.notification.create).mockResolvedValue({} as any);
  });

  it("accepts a pending invite and returns ok: true", async () => {
    vi.mocked(prisma.invite.findUnique).mockResolvedValue(pendingInvite as any);

    const result = await acceptMemberInvite("inv-1", "user-1");

    expect(result).toEqual({ ok: true, data: null });
    expect(prisma.membership.upsert).toHaveBeenCalled();
  });

  it("returns NOT_FOUND when invite does not exist", async () => {
    vi.mocked(prisma.invite.findUnique).mockResolvedValue(null);

    const result = await acceptMemberInvite("inv-bad", "user-1");

    expect(result).toEqual({ ok: false, error: "Invite not found", code: "NOT_FOUND" });
  });

  it("returns NOT_FOUND when invite belongs to a different user", async () => {
    vi.mocked(prisma.invite.findUnique).mockResolvedValue({
      ...pendingInvite,
      recipientId: "other-user",
    } as any);

    const result = await acceptMemberInvite("inv-1", "user-1");

    expect(result).toEqual({ ok: false, error: "Invite not found", code: "NOT_FOUND" });
  });

  it("returns CONFLICT when invite is not pending", async () => {
    vi.mocked(prisma.invite.findUnique).mockResolvedValue({
      ...pendingInvite,
      status: "ACCEPTED",
    } as any);

    const result = await acceptMemberInvite("inv-1", "user-1");

    expect(result).toEqual({
      ok: false,
      error: "This invite is no longer pending",
      code: "CONFLICT",
    });
  });

  it("returns INVALID when invite has expired", async () => {
    vi.mocked(prisma.invite.findUnique).mockResolvedValue({
      ...pendingInvite,
      expiresAt: new Date(Date.now() - 1000),
    } as any);

    const result = await acceptMemberInvite("inv-1", "user-1");

    expect(result).toEqual({
      ok: false,
      error: "This invite has expired",
      code: "INVALID",
    });
  });

  it("returns CONFLICT when invite was already handled during transaction", async () => {
    vi.mocked(prisma.invite.findUnique).mockResolvedValue(pendingInvite as any);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
      vi.mocked(prisma.invite.updateMany).mockResolvedValue({ count: 0 });
      return fn(prisma);
    });

    const result = await acceptMemberInvite("inv-1", "user-1");

    expect(result).toEqual({
      ok: false,
      error: "This invite has already been handled",
      code: "CONFLICT",
    });
  });
});

// ─── declineMemberInvite ──────────────────────────────────────────────────────

describe("declineMemberInvite", () => {
  it("declines a pending invite and returns ok: true", async () => {
    vi.mocked(prisma.invite.updateMany).mockResolvedValue({ count: 1 });

    const result = await declineMemberInvite("inv-1", "user-1");

    expect(result).toEqual({ ok: true, data: null });
    expect(prisma.invite.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "inv-1", recipientId: "user-1", status: "PENDING" }),
        data: expect.objectContaining({ status: "DECLINED" }),
      }),
    );
  });

  it("returns NOT_FOUND when no matching pending invite", async () => {
    vi.mocked(prisma.invite.updateMany).mockResolvedValue({ count: 0 });

    const result = await declineMemberInvite("inv-bad", "user-1");

    expect(result).toEqual({
      ok: false,
      error: "Invite not found or already handled",
      code: "NOT_FOUND",
    });
  });
});

// ─── acceptBotSlotInvite ──────────────────────────────────────────────────────
// Derived from scripts/test-accept-bot-slot.ts smoke test, rewritten as unit tests.

describe("acceptBotSlotInvite", () => {
  const botInvite = {
    id: "inv-bot",
    recipientId: "user-1",
    type: "MEMBER",
    status: "PENDING",
    expiresAt: null,
    orgId: "org-1",
    orgName: "Acme",
    invitedById: "inviter-1",
    metadata: {
      botMembershipId: "mem-bot",
      roleIds: ["role-1"],
      workingDays: ["MON", "TUE"],
    },
  };

  beforeEach(() => {
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(prisma));
    vi.mocked(prisma.invite.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({
      id: "mem-bot",
      userId: null,
    } as any);
    vi.mocked(prisma.membership.update).mockResolvedValue({} as any);
    vi.mocked(prisma.role.findMany).mockResolvedValue([{ id: "role-1" }] as any);
    vi.mocked(prisma.memberRole.deleteMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.memberRole.createMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ name: "Alice" } as any);
    vi.mocked(prisma.notification.create).mockResolvedValue({} as any);
  });

  it("slots the user into the bot membership in-place and returns ok: true", async () => {
    vi.mocked(prisma.invite.findUnique).mockResolvedValue(botInvite as any);

    const result = await acceptBotSlotInvite("inv-bot", "user-1");

    expect(result).toEqual({ ok: true, data: null });
    expect(prisma.membership.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "mem-bot" },
        data: expect.objectContaining({ userId: "user-1", botName: null }),
      }),
    );
  });

  it("preserves the bot membership id (in-place replacement — no new row)", async () => {
    vi.mocked(prisma.invite.findUnique).mockResolvedValue(botInvite as any);

    await acceptBotSlotInvite("inv-bot", "user-1");

    // membership.update must be called, NOT membership.create
    expect(prisma.membership.update).toHaveBeenCalledTimes(1);
  });

  it("replaces bot role assignments with invite roles", async () => {
    vi.mocked(prisma.invite.findUnique).mockResolvedValue(botInvite as any);

    await acceptBotSlotInvite("inv-bot", "user-1");

    expect(prisma.memberRole.deleteMany).toHaveBeenCalledWith({ where: { membershipId: "mem-bot" } });
    expect(prisma.memberRole.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([expect.objectContaining({ roleId: "role-1" })]),
      }),
    );
  });

  it("applies specified working days to the new member", async () => {
    vi.mocked(prisma.invite.findUnique).mockResolvedValue(botInvite as any);

    await acceptBotSlotInvite("inv-bot", "user-1");

    expect(prisma.membership.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ workingDays: ["MON", "TUE"] }),
      }),
    );
  });

  it("returns NOT_FOUND when invite does not exist", async () => {
    vi.mocked(prisma.invite.findUnique).mockResolvedValue(null);

    const result = await acceptBotSlotInvite("inv-bad", "user-1");

    expect(result).toEqual({ ok: false, error: "Invite not found", code: "NOT_FOUND" });
  });

  it("returns INVALID when metadata has no botMembershipId", async () => {
    vi.mocked(prisma.invite.findUnique).mockResolvedValue({
      ...botInvite,
      metadata: { roleIds: ["role-1"] },
    } as any);

    const result = await acceptBotSlotInvite("inv-bot", "user-1");

    expect(result).toEqual({
      ok: false,
      error: "Invalid bot-slot invite",
      code: "INVALID",
    });
  });

  it("returns CONFLICT when invite is not pending", async () => {
    vi.mocked(prisma.invite.findUnique).mockResolvedValue({
      ...botInvite,
      status: "ACCEPTED",
    } as any);

    const result = await acceptBotSlotInvite("inv-bot", "user-1");

    expect(result).toEqual({
      ok: false,
      error: "This invite is no longer pending",
      code: "CONFLICT",
    });
  });

  it("returns CONFLICT when bot slot is already occupied", async () => {
    vi.mocked(prisma.invite.findUnique).mockResolvedValue(botInvite as any);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
      vi.mocked(prisma.invite.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.membership.findUnique).mockResolvedValue({
        id: "mem-bot",
        userId: "another-user",
      } as any);
      return fn(prisma);
    });

    const result = await acceptBotSlotInvite("inv-bot", "user-1");

    expect(result).toEqual({
      ok: false,
      error: "The bot slot was already filled by another user",
      code: "CONFLICT",
    });
  });

  it("returns CONFLICT when invite was already handled during transaction", async () => {
    vi.mocked(prisma.invite.findUnique).mockResolvedValue(botInvite as any);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
      vi.mocked(prisma.invite.updateMany).mockResolvedValue({ count: 0 });
      return fn(prisma);
    });

    const result = await acceptBotSlotInvite("inv-bot", "user-1");

    expect(result).toEqual({
      ok: false,
      error: "This invite has already been handled",
      code: "CONFLICT",
    });
  });

  it("returns INVALID when invite has expired", async () => {
    vi.mocked(prisma.invite.findUnique).mockResolvedValue({
      ...botInvite,
      expiresAt: new Date(Date.now() - 1000),
    } as any);

    const result = await acceptBotSlotInvite("inv-bot", "user-1");

    expect(result).toEqual({
      ok: false,
      error: "This invite has expired",
      code: "INVALID",
    });
  });
});

// ─── declineBotSlotInvite ─────────────────────────────────────────────────────

describe("declineBotSlotInvite", () => {
  it("declines a bot-slot invite and returns ok: true", async () => {
    vi.mocked(prisma.invite.updateMany).mockResolvedValue({ count: 1 });

    const result = await declineBotSlotInvite("inv-1", "user-1");

    expect(result).toEqual({ ok: true, data: null });
    expect(prisma.invite.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "inv-1", recipientId: "user-1" }),
        data: expect.objectContaining({ status: "DECLINED" }),
      }),
    );
  });

  it("returns NOT_FOUND when no matching invite exists", async () => {
    vi.mocked(prisma.invite.updateMany).mockResolvedValue({ count: 0 });

    const result = await declineBotSlotInvite("inv-bad", "user-1");

    expect(result).toEqual({
      ok: false,
      error: "Invite not found or already handled",
      code: "NOT_FOUND",
    });
  });
});

// ─── declineFranchiseInvite ───────────────────────────────────────────────────

describe("declineFranchiseInvite", () => {
  const franchiseInvite = {
    id: "inv-fr",
    recipientId: "user-1",
    type: "FRANCHISE",
    status: "PENDING",
    orgId: "org-1",
    metadata: { token: "tok-abc" },
  };

  beforeEach(() => {
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(prisma));
    vi.mocked(prisma.invite.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.franchiseToken.updateMany).mockResolvedValue({ count: 1 });
  });

  it("declines a franchise invite and expires the token", async () => {
    vi.mocked(prisma.invite.findUnique).mockResolvedValue(franchiseInvite as any);

    const result = await declineFranchiseInvite("inv-fr", "user-1");

    expect(result).toEqual({ ok: true, data: null });
    expect(prisma.franchiseToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ token: "tok-abc", orgId: "org-1" }),
        data: expect.objectContaining({ expiresAt: expect.any(Date) }),
      }),
    );
  });

  it("returns NOT_FOUND when invite does not exist", async () => {
    vi.mocked(prisma.invite.findUnique).mockResolvedValue(null);

    const result = await declineFranchiseInvite("inv-bad", "user-1");

    expect(result).toEqual({ ok: false, error: "Invite not found", code: "NOT_FOUND" });
  });

  it("returns CONFLICT when invite is no longer pending", async () => {
    vi.mocked(prisma.invite.findUnique).mockResolvedValue({
      ...franchiseInvite,
      status: "DECLINED",
    } as any);

    const result = await declineFranchiseInvite("inv-fr", "user-1");

    expect(result).toEqual({
      ok: false,
      error: "This invite is no longer pending",
      code: "CONFLICT",
    });
  });

  it("returns CONFLICT when already handled during transaction", async () => {
    vi.mocked(prisma.invite.findUnique).mockResolvedValue(franchiseInvite as any);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
      vi.mocked(prisma.invite.updateMany).mockResolvedValue({ count: 0 });
      return fn(prisma);
    });

    const result = await declineFranchiseInvite("inv-fr", "user-1");

    expect(result).toEqual({
      ok: false,
      error: "This invite has already been handled",
      code: "CONFLICT",
    });
  });
});
