import { describe, it, expect, vi, beforeEach } from "vitest";
import { EntryStatus } from "@prisma/client";

// ─── Mock modules ─────────────────────────────────────────────────────────────

vi.mock("@/lib/authz", () => ({
  requireOrgPermissionAction: vi.fn(),
  requireOrgMemberAction: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/services/timetable-entries", () => ({
  createTimetableEntry: vi.fn(),
  updateTimetableEntry: vi.fn(),
  deleteTimetableEntry: vi.fn(),
  addTimetableEntryAssignee: vi.fn(),
  removeTimetableEntryAssignee: vi.fn(),
}));

import {
  requireOrgPermissionAction,
  requireOrgMemberAction,
} from "@/lib/authz";
import { revalidatePath } from "next/cache";
import {
  createTimetableEntry as createTimetableEntryService,
  updateTimetableEntry as updateTimetableEntryService,
  deleteTimetableEntry as deleteTimetableEntryService,
  addTimetableEntryAssignee as addTimetableEntryAssigneeService,
  removeTimetableEntryAssignee as removeTimetableEntryAssigneeService,
} from "@/lib/services/timetable-entries";
import {
  createTimetableEntryAction,
  updateTimetableEntryAction,
  updateTimetableEntryStatusAction,
  deleteTimetableEntryAction,
  addTimetableEntryAssigneeAction,
  removeTimetableEntryAssigneeAction,
} from "@/app/actions/timetable-entries";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const authorised = {
  ok: true as const,
  userId: "u-1",
  userEmail: "user@example.com",
  membership: { id: "m-1" } as any,
};
const unauthorised = { ok: false as const };

beforeEach(() => vi.clearAllMocks());

// ─── createTimetableEntryAction ───────────────────────────────────────────────

describe("createTimetableEntryAction", () => {
  it("returns unauthorized when permission check fails", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(unauthorised);

    const result = await createTimetableEntryAction(
      "org-1",
      "task-1",
      "2025-06-01",
      480,
    );

    expect(result).toEqual({ ok: false, error: "Unauthorized" });
    expect(createTimetableEntryService).not.toHaveBeenCalled();
  });

  it("creates entry and revalidates on success", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(createTimetableEntryService).mockResolvedValue({
      ok: true,
      data: {} as any,
    });

    const result = await createTimetableEntryAction(
      "org-1",
      "task-1",
      "2025-06-01",
      480,
    );

    expect(result).toEqual({ ok: true });
    expect(createTimetableEntryService).toHaveBeenCalledWith(
      "org-1",
      "task-1",
      "2025-06-01",
      480,
      "u-1",
      "user@example.com",
    );
    expect(revalidatePath).toHaveBeenCalledWith("/orgs/org-1/timetable");
  });

  it("propagates service NOT_FOUND error", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(createTimetableEntryService).mockResolvedValue({
      ok: false,
      error: "Task not found",
      code: "NOT_FOUND",
    });

    const result = await createTimetableEntryAction(
      "org-1",
      "task-bad",
      "2025-06-01",
      480,
    );

    expect(result).toEqual({ ok: false, error: "Task not found" });
  });
});

// ─── updateTimetableEntryAction ───────────────────────────────────────────────

describe("updateTimetableEntryAction", () => {
  it("returns unauthorized when permission check fails", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(unauthorised);

    const result = await updateTimetableEntryAction("org-1", "entry-1", {
      startTimeMin: 540,
    });

    expect(result).toEqual({ ok: false, error: "Unauthorized" });
  });

  it("updates entry and revalidates on success", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(updateTimetableEntryService).mockResolvedValue({
      ok: true,
      data: {} as any,
    });

    const result = await updateTimetableEntryAction("org-1", "entry-1", {
      startTimeMin: 540,
      dateStr: "2025-06-02",
    });

    expect(result).toEqual({ ok: true });
    expect(updateTimetableEntryService).toHaveBeenCalledWith(
      "org-1",
      "entry-1",
      {
        startTimeMin: 540,
        dateStr: "2025-06-02",
      },
    );
    expect(revalidatePath).toHaveBeenCalled();
  });

  it("propagates service NOT_FOUND error", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(updateTimetableEntryService).mockResolvedValue({
      ok: false,
      error: "Entry not found",
      code: "NOT_FOUND",
    });

    const result = await updateTimetableEntryAction("org-1", "entry-bad", {});

    expect(result).toEqual({ ok: false, error: "Entry not found" });
  });
});

// ─── updateTimetableEntryStatusAction ────────────────────────────────────────

describe("updateTimetableEntryStatusAction", () => {
  it("returns unauthorized when member check fails", async () => {
    vi.mocked(requireOrgMemberAction).mockResolvedValue(unauthorised);

    const result = await updateTimetableEntryStatusAction(
      "org-1",
      "entry-1",
      EntryStatus.DONE,
    );

    expect(result).toEqual({ ok: false, error: "Unauthorized" });
  });

  it("updates status and revalidates — uses member check not permission check", async () => {
    vi.mocked(requireOrgMemberAction).mockResolvedValue(authorised);
    vi.mocked(updateTimetableEntryService).mockResolvedValue({
      ok: true,
      data: {} as any,
    });

    const result = await updateTimetableEntryStatusAction(
      "org-1",
      "entry-1",
      EntryStatus.DONE,
    );

    expect(result).toEqual({ ok: true });
    expect(requireOrgPermissionAction).not.toHaveBeenCalled();
    expect(updateTimetableEntryService).toHaveBeenCalledWith(
      "org-1",
      "entry-1",
      { status: EntryStatus.DONE },
    );
  });
});

// ─── deleteTimetableEntryAction ───────────────────────────────────────────────

describe("deleteTimetableEntryAction", () => {
  it("returns unauthorized when permission check fails", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(unauthorised);

    const result = await deleteTimetableEntryAction("org-1", "entry-1");

    expect(result).toEqual({ ok: false, error: "Unauthorized" });
  });

  it("deletes entry and revalidates on success", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(deleteTimetableEntryService).mockResolvedValue({
      ok: true,
      data: null,
    });

    const result = await deleteTimetableEntryAction("org-1", "entry-1");

    expect(result).toEqual({ ok: true });
    expect(deleteTimetableEntryService).toHaveBeenCalledWith(
      "org-1",
      "entry-1",
      "u-1",
      "user@example.com",
    );
    expect(revalidatePath).toHaveBeenCalled();
  });
});

// ─── addTimetableEntryAssigneeAction ──────────────────────────────────────────

describe("addTimetableEntryAssigneeAction", () => {
  it("returns unauthorized when permission check fails", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(unauthorised);

    const result = await addTimetableEntryAssigneeAction(
      "org-1",
      "entry-1",
      "mem-1",
    );

    expect(result).toEqual({ ok: false, error: "Unauthorized" });
  });

  it("adds assignee and revalidates on success", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(addTimetableEntryAssigneeService).mockResolvedValue({
      ok: true,
      data: null,
    });

    const result = await addTimetableEntryAssigneeAction(
      "org-1",
      "entry-1",
      "mem-1",
    );

    expect(result).toEqual({ ok: true });
    expect(addTimetableEntryAssigneeService).toHaveBeenCalledWith(
      "org-1",
      "entry-1",
      "mem-1",
    );
  });

  it("propagates service NOT_FOUND error", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(addTimetableEntryAssigneeService).mockResolvedValue({
      ok: false,
      error: "Entry not found",
      code: "NOT_FOUND",
    });

    const result = await addTimetableEntryAssigneeAction(
      "org-1",
      "entry-bad",
      "mem-1",
    );

    expect(result).toEqual({ ok: false, error: "Entry not found" });
  });
});

// ─── removeTimetableEntryAssigneeAction ───────────────────────────────────────

describe("removeTimetableEntryAssigneeAction", () => {
  it("returns unauthorized when permission check fails", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(unauthorised);

    const result = await removeTimetableEntryAssigneeAction(
      "org-1",
      "entry-1",
      "mem-1",
    );

    expect(result).toEqual({ ok: false, error: "Unauthorized" });
  });

  it("removes assignee and revalidates on success", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(removeTimetableEntryAssigneeService).mockResolvedValue({
      ok: true,
      data: null,
    });

    const result = await removeTimetableEntryAssigneeAction(
      "org-1",
      "entry-1",
      "mem-1",
    );

    expect(result).toEqual({ ok: true });
    expect(removeTimetableEntryAssigneeService).toHaveBeenCalledWith(
      "org-1",
      "entry-1",
      "mem-1",
    );
  });
});
