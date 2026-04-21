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
} from "@/lib/services/invites";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    invite: {
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    notification: {
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
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
