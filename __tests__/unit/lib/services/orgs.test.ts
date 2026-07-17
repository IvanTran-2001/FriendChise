import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/platform/prisma";
import { createOrg, joinFranchise } from "@/lib/services/orgs";

vi.mock("@/lib/platform/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    organization: { create: vi.fn() },
    role: { create: vi.fn() },
    permission: { createMany: vi.fn() },
    membership: { create: vi.fn() },
    memberRole: { createMany: vi.fn() },
    franchiseToken: { findUnique: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn() },
    invite: { updateMany: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

// Minimal stubs for franchise clone helpers — these are called inside the
// transaction for joinFranchise but not for createOrg.
vi.mock("@/lib/services/franchise", () => ({
  cloneRolesFromParent: vi.fn(),
  cloneTagsFromParent: vi.fn(),
  cloneTasksFromParent: vi.fn(),
  cloneToolDataFromParent: vi.fn(),
  cloneTemplatesFromParent: vi.fn(),
  cloneTimetableSettingsFromParent: vi.fn(),
}));

beforeEach(() => vi.clearAllMocks());

describe("createOrg", () => {
  const input = { title: "My Café" };

  it("runs inside a transaction and returns org + roles + membership", async () => {
    const mockOrg = { id: "org-1", name: "My Café" };
    const mockOwnerRole = { id: "role-owner", key: "owner" };
    const mockMemberRole = { id: "role-member", key: "default_member" };
    const mockMembership = { id: "mem-1" };

    // Transaction runs its callback with the prisma mock as tx
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) =>
      fn(prisma),
    );
    vi.mocked(prisma.organization.create).mockResolvedValue(mockOrg as any);
    // bootstrapRoles creates two roles — mock to return ownerRole then memberRole
    vi.mocked(prisma.role.create)
      .mockResolvedValueOnce(mockOwnerRole as any)
      .mockResolvedValueOnce(mockMemberRole as any);
    vi.mocked(prisma.permission.createMany).mockResolvedValue({ count: 10 });
    vi.mocked(prisma.membership.create).mockResolvedValue(
      mockMembership as any,
    );
    vi.mocked(prisma.memberRole.createMany).mockResolvedValue({ count: 2 });

    const result = await createOrg("user-1", input as any);

    expect(result).toMatchObject({
      org: mockOrg,
      ownerRole: mockOwnerRole,
      memberRole: mockMemberRole,
      membership: mockMembership,
    });
  });

  it("creates the org with the correct name and ownerId", async () => {
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) =>
      fn(prisma),
    );
    vi.mocked(prisma.organization.create).mockResolvedValue({
      id: "org-1",
      name: "My Café",
    } as any);
    vi.mocked(prisma.role.create).mockResolvedValue({
      id: "role-1",
      key: "owner",
    } as any);
    vi.mocked(prisma.permission.createMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.membership.create).mockResolvedValue({
      id: "mem-1",
    } as any);
    vi.mocked(prisma.memberRole.createMany).mockResolvedValue({ count: 2 });

    await createOrg("user-1", input as any);

    expect(prisma.organization.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: "My Café", ownerId: "user-1" }),
      }),
    );
  });

  it("defaults timezone to Australia/Sydney when not supplied", async () => {
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) =>
      fn(prisma),
    );
    vi.mocked(prisma.organization.create).mockResolvedValue({
      id: "org-1",
    } as any);
    vi.mocked(prisma.role.create).mockResolvedValue({
      id: "role-1",
      key: "owner",
    } as any);
    vi.mocked(prisma.permission.createMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.membership.create).mockResolvedValue({
      id: "mem-1",
    } as any);
    vi.mocked(prisma.memberRole.createMany).mockResolvedValue({ count: 2 });

    await createOrg("user-1", { title: "No TZ" } as any);

    expect(prisma.organization.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ timezone: "Australia/Sydney" }),
      }),
    );
  });

  it("creates Owner and Default Member roles for the org", async () => {
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) =>
      fn(prisma),
    );
    vi.mocked(prisma.organization.create).mockResolvedValue({
      id: "org-1",
    } as any);
    vi.mocked(prisma.role.create)
      .mockResolvedValueOnce({ id: "role-owner", key: "owner" } as any)
      .mockResolvedValueOnce({
        id: "role-member",
        key: "default_member",
      } as any);
    vi.mocked(prisma.permission.createMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.membership.create).mockResolvedValue({
      id: "mem-1",
    } as any);
    vi.mocked(prisma.memberRole.createMany).mockResolvedValue({ count: 2 });

    await createOrg("user-1", input as any);

    expect(prisma.role.create).toHaveBeenCalledTimes(2);
  });

  it("assigns the creator membership to both Owner and Default Member roles", async () => {
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) =>
      fn(prisma),
    );
    vi.mocked(prisma.organization.create).mockResolvedValue({
      id: "org-1",
    } as any);
    vi.mocked(prisma.role.create)
      .mockResolvedValueOnce({ id: "role-owner", key: "owner" } as any)
      .mockResolvedValueOnce({
        id: "role-member",
        key: "default_member",
      } as any);
    vi.mocked(prisma.permission.createMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.membership.create).mockResolvedValue({
      id: "mem-1",
    } as any);
    vi.mocked(prisma.memberRole.createMany).mockResolvedValue({ count: 2 });

    await createOrg("user-1", input as any);

    expect(prisma.memberRole.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ roleId: "role-owner" }),
        expect.objectContaining({ roleId: "role-member" }),
      ]),
    });
  });
});

// ─── joinFranchise ───────────────────────────────────────────────────────────

describe("joinFranchise", () => {
  it("clones the parent's shared catalog into the child org", async () => {
    const mockOrg = { id: "child-org", name: "Parent Org: Alice" };
    const roleIdMap = new Map([["parent-role", "role-owner"]]);
    const inheritedTaskIds = new Set(["parent-task"]);
    const toolItemIdMap = new Map([["parent-item", "item-child"]]);
    const mockMembership = { id: "mem-1" };

    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) =>
      fn(prisma),
    );
    vi.mocked(prisma.franchiseToken.findUnique).mockResolvedValue({
      id: "token-1",
      token: "tok-valid",
      orgId: "parent-org",
      invitedEmail: "alice@example.com",
      usedByOrgId: null,
      expiresAt: new Date(Date.now() + 60_000),
      organization: { id: "parent-org", name: "Parent Org", image: null },
    } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      name: "Alice",
    } as any);
    vi.mocked(prisma.organization.create).mockResolvedValue(mockOrg as any);
    vi.mocked(prisma.franchiseToken.update).mockResolvedValue({} as any);
    vi.mocked(prisma.invite.updateMany).mockResolvedValue({ count: 1 } as any);

    const franchise = await import("@/lib/services/franchise");
    vi.mocked(franchise.cloneRolesFromParent).mockResolvedValue({
      clonedRoles: [{ id: "role-owner", key: "owner" }] as any,
      roleIdMap,
      membership: mockMembership as any,
    } as any);
    vi.mocked(franchise.cloneTagsFromParent).mockResolvedValue({
      clonedTags: [],
    } as any);
    vi.mocked(franchise.cloneTasksFromParent).mockResolvedValue({
      inheritedTaskIds,
    } as any);
    vi.mocked(franchise.cloneToolDataFromParent).mockResolvedValue({
      clonedItems: [],
      toolItemIdMap,
    } as any);
    vi.mocked(franchise.cloneTemplatesFromParent).mockResolvedValue({
      clonedTemplates: [],
    } as any);
    vi.mocked(franchise.cloneTimetableSettingsFromParent).mockResolvedValue(
      null as any,
    );

    const result = await joinFranchise(
      "user-1",
      "alice@example.com",
      { token: "tok-valid" } as any,
    );

    expect(result).toMatchObject({ org: mockOrg });
    expect(franchise.cloneTagsFromParent).toHaveBeenCalledWith(
      prisma,
      "parent-org",
      "child-org",
    );
    expect(franchise.cloneTasksFromParent).toHaveBeenCalledWith(
      prisma,
      "parent-org",
      "child-org",
    );
    expect(franchise.cloneToolDataFromParent).toHaveBeenCalledWith(
      prisma,
      "parent-org",
      "child-org",
    );
    expect(franchise.cloneTemplatesFromParent).toHaveBeenCalledWith(
      prisma,
      "parent-org",
      "child-org",
      inheritedTaskIds,
    );
    expect(franchise.cloneTimetableSettingsFromParent).toHaveBeenCalledWith(
      prisma,
      "parent-org",
      "child-org",
    );
  });
});
