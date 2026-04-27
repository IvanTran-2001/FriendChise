import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  createTask,
  deleteTask,
  getTasks,
  getTaskById,
  updateTask,
  addTaskEligibility,
  removeTaskEligibility,
  setTaskEligibilities,
} from "@/lib/services/tasks";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    task: {
      create: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    role: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    taskEligibility: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/observability", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const mockTask = {
  id: "task-1",
  orgId: "org-1",
  name: "Open shop checklist",
  color: "#F59E0B",
  description: "Turn on lights.",
  durationMin: 30,
  preferredStartTimeMin: 360,
  minPeople: 1,
  minWaitDays: 0,
  maxWaitDays: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  eligibility: [],
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── createTask ─────────────────────────────────────────────────────────────

describe("createTask", () => {
  it("creates a task and returns the prisma result", async () => {
    vi.mocked(prisma.task.create).mockResolvedValue(mockTask as any);

    const input = {
      color: "#F59E0B",
      title: "Open shop checklist",
      durationMin: 30,
      minWaitDays: 0,
      maxWaitDays: 1,
    };
    const result = await createTask("org-1", input as any);

    expect(result).toBe(mockTask);
    expect(prisma.task.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orgId: "org-1",
        name: "Open shop checklist",
        color: "#F59E0B",
        durationMin: 30,
        description: null,
        preferredStartTimeMin: null,
        minPeople: 1,
      }),
    });
  });

  it("null-coalesces optional fields", async () => {
    vi.mocked(prisma.task.create).mockResolvedValue(mockTask as any);

    await createTask("org-1", {
      color: "#000000",
      title: "Test",
      durationMin: 60,
      description: "A description",
      preferredStartTimeMin: 480,
      peopleRequired: 3,
      minWaitDays: 1,
      maxWaitDays: 7,
    } as any);

    expect(prisma.task.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        description: "A description",
        preferredStartTimeMin: 480,
        minPeople: 3,
        minWaitDays: 1,
        maxWaitDays: 7,
      }),
    });
  });
});

// ─── deleteTask ──────────────────────────────────────────────────────────────

describe("deleteTask", () => {
  it("returns ok: true when task is deleted", async () => {
    vi.mocked(prisma.task.deleteMany).mockResolvedValue({ count: 1 });

    const result = await deleteTask("org-1", "task-1");

    expect(result).toEqual({ ok: true, data: null });
    expect(prisma.task.deleteMany).toHaveBeenCalledWith({
      where: { id: "task-1", orgId: "org-1" },
    });
  });

  it("returns NOT_FOUND when no task matches", async () => {
    vi.mocked(prisma.task.deleteMany).mockResolvedValue({ count: 0 });

    const result = await deleteTask("org-1", "non-existent");

    expect(result).toEqual({
      ok: false,
      error: "Task not found",
      code: "NOT_FOUND",
    });
  });

  it("scopes deletion to orgId to prevent cross-org deletion", async () => {
    vi.mocked(prisma.task.deleteMany).mockResolvedValue({ count: 0 });

    await deleteTask("org-2", "task-1");

    expect(prisma.task.deleteMany).toHaveBeenCalledWith({
      where: { id: "task-1", orgId: "org-2" },
    });
  });
});

// ─── getTasks ────────────────────────────────────────────────────────────────

describe("getTasks", () => {
  it("returns all tasks for the org", async () => {
    const tasks = [mockTask, { ...mockTask, id: "task-2", name: "Close shop" }];
    vi.mocked(prisma.task.findMany).mockResolvedValue(tasks as any);

    const result = await getTasks("org-1");

    expect(result).toBe(tasks);
    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orgId: "org-1" } }),
    );
  });

  it("returns empty array when org has no tasks", async () => {
    vi.mocked(prisma.task.findMany).mockResolvedValue([]);

    const result = await getTasks("org-1");

    expect(result).toEqual([]);
  });
});

// ─── getTaskById ─────────────────────────────────────────────────────────────

describe("getTaskById", () => {
  it("returns the task when found", async () => {
    vi.mocked(prisma.task.findFirst).mockResolvedValue(mockTask as any);

    const result = await getTaskById("org-1", "task-1");

    expect(result).toBe(mockTask);
    expect(prisma.task.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "task-1", orgId: "org-1" },
      }),
    );
  });

  it("returns null when task not found", async () => {
    vi.mocked(prisma.task.findFirst).mockResolvedValue(null);

    const result = await getTaskById("org-1", "non-existent");

    expect(result).toBeNull();
  });
});

// ─── updateTask ──────────────────────────────────────────────────────────────

describe("updateTask", () => {
  const updateInput = {
    color: "#FF0000",
    title: "Updated title",
    durationMin: 45,
    minWaitDays: 1,
    maxWaitDays: 3,
  };

  it("returns ok: true on successful update", async () => {
    vi.mocked(prisma.task.updateMany).mockResolvedValue({ count: 1 });

    const result = await updateTask("org-1", "task-1", updateInput as any);

    expect(result).toEqual({ ok: true, data: null });
  });

  it("returns NOT_FOUND when no task matches", async () => {
    vi.mocked(prisma.task.updateMany).mockResolvedValue({ count: 0 });

    const result = await updateTask(
      "org-1",
      "non-existent",
      updateInput as any,
    );

    expect(result).toEqual({
      ok: false,
      error: "Task not found",
      code: "NOT_FOUND",
    });
  });

  it("scopes update to orgId", async () => {
    vi.mocked(prisma.task.updateMany).mockResolvedValue({ count: 1 });

    await updateTask("org-1", "task-1", updateInput as any);

    expect(prisma.task.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "task-1", orgId: "org-1" },
      }),
    );
  });
});

// ─── addTaskEligibility ───────────────────────────────────────────────────────

describe("addTaskEligibility", () => {
  it("returns ok: true when task and role both exist", async () => {
    vi.mocked(prisma.task.findFirst).mockResolvedValue({ id: "task-1" } as any);
    vi.mocked(prisma.role.findFirst).mockResolvedValue({ id: "role-1" } as any);
    vi.mocked(prisma.taskEligibility.upsert).mockResolvedValue({} as any);

    const result = await addTaskEligibility("org-1", "task-1", "role-1");

    expect(result).toEqual({ ok: true, data: null });
  });

  it("returns NOT_FOUND when task does not exist", async () => {
    vi.mocked(prisma.task.findFirst).mockResolvedValue(null);

    const result = await addTaskEligibility("org-1", "non-existent", "role-1");

    expect(result).toEqual({
      ok: false,
      error: "Task not found",
      code: "NOT_FOUND",
    });
    expect(prisma.role.findFirst).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND when role does not exist in the org", async () => {
    vi.mocked(prisma.task.findFirst).mockResolvedValue({ id: "task-1" } as any);
    vi.mocked(prisma.role.findFirst).mockResolvedValue(null);

    const result = await addTaskEligibility("org-1", "task-1", "non-existent");

    expect(result).toEqual({
      ok: false,
      error: "Role not found",
      code: "NOT_FOUND",
    });
    expect(prisma.taskEligibility.upsert).not.toHaveBeenCalled();
  });

  it("upserts so duplicate calls do not throw", async () => {
    vi.mocked(prisma.task.findFirst).mockResolvedValue({ id: "task-1" } as any);
    vi.mocked(prisma.role.findFirst).mockResolvedValue({ id: "role-1" } as any);
    vi.mocked(prisma.taskEligibility.upsert).mockResolvedValue({} as any);

    await addTaskEligibility("org-1", "task-1", "role-1");
    await addTaskEligibility("org-1", "task-1", "role-1");

    expect(prisma.taskEligibility.upsert).toHaveBeenCalledTimes(2);
  });
});

// ─── removeTaskEligibility ────────────────────────────────────────────────────

describe("removeTaskEligibility", () => {
  it("returns ok: true and removes the eligibility row", async () => {
    vi.mocked(prisma.task.findFirst).mockResolvedValue({ id: "task-1" } as any);
    vi.mocked(prisma.taskEligibility.deleteMany).mockResolvedValue({
      count: 1,
    });

    const result = await removeTaskEligibility("org-1", "task-1", "role-1");

    expect(result).toEqual({ ok: true, data: null });
    expect(prisma.taskEligibility.deleteMany).toHaveBeenCalledWith({
      where: { taskId: "task-1", roleId: "role-1" },
    });
  });

  it("returns NOT_FOUND when task does not exist", async () => {
    vi.mocked(prisma.task.findFirst).mockResolvedValue(null);

    const result = await removeTaskEligibility(
      "org-1",
      "non-existent",
      "role-1",
    );

    expect(result).toEqual({
      ok: false,
      error: "Task not found",
      code: "NOT_FOUND",
    });
    expect(prisma.taskEligibility.deleteMany).not.toHaveBeenCalled();
  });
});

// ─── setTaskEligibilities ─────────────────────────────────────────────────────

describe("setTaskEligibilities", () => {
  it("returns early without querying when roleIds is empty", async () => {
    await setTaskEligibilities("org-1", "task-1", []);

    expect(prisma.role.findMany).not.toHaveBeenCalled();
    expect(prisma.taskEligibility.createMany).not.toHaveBeenCalled();
  });

  it("returns early when no roleIds belong to the org", async () => {
    vi.mocked(prisma.role.findMany).mockResolvedValue([]);

    await setTaskEligibilities("org-1", "task-1", ["role-x", "role-y"]);

    expect(prisma.taskEligibility.createMany).not.toHaveBeenCalled();
  });

  it("bulk-inserts only valid roles, skipping duplicates", async () => {
    vi.mocked(prisma.role.findMany).mockResolvedValue([
      { id: "role-1" },
      { id: "role-2" },
    ] as any);
    vi.mocked(prisma.taskEligibility.createMany).mockResolvedValue({
      count: 2,
    });

    await setTaskEligibilities("org-1", "task-1", [
      "role-1",
      "role-2",
      "role-invalid",
    ]);

    expect(prisma.taskEligibility.createMany).toHaveBeenCalledWith({
      data: [
        { taskId: "task-1", roleId: "role-1" },
        { taskId: "task-1", roleId: "role-2" },
      ],
      skipDuplicates: true,
    });
  });
});
