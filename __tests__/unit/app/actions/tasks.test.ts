import { describe, it, expect, vi, beforeEach } from "vitest";
import { PermissionAction } from "@prisma/client";

// ─── Mock modules ─────────────────────────────────────────────────────────────

vi.mock("@/lib/authz", () => ({
  requireOrgPermissionAction: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));
vi.mock("@/lib/services/tasks", () => ({
  createTask: vi.fn(),
  deleteTask: vi.fn(),
  updateTask: vi.fn(),
  addTaskEligibility: vi.fn(),
  removeTaskEligibility: vi.fn(),
  setTaskEligibilities: vi.fn(),
}));

import { requireOrgPermissionAction } from "@/lib/authz";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createTask,
  deleteTask,
  updateTask,
  addTaskEligibility,
  removeTaskEligibility,
} from "@/lib/services/tasks";
import {
  createTaskAction,
  deleteTaskAction,
  updateTaskAction,
  addEligibilityAction,
  removeEligibilityAction,
} from "@/app/actions/tasks";

// ─── Helper ───────────────────────────────────────────────────────────────────

function makeFormData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

const authorised = {
  ok: true as const,
  userId: "u-1",
  membership: { id: "m-1" } as any,
};
const unauthorised = { ok: false as const };

beforeEach(() => vi.clearAllMocks());

// ─── createTaskAction ─────────────────────────────────────────────────────────

describe("createTaskAction", () => {
  it("returns unauthorized error when auth fails", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(unauthorised);

    const fd = makeFormData({
      title: "Task A",
      color: "#6366f1",
      durationMin: "30",
    });
    const result = await createTaskAction("org-1", null, fd);

    expect(result).toEqual({ ok: false, errors: { _: ["Unauthorized"] } });
    expect(createTask).not.toHaveBeenCalled();
  });

  it("returns validation errors for invalid form data", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);

    // durationMin is required to be a valid number but invalid title
    const fd = makeFormData({ title: "", color: "#6366f1", durationMin: "30" });
    const result = await createTaskAction("org-1", null, fd);

    expect(result).toMatchObject({ ok: false, errors: expect.any(Object) });
    expect(createTask).not.toHaveBeenCalled();
  });

  it("redirects to task list on success", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(createTask).mockResolvedValue({
      id: "task-1",
      name: "Task A",
    } as any);

    const fd = makeFormData({
      title: "Task A",
      color: "#6366f1",
      durationMin: "30",
      minWaitDays: "7",
    });

    await expect(createTaskAction("org-1", null, fd)).rejects.toThrow(
      "NEXT_REDIRECT",
    );

    expect(revalidatePath).toHaveBeenCalledWith("/orgs/org-1/tasks");
    expect(redirect).toHaveBeenCalledWith("/orgs/org-1/tasks");
  });

  it("checks MANAGE_TASKS permission for the org", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(unauthorised);

    const fd = makeFormData({
      title: "Task A",
      durationMin: "30",
      minWaitDays: "7",
    });
    await createTaskAction("org-1", null, fd);

    expect(requireOrgPermissionAction).toHaveBeenCalledWith(
      "org-1",
      PermissionAction.MANAGE_TASKS,
    );
  });
});

// ─── deleteTaskAction ─────────────────────────────────────────────────────────

describe("deleteTaskAction", () => {
  it("returns unauthorized when auth fails", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(unauthorised);

    const result = await deleteTaskAction("org-1", "task-1");

    expect(result).toEqual({ ok: false, error: "Unauthorized." });
    expect(deleteTask).not.toHaveBeenCalled();
  });

  it("returns error when service returns not ok", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(deleteTask).mockResolvedValue({
      ok: false,
      error: "Task not found",
      code: "NOT_FOUND",
    });

    const result = await deleteTaskAction("org-1", "task-1");

    expect(result).toEqual({ ok: false, error: "Task not found" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("revalidates and returns ok: true on success", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(deleteTask).mockResolvedValue({ ok: true, data: null });

    const result = await deleteTaskAction("org-1", "task-1");

    expect(result).toEqual({ ok: true });
    expect(revalidatePath).toHaveBeenCalledWith("/orgs/org-1/tasks");
  });

  it("delegates to deleteTask service with correct args", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(deleteTask).mockResolvedValue({ ok: true, data: null });

    await deleteTaskAction("org-1", "task-xyz");

    expect(deleteTask).toHaveBeenCalledWith("org-1", "task-xyz");
  });
});

// ─── updateTaskAction ─────────────────────────────────────────────────────────

describe("updateTaskAction", () => {
  it("returns unauthorized when auth fails", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(unauthorised);

    const fd = makeFormData({ title: "Updated", color: "#6366f1" });
    const result = await updateTaskAction("org-1", "task-1", null, fd);

    expect(result).toEqual({ ok: false, errors: { _: ["Unauthorized"] } });
  });

  it("returns service error wrapped in errors._", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(updateTask).mockResolvedValue({
      ok: false,
      error: "Task not found",
      code: "NOT_FOUND",
    });

    const fd = makeFormData({
      title: "Updated",
      color: "#6366f1",
      durationMin: "30",
      minWaitDays: "7",
    });
    const result = await updateTaskAction("org-1", "task-1", null, fd);

    expect(result).toEqual({ ok: false, errors: { _: ["Task not found"] } });
  });

  it("returns ok: true and revalidates on success", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(updateTask).mockResolvedValue({ ok: true, data: {} as any });

    const fd = makeFormData({
      title: "Updated",
      color: "#6366f1",
      durationMin: "30",
      minWaitDays: "7",
    });
    const result = await updateTaskAction("org-1", "task-1", null, fd);

    expect(result).toEqual({ ok: true });
    expect(revalidatePath).toHaveBeenCalledWith("/orgs/org-1/tasks");
    expect(revalidatePath).toHaveBeenCalledWith(
      "/orgs/org-1/tasks/task-1/edit",
    );
  });
});

// ─── addEligibilityAction ─────────────────────────────────────────────────────

describe("addEligibilityAction", () => {
  it("returns unauthorized when auth fails", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(unauthorised);

    const result = await addEligibilityAction("org-1", "task-1", "role-1");

    expect(result).toEqual({ ok: false, error: "Unauthorized" });
  });

  it("returns error when service fails", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(addTaskEligibility).mockResolvedValue({
      ok: false,
      error: "Role not found",
      code: "NOT_FOUND",
    });

    const result = await addEligibilityAction("org-1", "task-1", "role-1");

    expect(result).toEqual({ ok: false, error: "Role not found" });
  });

  it("revalidates and returns ok: true on success", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(addTaskEligibility).mockResolvedValue({
      ok: true,
      data: {} as any,
    });

    const result = await addEligibilityAction("org-1", "task-1", "role-1");

    expect(result).toEqual({ ok: true });
    expect(revalidatePath).toHaveBeenCalledWith("/orgs/org-1/tasks");
  });
});

// ─── removeEligibilityAction ──────────────────────────────────────────────────

describe("removeEligibilityAction", () => {
  it("returns unauthorized when auth fails", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(unauthorised);

    const result = await removeEligibilityAction("org-1", "task-1", "role-1");

    expect(result).toEqual({ ok: false, error: "Unauthorized" });
  });

  it("returns ok: true and revalidates on success", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(removeTaskEligibility).mockResolvedValue({
      ok: true,
      data: null,
    });

    const result = await removeEligibilityAction("org-1", "task-1", "role-1");

    expect(result).toEqual({ ok: true });
    expect(revalidatePath).toHaveBeenCalledWith("/orgs/org-1/tasks");
  });
});
