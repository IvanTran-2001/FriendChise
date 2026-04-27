import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  getRoles,
  deleteRole,
  getRoleById,
  createRole,
  updateRole,
} from "@/lib/services/roles";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    role: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    task: {
      findMany: vi.fn(),
    },
    permission: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    taskEligibility: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

const mockRole = {
  id: "role-1",
  orgId: "org-1",
  name: "Manager",
  color: "#3B82F6",
  key: "manager",
  isDeletable: true,
  isDefault: false,
  permissions: [],
  eligibleFor: [],
};

const ownerRole = {
  ...mockRole,
  id: "role-owner",
  name: "Owner",
  key: "owner",
  isDeletable: false,
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── getRoles ────────────────────────────────────────────────────────────────

describe("getRoles", () => {
  it("returns all roles for the org", async () => {
    vi.mocked(prisma.role.findMany).mockResolvedValue([mockRole] as any);

    const result = await getRoles("org-1");

    expect(result).toEqual([mockRole]);
    expect(prisma.role.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orgId: "org-1" } }),
    );
  });

  it("returns empty array when org has no roles", async () => {
    vi.mocked(prisma.role.findMany).mockResolvedValue([]);

    const result = await getRoles("org-1");

    expect(result).toEqual([]);
  });
});

// ─── deleteRole ──────────────────────────────────────────────────────────────

describe("deleteRole", () => {
  it("deletes a deletable role and returns ok: true", async () => {
    vi.mocked(prisma.role.findFirst).mockResolvedValue(mockRole as any);
    vi.mocked(prisma.role.delete).mockResolvedValue(mockRole as any);

    const result = await deleteRole("org-1", "role-1");

    expect(result).toEqual({ ok: true, data: null });
    expect(prisma.role.delete).toHaveBeenCalledWith({
      where: { id: "role-1" },
    });
  });

  it("returns NOT_FOUND when role does not exist in org", async () => {
    vi.mocked(prisma.role.findFirst).mockResolvedValue(null);

    const result = await deleteRole("org-1", "non-existent");

    expect(result).toEqual({
      ok: false,
      error: "Role not found.",
      code: "NOT_FOUND",
    });
    expect(prisma.role.delete).not.toHaveBeenCalled();
  });

  it("returns INVALID when role is not deletable (system role)", async () => {
    vi.mocked(prisma.role.findFirst).mockResolvedValue({
      ...ownerRole,
      isDeletable: false,
    } as any);

    const result = await deleteRole("org-1", "role-owner");

    expect(result).toEqual({
      ok: false,
      error: "This role cannot be deleted.",
      code: "INVALID",
    });
    expect(prisma.role.delete).not.toHaveBeenCalled();
  });
});

// ─── getRoleById ─────────────────────────────────────────────────────────────

describe("getRoleById", () => {
  it("returns the role when found", async () => {
    vi.mocked(prisma.role.findFirst).mockResolvedValue(mockRole as any);

    const result = await getRoleById("org-1", "role-1");

    expect(result).toBe(mockRole);
    expect(prisma.role.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "role-1", orgId: "org-1" },
      }),
    );
  });

  it("returns null when role not found", async () => {
    vi.mocked(prisma.role.findFirst).mockResolvedValue(null);

    const result = await getRoleById("org-1", "non-existent");

    expect(result).toBeNull();
  });
});

// ─── createRole ──────────────────────────────────────────────────────────────

describe("createRole", () => {
  const roleInput = {
    name: "Barista",
    color: "#8B5CF6",
    permissions: [],
    taskIds: [],
  };

  it("creates a role with no permissions or tasks", async () => {
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) =>
      fn(prisma),
    );
    vi.mocked(prisma.role.create).mockResolvedValue({ id: "role-new" } as any);
    vi.mocked(prisma.role.findUniqueOrThrow).mockResolvedValue(mockRole as any);

    const result = await createRole("org-1", roleInput as any);

    expect(result).toEqual({ ok: true, data: mockRole });
  });

  it("creates a role with permissions and task eligibility", async () => {
    const inputWithPerms = {
      name: "Supervisor",
      color: "#10B981",
      permissions: ["MANAGE_TASKS", "MANAGE_MEMBERS"],
      taskIds: ["task-1", "task-2"],
    };

    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) =>
      fn(prisma),
    );
    vi.mocked(prisma.task.findMany).mockResolvedValue([
      { id: "task-1" },
      { id: "task-2" },
    ] as any);
    vi.mocked(prisma.role.create).mockResolvedValue({ id: "role-new" } as any);
    vi.mocked(prisma.permission.createMany).mockResolvedValue({ count: 2 });
    vi.mocked(prisma.taskEligibility.createMany).mockResolvedValue({
      count: 2,
    });
    vi.mocked(prisma.role.findUniqueOrThrow).mockResolvedValue(mockRole as any);

    const result = await createRole("org-1", inputWithPerms as any);

    expect(result.ok).toBe(true);
    expect(prisma.permission.createMany).toHaveBeenCalled();
    expect(prisma.taskEligibility.createMany).toHaveBeenCalled();
  });

  it("returns INVALID when a taskId does not belong to the org", async () => {
    const inputWithBadTask = {
      name: "Bad Role",
      color: "#000000",
      permissions: [],
      taskIds: ["task-1", "task-from-other-org"],
    };

    // Transaction returns null (task validation fails inside tx)
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
      // Simulate task validation failure: only 1 of 2 tasks found
      vi.mocked(prisma.task.findMany).mockResolvedValue([
        { id: "task-1" },
      ] as any);
      return fn(prisma);
    });

    const result = await createRole("org-1", inputWithBadTask as any);

    expect(result).toEqual({
      ok: false,
      error: "One or more tasks are invalid for this organization.",
      code: "INVALID",
    });
  });
});

// ─── updateRole ──────────────────────────────────────────────────────────────

describe("updateRole", () => {
  const updateInput = {
    name: "Updated Manager",
    color: "#EF4444",
    permissions: [],
    taskIds: [],
  };

  it("returns ok: true on successful update", async () => {
    vi.mocked(prisma.role.findFirst).mockResolvedValue(mockRole as any);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) =>
      fn(prisma),
    );
    vi.mocked(prisma.role.update).mockResolvedValue(mockRole as any);
    vi.mocked(prisma.permission.deleteMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.taskEligibility.deleteMany).mockResolvedValue({
      count: 0,
    });
    vi.mocked(prisma.role.findUniqueOrThrow).mockResolvedValue({
      ...mockRole,
      name: "Updated Manager",
    } as any);

    const result = await updateRole("org-1", "role-1", updateInput as any);

    expect(result.ok).toBe(true);
  });

  it("returns NOT_FOUND when role does not exist", async () => {
    vi.mocked(prisma.role.findFirst).mockResolvedValue(null);

    const result = await updateRole(
      "org-1",
      "non-existent",
      updateInput as any,
    );

    expect(result).toEqual({
      ok: false,
      error: "Role not found.",
      code: "NOT_FOUND",
    });
  });

  it("returns INVALID when attempting to edit the Owner role", async () => {
    vi.mocked(prisma.role.findFirst).mockResolvedValue(ownerRole as any);

    const result = await updateRole("org-1", "role-owner", updateInput as any);

    expect(result).toEqual({
      ok: false,
      error: "The Owner role cannot be edited.",
      code: "INVALID",
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns INVALID when a taskId does not belong to the org", async () => {
    vi.mocked(prisma.role.findFirst).mockResolvedValue(mockRole as any);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
      vi.mocked(prisma.task.findMany).mockResolvedValue([
        { id: "task-1" },
      ] as any);
      return fn(prisma);
    });

    const result = await updateRole("org-1", "role-1", {
      ...updateInput,
      taskIds: ["task-1", "foreign-task"],
    } as any);

    expect(result).toEqual({
      ok: false,
      error: "One or more tasks are invalid for this organization.",
      code: "INVALID",
    });
  });
});
