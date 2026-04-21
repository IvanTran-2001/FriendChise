import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  createMembership,
  deleteMembership,
  getMemberships,
  getMembershipDetail,
  updateMembership,
  setMembershipStatus,
} from "@/lib/services/memberships";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    role: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
    },
    membership: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    memberRole: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    organization: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

const mockMembership = {
  id: "mem-1",
  orgId: "org-1",
  userId: "user-1",
  workingDays: [],
  joinedAt: new Date(),
  status: "ACTIVE",
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── createMembership ─────────────────────────────────────────────────────────

describe("createMembership", () => {
  const input = { userId: "user-1", roleId: "role-1" };

  it("creates membership and returns ok: true with the new membership", async () => {
    vi.mocked(prisma.role.findFirst).mockResolvedValue({ id: "role-1" } as any);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "user-1" } as any);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(prisma));
    vi.mocked(prisma.membership.create).mockResolvedValue(mockMembership as any);
    vi.mocked(prisma.memberRole.create).mockResolvedValue({} as any);

    const result = await createMembership("org-1", input);

    expect(result).toEqual({ ok: true, data: mockMembership });
  });

  it("returns INVALID when roleId does not belong to the org", async () => {
    vi.mocked(prisma.role.findFirst).mockResolvedValue(null);

    const result = await createMembership("org-1", input);

    expect(result).toEqual({
      ok: false,
      error: "Invalid roleId: not found or does not belong to this org",
      code: "INVALID",
    });
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it("returns INVALID when userId does not exist", async () => {
    vi.mocked(prisma.role.findFirst).mockResolvedValue({ id: "role-1" } as any);
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

    const result = await createMembership("org-1", input);

    expect(result).toEqual({
      ok: false,
      error: "Invalid userId: not found",
      code: "INVALID",
    });
  });

  it("returns CONFLICT when membership already exists (P2002)", async () => {
    vi.mocked(prisma.role.findFirst).mockResolvedValue({ id: "role-1" } as any);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "user-1" } as any);
    const uniqueError = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed",
      { code: "P2002", clientVersion: "5.0.0", meta: {} },
    );
    vi.mocked(prisma.$transaction).mockRejectedValue(uniqueError);

    const result = await createMembership("org-1", input);

    expect(result).toEqual({
      ok: false,
      error: "Membership already exists",
      code: "CONFLICT",
    });
  });

  it("returns INVALID on foreign key violation (P2003)", async () => {
    vi.mocked(prisma.role.findFirst).mockResolvedValue({ id: "role-1" } as any);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "user-1" } as any);
    const fkError = new Prisma.PrismaClientKnownRequestError(
      "Foreign key constraint failed",
      { code: "P2003", clientVersion: "5.0.0", meta: {} },
    );
    vi.mocked(prisma.$transaction).mockRejectedValue(fkError);

    const result = await createMembership("org-1", input);

    expect(result).toEqual({
      ok: false,
      error: "Invalid foreign key reference",
      code: "INVALID",
    });
  });

  it("re-throws unexpected errors", async () => {
    vi.mocked(prisma.role.findFirst).mockResolvedValue({ id: "role-1" } as any);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "user-1" } as any);
    vi.mocked(prisma.$transaction).mockRejectedValue(new Error("DB crash"));

    await expect(createMembership("org-1", input)).rejects.toThrow("DB crash");
  });
});

// ─── deleteMembership ─────────────────────────────────────────────────────────

describe("deleteMembership", () => {
  it("deletes membership and returns ok: true", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({
      ownerId: "owner-user",
    } as any);
    vi.mocked(prisma.membership.deleteMany).mockResolvedValue({ count: 1 });

    const result = await deleteMembership("org-1", "user-1");

    expect(result).toEqual({ ok: true, data: null });
  });

  it("returns NOT_FOUND when org does not exist", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue(null);

    const result = await deleteMembership("org-1", "user-1");

    expect(result).toEqual({
      ok: false,
      error: "Org not found",
      code: "NOT_FOUND",
    });
    expect(prisma.membership.deleteMany).not.toHaveBeenCalled();
  });

  it("returns INVALID when trying to remove the org owner", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({
      ownerId: "owner-user",
    } as any);

    const result = await deleteMembership("org-1", "owner-user");

    expect(result).toEqual({
      ok: false,
      error: "Cannot remove the organization owner",
      code: "INVALID",
    });
    expect(prisma.membership.deleteMany).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND when membership does not exist", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({
      ownerId: "owner-user",
    } as any);
    vi.mocked(prisma.membership.deleteMany).mockResolvedValue({ count: 0 });

    const result = await deleteMembership("org-1", "user-with-no-membership");

    expect(result).toEqual({
      ok: false,
      error: "Membership not found",
      code: "NOT_FOUND",
    });
  });
});

// ─── getMemberships ───────────────────────────────────────────────────────────

describe("getMemberships", () => {
  it("returns all memberships for the org", async () => {
    const memberships = [mockMembership];
    vi.mocked(prisma.membership.findMany).mockResolvedValue(memberships as any);

    const result = await getMemberships("org-1");

    expect(result).toBe(memberships);
    expect(prisma.membership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orgId: "org-1" } }),
    );
  });

  it("returns empty array when org has no members", async () => {
    vi.mocked(prisma.membership.findMany).mockResolvedValue([]);

    const result = await getMemberships("org-1");

    expect(result).toEqual([]);
  });
});

// ─── getMembershipDetail ──────────────────────────────────────────────────────

describe("getMembershipDetail", () => {
  it("returns membership detail when found", async () => {
    const detail = { ...mockMembership, user: { id: "user-1", name: "Alice" } };
    vi.mocked(prisma.membership.findUnique).mockResolvedValue(detail as any);

    const result = await getMembershipDetail("org-1", "user-1");

    expect(result).toBe(detail);
    expect(prisma.membership.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_orgId: { userId: "user-1", orgId: "org-1" } },
      }),
    );
  });

  it("returns null when membership not found", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue(null);

    const result = await getMembershipDetail("org-1", "non-existent");

    expect(result).toBeNull();
  });
});

// ─── updateMembership ─────────────────────────────────────────────────────────

describe("updateMembership", () => {
  const updateData = { workingDays: ["MON", "TUE"], roleIds: ["role-1"] };

  it("updates working days and roles, returns ok: true", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue(
      { id: "mem-1" } as any,
    );
    vi.mocked(prisma.role.findMany).mockResolvedValue([
      { id: "role-1", key: "manager" },
    ] as any);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(prisma));
    vi.mocked(prisma.membership.update).mockResolvedValue({} as any);
    vi.mocked(prisma.memberRole.deleteMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.memberRole.create).mockResolvedValue({} as any);

    const result = await updateMembership("org-1", "user-1", updateData);

    expect(result).toEqual({ ok: true, data: null });
  });

  it("returns NOT_FOUND when membership does not exist", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue(null);

    const result = await updateMembership("org-1", "user-1", updateData);

    expect(result).toEqual({
      ok: false,
      error: "Membership not found",
      code: "NOT_FOUND",
    });
  });

  it("returns INVALID when roleIds is empty", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue(
      { id: "mem-1" } as any,
    );

    const result = await updateMembership("org-1", "user-1", {
      workingDays: [],
      roleIds: [],
    });

    expect(result).toEqual({
      ok: false,
      error: "At least one role is required",
      code: "INVALID",
    });
  });

  it("returns INVALID when a roleId does not belong to the org", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue(
      { id: "mem-1" } as any,
    );
    // Only 0 of 1 requested roles found in this org
    vi.mocked(prisma.role.findMany).mockResolvedValue([]);

    const result = await updateMembership("org-1", "user-1", {
      workingDays: [],
      roleIds: ["foreign-role"],
    });

    expect(result).toEqual({
      ok: false,
      error: "One or more roles not found",
      code: "INVALID",
    });
  });

  it("returns INVALID when trying to assign the owner role", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue(
      { id: "mem-1" } as any,
    );
    vi.mocked(prisma.role.findMany).mockResolvedValue([
      { id: "role-owner", key: "owner" },
    ] as any);

    const result = await updateMembership("org-1", "user-1", {
      workingDays: [],
      roleIds: ["role-owner"],
    });

    expect(result).toEqual({
      ok: false,
      error: "Cannot assign the owner role",
      code: "INVALID",
    });
  });
});

// ─── setMembershipStatus ──────────────────────────────────────────────────────

describe("setMembershipStatus", () => {
  it("returns ok: true on successful status update", async () => {
    vi.mocked(prisma.membership.updateMany).mockResolvedValue({ count: 1 });

    const result = await setMembershipStatus("org-1", "user-1", "RESTRICTED");

    expect(result).toEqual({ ok: true, data: null });
    expect(prisma.membership.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", orgId: "org-1" },
      data: { status: "RESTRICTED" },
    });
  });

  it("returns NOT_FOUND when no membership matches", async () => {
    vi.mocked(prisma.membership.updateMany).mockResolvedValue({ count: 0 });

    const result = await setMembershipStatus("org-1", "user-1", "ACTIVE");

    expect(result).toEqual({
      ok: false,
      error: "Membership not found",
      code: "NOT_FOUND",
    });
  });
});
