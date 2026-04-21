import { describe, it, expect, vi, beforeEach } from "vitest";
import { PermissionAction } from "@prisma/client";

// ─── Mock modules ─────────────────────────────────────────────────────────────

vi.mock("@/lib/authz", () => ({ requireOrgPermissionAction: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => { throw new Error("NEXT_REDIRECT"); }),
}));
vi.mock("@/lib/services/templates", () => ({
  createTemplate: vi.fn(),
  addTemplateInstance: vi.fn(),
  removeTemplateInstance: vi.fn(),
  updateTemplateInstance: vi.fn(),
  updateTemplateDays: vi.fn(),
  addTemplateInstanceAssignee: vi.fn(),
  removeTemplateInstanceAssignee: vi.fn(),
  countTimetableEntriesInRange: vi.fn(),
  applyTemplate: vi.fn(),
  renameTemplate: vi.fn(),
  duplicateTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
}));

import { requireOrgPermissionAction } from "@/lib/authz";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createTemplate as createTemplateService,
  addTemplateInstance as addTemplateInstanceService,
  removeTemplateInstance as removeTemplateInstanceService,
  updateTemplateInstance as updateTemplateInstanceService,
  updateTemplateDays as updateTemplateDaysService,
  addTemplateInstanceAssignee as addTemplateInstanceAssigneeService,
  removeTemplateInstanceAssignee as removeTemplateInstanceAssigneeService,
  countTimetableEntriesInRange as countTimetableEntriesInRangeService,
  applyTemplate as applyTemplateService,
  renameTemplate as renameTemplateService,
  duplicateTemplate as duplicateTemplateService,
  deleteTemplate as deleteTemplateService,
} from "@/lib/services/templates";
import {
  createTemplateAction,
  addTemplateInstanceAction,
  removeTemplateInstanceAction,
  updateTemplateInstanceAction,
  updateTemplateDaysAction,
  addInstanceAssigneeAction,
  removeInstanceAssigneeAction,
  countTimetableEntriesInRangeAction,
  applyTemplateAction,
  renameTemplateAction,
  duplicateTemplateAction,
  deleteTemplateAction,
} from "@/app/actions/templates";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const authorised = { ok: true as const, userId: "u-1", membership: { id: "m-1" } as any };
const unauthorised = { ok: false as const };

function makeFormData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

beforeEach(() => vi.clearAllMocks());

// ─── createTemplateAction ─────────────────────────────────────────────────────

describe("createTemplateAction", () => {
  it("returns unauthorized when permission check fails", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(unauthorised);

    const result = await createTemplateAction("org-1", null, makeFormData({ title: "My Template", templateDays: "7" }));

    expect(result).toEqual({ ok: false, errors: { _: ["Unauthorized"] } });
  });

  it("returns validation error when title is missing", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);

    const result = await createTemplateAction("org-1", null, makeFormData({ title: "", templateDays: "7" }));

    expect(result).toMatchObject({ ok: false });
    expect(createTemplateService).not.toHaveBeenCalled();
  });

  it("creates template and redirects on success", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(createTemplateService).mockResolvedValue({ ok: true, data: { id: "tmpl-1" } });

    await expect(
      createTemplateAction("org-1", null, makeFormData({ title: "Weekly", templateDays: "7" })),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(createTemplateService).toHaveBeenCalledWith("org-1", "Weekly", 7);
    expect(redirect).toHaveBeenCalledWith("/orgs/org-1/timetable/templates/tmpl-1");
  });

  it("returns error when service fails", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(createTemplateService).mockResolvedValue({
      ok: false,
      error: "Template creation failed",
      code: "INVALID",
    });

    const result = await createTemplateAction("org-1", null, makeFormData({ title: "T", templateDays: "7" }));

    expect(result).toEqual({ ok: false, errors: { _: ["Template creation failed"] } });
  });
});

// ─── addTemplateInstanceAction ────────────────────────────────────────────────

describe("addTemplateInstanceAction", () => {
  it("returns unauthorized when permission check fails", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(unauthorised);

    const result = await addTemplateInstanceAction("org-1", "tmpl-1", "task-1", 0, 480);

    expect(result).toEqual({ ok: false, error: "Unauthorized" });
  });

  it("adds instance and revalidates on success", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(addTemplateInstanceService).mockResolvedValue({ ok: true, data: null });

    const result = await addTemplateInstanceAction("org-1", "tmpl-1", "task-1", 0, 480);

    expect(result).toEqual({ ok: true });
    expect(addTemplateInstanceService).toHaveBeenCalledWith("org-1", "tmpl-1", "task-1", 0, 480);
    expect(revalidatePath).toHaveBeenCalled();
  });

  it("propagates service NOT_FOUND error", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(addTemplateInstanceService).mockResolvedValue({
      ok: false,
      error: "Task not found",
      code: "NOT_FOUND",
    });

    const result = await addTemplateInstanceAction("org-1", "tmpl-1", "task-bad", 0, 480);

    expect(result).toEqual({ ok: false, error: "Task not found" });
  });
});

// ─── removeTemplateInstanceAction ────────────────────────────────────────────

describe("removeTemplateInstanceAction", () => {
  it("returns unauthorized when permission check fails", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(unauthorised);

    const result = await removeTemplateInstanceAction("org-1", "inst-1");

    expect(result).toEqual({ ok: false, error: "Unauthorized" });
  });

  it("removes instance and revalidates on success", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(removeTemplateInstanceService).mockResolvedValue({ ok: true, data: null });

    const result = await removeTemplateInstanceAction("org-1", "inst-1");

    expect(result).toEqual({ ok: true });
    expect(removeTemplateInstanceService).toHaveBeenCalledWith("org-1", "inst-1");
  });
});

// ─── updateTemplateInstanceAction ────────────────────────────────────────────

describe("updateTemplateInstanceAction", () => {
  it("returns unauthorized when permission check fails", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(unauthorised);

    const result = await updateTemplateInstanceAction("org-1", "inst-1", { dayIndex: 2 });

    expect(result).toEqual({ ok: false, error: "Unauthorized" });
  });

  it("updates instance and revalidates on success", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(updateTemplateInstanceService).mockResolvedValue({ ok: true, data: null });

    const result = await updateTemplateInstanceAction("org-1", "inst-1", { dayIndex: 2, startTimeMin: 540 });

    expect(result).toEqual({ ok: true });
    expect(updateTemplateInstanceService).toHaveBeenCalledWith("org-1", "inst-1", { dayIndex: 2, startTimeMin: 540 });
  });
});

// ─── updateTemplateDaysAction ─────────────────────────────────────────────────

describe("updateTemplateDaysAction", () => {
  it("returns unauthorized when permission check fails", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(unauthorised);

    const result = await updateTemplateDaysAction("org-1", "tmpl-1", 14);

    expect(result).toEqual({ ok: false, error: "Unauthorized" });
  });

  it("updates template days and revalidates on success", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(updateTemplateDaysService).mockResolvedValue({ ok: true, data: null });

    const result = await updateTemplateDaysAction("org-1", "tmpl-1", 14);

    expect(result).toEqual({ ok: true });
    expect(updateTemplateDaysService).toHaveBeenCalledWith("org-1", "tmpl-1", 14);
    expect(revalidatePath).toHaveBeenCalled();
  });
});

// ─── addInstanceAssigneeAction ────────────────────────────────────────────────

describe("addInstanceAssigneeAction", () => {
  it("returns unauthorized when permission check fails", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(unauthorised);

    const result = await addInstanceAssigneeAction("org-1", "inst-1", "mem-1");

    expect(result).toEqual({ ok: false, error: "Unauthorized" });
  });

  it("adds assignee and revalidates on success", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(addTemplateInstanceAssigneeService).mockResolvedValue({ ok: true, data: null });

    const result = await addInstanceAssigneeAction("org-1", "inst-1", "mem-1");

    expect(result).toEqual({ ok: true });
    expect(addTemplateInstanceAssigneeService).toHaveBeenCalledWith("org-1", "inst-1", "mem-1");
  });
});

// ─── removeInstanceAssigneeAction ─────────────────────────────────────────────

describe("removeInstanceAssigneeAction", () => {
  it("returns unauthorized when permission check fails", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(unauthorised);

    const result = await removeInstanceAssigneeAction("org-1", "inst-1", "mem-1");

    expect(result).toEqual({ ok: false, error: "Unauthorized" });
  });

  it("removes assignee and revalidates on success", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(removeTemplateInstanceAssigneeService).mockResolvedValue({ ok: true, data: null });

    const result = await removeInstanceAssigneeAction("org-1", "inst-1", "mem-1");

    expect(result).toEqual({ ok: true });
    expect(removeTemplateInstanceAssigneeService).toHaveBeenCalledWith("org-1", "inst-1", "mem-1");
  });
});

// ─── countTimetableEntriesInRangeAction ───────────────────────────────────────

describe("countTimetableEntriesInRangeAction", () => {
  it("returns unauthorized when permission check fails", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(unauthorised);

    const result = await countTimetableEntriesInRangeAction("org-1", "2025-01-06", 7);

    expect(result).toEqual({ ok: false, error: "Unauthorized" });
  });

  it("returns count on success", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(countTimetableEntriesInRangeService).mockResolvedValue({
      ok: true,
      data: { count: 12 },
    });

    const result = await countTimetableEntriesInRangeAction("org-1", "2025-01-06", 7);

    expect(result).toEqual({ ok: true, count: 12 });
  });
});

// ─── applyTemplateAction ──────────────────────────────────────────────────────

describe("applyTemplateAction", () => {
  it("returns unauthorized when permission check fails", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(unauthorised);

    const result = await applyTemplateAction("org-1", "tmpl-1", "2025-01-06", 1);

    expect(result).toEqual({ ok: false, error: "Unauthorized" });
  });

  it("applies template and revalidates timetable on success", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(applyTemplateService).mockResolvedValue({ ok: true, data: { created: 14 } });

    const result = await applyTemplateAction("org-1", "tmpl-1", "2025-01-06", 2);

    expect(result).toEqual({ ok: true, created: 14 });
    expect(applyTemplateService).toHaveBeenCalledWith("org-1", "tmpl-1", "2025-01-06", 2);
    expect(revalidatePath).toHaveBeenCalledWith("/orgs/org-1/timetable");
  });

  it("propagates service NOT_FOUND error", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(applyTemplateService).mockResolvedValue({
      ok: false,
      error: "Template not found",
      code: "NOT_FOUND",
    });

    const result = await applyTemplateAction("org-1", "tmpl-bad", "2025-01-06", 1);

    expect(result).toEqual({ ok: false, error: "Template not found" });
  });
});

// ─── renameTemplateAction ─────────────────────────────────────────────────────

describe("renameTemplateAction", () => {
  it("returns unauthorized when permission check fails", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(unauthorised);

    const result = await renameTemplateAction("org-1", "tmpl-1", "New Name");

    expect(result).toEqual({ ok: false, error: "Unauthorized" });
  });

  it("renames template and revalidates on success", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(renameTemplateService).mockResolvedValue({ ok: true, data: null });

    const result = await renameTemplateAction("org-1", "tmpl-1", "New Name");

    expect(result).toEqual({ ok: true });
    expect(renameTemplateService).toHaveBeenCalledWith("org-1", "tmpl-1", "New Name");
  });
});

// ─── duplicateTemplateAction ──────────────────────────────────────────────────

describe("duplicateTemplateAction", () => {
  it("returns unauthorized when permission check fails", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(unauthorised);

    const result = await duplicateTemplateAction("org-1", "tmpl-1");

    expect(result).toEqual({ ok: false, error: "Unauthorized" });
  });

  it("duplicates template and returns new id on success", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(duplicateTemplateService).mockResolvedValue({ ok: true, data: { id: "tmpl-2" } });

    const result = await duplicateTemplateAction("org-1", "tmpl-1");

    expect(result).toEqual({ ok: true, id: "tmpl-2" });
    expect(duplicateTemplateService).toHaveBeenCalledWith("org-1", "tmpl-1");
  });
});

// ─── deleteTemplateAction ─────────────────────────────────────────────────────

describe("deleteTemplateAction", () => {
  it("returns unauthorized when permission check fails", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(unauthorised);

    const result = await deleteTemplateAction("org-1", "tmpl-1");

    expect(result).toEqual({ ok: false, error: "Unauthorized" });
  });

  it("deletes template and revalidates on success", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(deleteTemplateService).mockResolvedValue({ ok: true, data: null });

    const result = await deleteTemplateAction("org-1", "tmpl-1");

    expect(result).toEqual({ ok: true });
    expect(deleteTemplateService).toHaveBeenCalledWith("org-1", "tmpl-1");
    expect(revalidatePath).toHaveBeenCalled();
  });

  it("propagates service NOT_FOUND error", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(deleteTemplateService).mockResolvedValue({
      ok: false,
      error: "Template not found",
      code: "NOT_FOUND",
    });

    const result = await deleteTemplateAction("org-1", "tmpl-bad");

    expect(result).toEqual({ ok: false, error: "Template not found" });
  });
});
