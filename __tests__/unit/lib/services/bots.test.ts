import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  createBot,
  deleteBot,
  memberToBot,
  updateBot,
} from "@/lib/services/bots";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    role: {
      findMany: vi.fn(),
    },
    membership: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    memberRole: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    invite: {
      updateMany: vi.fn(),
    },
    organization: {
      findUnique: vi.fn(),
    },
  },
}));

const mockBot = {
  id: "mem-bot",
  orgId: "org-1",
  userId: null,
  botName: "Bot Alice",
  workingDays: ["MON"],
  status: "ACTIVE",
  joinedAt: new Date(),
  memberRoles: [{ role: { id: "role-1", name: "Manager" } }],
};

beforeEach(() => vi.clearAllMocks());

// ─── createBot ────────────────────────────────────────────────────────────────

describe("createBot", () => {
  it("creates a bot membership and returns ok: true with data", async () => {
    vi.mocked(prisma.role.findMany).mockResolvedValue([
      { id: "role-1", key: "manager" },
    ] as any);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) =>
      fn(prisma),
    );
    vi.mocked(prisma.membership.create).mockResolvedValue({
      id: "mem-bot",
    } as any);
    vi.mocked(prisma.memberRole.create).mockResolvedValue({} as any);
    vi.mocked(prisma.membership.findUniqueOrThrow).mockResolvedValue(
      mockBot as any,
    );

    const result = await createBot("org-1", {
      botName: "Bot Alice",
      roleIds: ["role-1"],
      workingDays: ["MON"],
    });

    expect(result).toEqual({ ok: true, data: mockBot });
    expect(prisma.membership.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orgId: "org-1",
          userId: null,
          botName: "Bot Alice",
        }),
      }),
    );
  });

  it("returns INVALID when no roleIds provided", async () => {
    const result = await createBot("org-1", { botName: "Bot", roleIds: [] });

    expect(result).toEqual({
      ok: false,
      error: "At least one role is required",
      code: "INVALID",
    });
    expect(prisma.role.findMany).not.toHaveBeenCalled();
  });

  it("returns INVALID when a roleId does not belong to the org", async () => {
    vi.mocked(prisma.role.findMany).mockResolvedValue([]);

    const result = await createBot("org-1", {
      botName: "Bot",
      roleIds: ["role-bad"],
    });

    expect(result).toEqual({
      ok: false,
      error: "One or more roles not found or do not belong to this org",
      code: "INVALID",
    });
  });

  it("returns INVALID when attempting to assign the owner role", async () => {
    vi.mocked(prisma.role.findMany).mockResolvedValue([
      { id: "role-owner", key: "owner" },
    ] as any);

    const result = await createBot("org-1", {
      botName: "Bot",
      roleIds: ["role-owner"],
    });

    expect(result).toEqual({
      ok: false,
      error: "Cannot assign the owner role",
      code: "INVALID",
    });
  });

  it("creates membership with empty workingDays when not supplied", async () => {
    vi.mocked(prisma.role.findMany).mockResolvedValue([
      { id: "role-1", key: "manager" },
    ] as any);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) =>
      fn(prisma),
    );
    vi.mocked(prisma.membership.create).mockResolvedValue({
      id: "mem-bot",
    } as any);
    vi.mocked(prisma.memberRole.create).mockResolvedValue({} as any);
    vi.mocked(prisma.membership.findUniqueOrThrow).mockResolvedValue(
      mockBot as any,
    );

    await createBot("org-1", { botName: "Bot", roleIds: ["role-1"] });

    expect(prisma.membership.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ workingDays: [] }),
      }),
    );
  });
});

// ─── deleteBot ────────────────────────────────────────────────────────────────

describe("deleteBot", () => {
  it("deletes a bot membership and returns ok: true", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({
      id: "mem-bot",
      orgId: "org-1",
      userId: null,
    } as any);
    vi.mocked(prisma.$transaction).mockResolvedValue([{ count: 0 }, {}] as any);

    const result = await deleteBot("org-1", "mem-bot");

    expect(result).toEqual({ ok: true, data: null });
  });

  it("returns NOT_FOUND when membership does not exist", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue(null);

    const result = await deleteBot("org-1", "mem-bad");

    expect(result).toEqual({
      ok: false,
      error: "Bot not found",
      code: "NOT_FOUND",
    });
  });

  it("returns NOT_FOUND when membership belongs to a different org", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({
      id: "mem-bot",
      orgId: "org-other",
      userId: null,
    } as any);

    const result = await deleteBot("org-1", "mem-bot");

    expect(result).toEqual({
      ok: false,
      error: "Bot not found",
      code: "NOT_FOUND",
    });
  });

  it("returns INVALID when membership belongs to a real user", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({
      id: "mem-1",
      orgId: "org-1",
      userId: "user-real",
    } as any);

    const result = await deleteBot("org-1", "mem-1");

    expect(result).toEqual({
      ok: false,
      error: "Membership belongs to a real user — use deleteMembership instead",
      code: "INVALID",
    });
  });

  it("cancels any pending BOT_SLOT invites in the same transaction", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({
      id: "mem-bot",
      orgId: "org-1",
      userId: null,
    } as any);
    vi.mocked(prisma.invite.updateMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(prisma.membership.delete).mockResolvedValue({} as any);
    vi.mocked(prisma.$transaction).mockImplementation(async (arr: any) => {
      return Promise.all(Array.isArray(arr) ? arr : [arr]);
    });

    const result = await deleteBot("org-1", "mem-bot");

    expect(result).toEqual({ ok: true, data: null });
    expect(prisma.invite.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "DECLINED" }),
      }),
    );
    expect(prisma.membership.delete).toHaveBeenCalledWith({
      where: { id: "mem-bot" },
    });
  });
});

// ─── memberToBot ─────────────────────────────────────────────────────────────

describe("memberToBot", () => {
  const realMembership = {
    id: "mem-1",
    orgId: "org-1",
    userId: "user-1",
    user: { id: "user-1", name: "Alice" },
  };

  beforeEach(() => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({
      ownerId: "owner-99",
    } as any);
    vi.mocked(prisma.membership.findUnique).mockResolvedValue(
      realMembership as any,
    );
    vi.mocked(prisma.membership.update).mockResolvedValue(mockBot as any);
  });

  it("converts a real membership to a bot and returns ok: true", async () => {
    const result = await memberToBot("org-1", {
      membershipId: "mem-1",
      overrideName: undefined,
    });

    expect(result).toEqual({ ok: true, data: mockBot });
    expect(prisma.membership.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: null }),
      }),
    );
  });

  it("uses the overrideName when provided", async () => {
    await memberToBot("org-1", {
      membershipId: "mem-1",
      overrideName: "Custom Bot Name",
    });

    expect(prisma.membership.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ botName: "Custom Bot Name" }),
      }),
    );
  });

  it("falls back to user name when no overrideName", async () => {
    await memberToBot("org-1", {
      membershipId: "mem-1",
      overrideName: undefined,
    });

    expect(prisma.membership.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ botName: "Alice" }),
      }),
    );
  });

  it("returns NOT_FOUND when org does not exist", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue(null);

    const result = await memberToBot("org-bad", {
      membershipId: "mem-1",
      overrideName: undefined,
    });

    expect(result).toEqual({
      ok: false,
      error: "Org not found",
      code: "NOT_FOUND",
    });
  });

  it("returns NOT_FOUND when membership does not exist", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue(null);

    const result = await memberToBot("org-1", {
      membershipId: "mem-bad",
      overrideName: undefined,
    });

    expect(result).toEqual({
      ok: false,
      error: "Membership not found",
      code: "NOT_FOUND",
    });
  });

  it("returns INVALID when membership is already a bot", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({
      ...realMembership,
      userId: null,
    } as any);

    const result = await memberToBot("org-1", {
      membershipId: "mem-1",
      overrideName: undefined,
    });

    expect(result).toEqual({
      ok: false,
      error: "Membership is already a bot",
      code: "INVALID",
    });
  });

  it("returns INVALID when trying to convert the org owner", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({
      ownerId: "user-1",
    } as any);

    const result = await memberToBot("org-1", {
      membershipId: "mem-1",
      overrideName: undefined,
    });

    expect(result).toEqual({
      ok: false,
      error: "Cannot convert the organization owner to a bot",
      code: "INVALID",
    });
  });
});

// ─── updateBot ────────────────────────────────────────────────────────────────

describe("updateBot", () => {
  const updateData = {
    botName: "Updated Bot",
    workingDays: ["tue" as const],
    roleIds: ["role-1"],
  };

  beforeEach(() => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({
      id: "mem-bot",
      userId: null,
    } as any);
    vi.mocked(prisma.role.findMany).mockResolvedValue([
      { id: "role-1", key: "manager" },
    ] as any);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) =>
      fn(prisma),
    );
    vi.mocked(prisma.membership.update).mockResolvedValue({} as any);
    vi.mocked(prisma.memberRole.deleteMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.memberRole.create).mockResolvedValue({} as any);
  });

  it("updates bot name, working days, and roles; returns ok: true", async () => {
    const result = await updateBot("org-1", "mem-bot", updateData);

    expect(result).toEqual({ ok: true, data: null });
    expect(prisma.membership.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          botName: "Updated Bot",
          workingDays: ["tue"],
        }),
      }),
    );
  });

  it("returns NOT_FOUND when bot does not exist in org", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue(null);

    const result = await updateBot("org-1", "mem-bad", updateData);

    expect(result).toEqual({
      ok: false,
      error: "Bot not found",
      code: "NOT_FOUND",
    });
  });

  it("returns INVALID when membership belongs to a real user", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({
      id: "mem-1",
      userId: "user-real",
    } as any);

    const result = await updateBot("org-1", "mem-1", updateData);

    expect(result).toEqual({
      ok: false,
      error: "Membership belongs to a real user",
      code: "INVALID",
    });
  });

  it("returns INVALID when a roleId does not belong to the org", async () => {
    vi.mocked(prisma.role.findMany).mockResolvedValue([]);

    const result = await updateBot("org-1", "mem-bot", updateData);

    expect(result).toEqual({
      ok: false,
      error: "One or more roles not found",
      code: "INVALID",
    });
  });

  it("returns INVALID when trying to assign the owner role", async () => {
    vi.mocked(prisma.role.findMany).mockResolvedValue([
      { id: "role-1", key: "owner" },
    ] as any);

    const result = await updateBot("org-1", "mem-bot", updateData);

    expect(result).toEqual({
      ok: false,
      error: "Cannot assign the owner role",
      code: "INVALID",
    });
  });

  it("replaces all member roles atomically", async () => {
    await updateBot("org-1", "mem-bot", updateData);

    expect(prisma.memberRole.deleteMany).toHaveBeenCalledWith({
      where: { membershipId: "mem-bot" },
    });
    expect(prisma.memberRole.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ roleId: "role-1" }),
      }),
    );
  });
});
