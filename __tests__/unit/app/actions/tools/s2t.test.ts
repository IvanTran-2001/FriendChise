import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({
  requireOrgPermissionAction: vi.fn(),
}));
vi.mock("@/lib/demo", () => ({
  checkDemoLimit: vi.fn(),
}));
vi.mock("@/lib/platform/observability", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/platform/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn().mockResolvedValue({ name: "Creator" }) },
    scanTaskResult: {
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/services/audit-log", () => ({
  recordAudit: vi.fn(),
}));
vi.mock("@/lib/services/tasks", () => ({
  createTaskOnClient: vi.fn(),
  createTask: vi.fn(),
  deleteTask: vi.fn(),
  findTaskByName: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { requireOrgPermissionAction } from "@/lib/authz";
import { checkDemoLimit } from "@/lib/demo";
import { log } from "@/lib/platform/observability";
import { prisma } from "@/lib/platform/prisma";
import { recordAudit } from "@/lib/services/audit-log";
import { createTaskOnClient, findTaskByName } from "@/lib/services/tasks";
import { revalidatePath } from "next/cache";
import { confirmScanToTaskAction } from "@/app/actions/tools/s2t";

const authorised = {
  ok: true as const,
  userId: "u-1",
  userEmail: "user@example.com",
  membership: { id: "m-1" } as any,
};

const tx = {
  scanTaskResult: {
    updateMany: vi.fn(),
    update: vi.fn(),
  },
};

function makeFormData(resultId = "result-1") {
  const formData = new FormData();
  formData.set("resultId", resultId);
  formData.set("fileName", "scan.pdf");
  formData.set("color", "#6366f1");
  formData.set("title", "Task A");
  formData.set("description", "Draft description");
  formData.set("summary", "Draft summary");
  formData.set("durationMin", "30");
  formData.set("peopleRequired", "2");
  formData.set("minWaitDays", "1");
  formData.set("maxWaitDays", "5");
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
  vi.mocked(checkDemoLimit).mockResolvedValue({ ok: true as const });
  vi.mocked(findTaskByName).mockResolvedValue(null);
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ name: "Creator" } as any);
  vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(tx));
});

describe("confirmScanToTaskAction", () => {
  it("creates a task from a pending scan result", async () => {
    vi.mocked(tx.scanTaskResult.updateMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(createTaskOnClient).mockResolvedValue({
      id: "task-1",
      name: "Task A",
      color: "#6366f1",
      description: "Draft description\n\nSource file: scan.pdf",
      durationMin: 30,
    } as any);
    vi.mocked(tx.scanTaskResult.update).mockResolvedValue({} as any);

    const result = await confirmScanToTaskAction("org-1", null, makeFormData());

    expect(result).toEqual({
      ok: true,
      resultId: "result-1",
      taskId: "task-1",
      taskHref: "/orgs/org-1/tasks/task-1",
    });
    expect(tx.scanTaskResult.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "result-1",
          orgId: "org-1",
          clearedAt: null,
          confirmedAt: null,
          taskId: null,
        },
      }),
    );
    expect(createTaskOnClient).toHaveBeenCalledWith(
      tx,
      "org-1",
      expect.objectContaining({
        title: "Task A",
        color: "#6366f1",
        durationMin: 30,
      }),
      "u-1",
      "user@example.com",
      "Creator",
    );
    expect(log.info).toHaveBeenCalledWith("Task created", {
      orgId: "org-1",
      taskId: "task-1",
    });
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: "org-1",
        actorId: "u-1",
        actorEmail: "user@example.com",
        action: "task.create",
        targetType: "Task",
        targetId: "task-1",
      }),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/orgs/org-1/tasks");
    expect(revalidatePath).toHaveBeenCalledWith("/orgs/org-1/tools/scan-to-task");
  });

  it.each([
    ["nonexistent"],
    ["cleared"],
    ["already-confirmed"],
  ])("rejects %s scan results before creating a task", async () => {
    vi.mocked(tx.scanTaskResult.updateMany).mockResolvedValue({ count: 0 } as any);

    const result = await confirmScanToTaskAction("org-1", null, makeFormData());

    expect(result).toEqual({
      ok: false,
      error: "Scan result is no longer available.",
    });
    expect(createTaskOnClient).not.toHaveBeenCalled();
    expect(tx.scanTaskResult.update).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects a second concurrent confirmation request after the first claims the result", async () => {
    vi.mocked(tx.scanTaskResult.updateMany)
      .mockResolvedValueOnce({ count: 1 } as any)
      .mockResolvedValueOnce({ count: 0 } as any);
    vi.mocked(createTaskOnClient).mockResolvedValue({
      id: "task-1",
      name: "Task A",
      color: "#6366f1",
      description: "Draft description\n\nSource file: scan.pdf",
      durationMin: 30,
    } as any);
    vi.mocked(tx.scanTaskResult.update).mockResolvedValue({} as any);

    const first = await confirmScanToTaskAction("org-1", null, makeFormData());
    const second = await confirmScanToTaskAction("org-1", null, makeFormData());

    expect(first).toMatchObject({ ok: true, taskId: "task-1" });
    expect(second).toEqual({
      ok: false,
      error: "Scan result is no longer available.",
    });
    expect(createTaskOnClient).toHaveBeenCalledTimes(1);
  });
});