import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  createTimetableEntry,
  updateTimetableEntry,
  deleteTimetableEntry,
  addTimetableEntryAssignee,
  removeTimetableEntryAssignee,
} from "@/lib/services/timetable-entries";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    task: { findUnique: vi.fn() },
    organization: { findUnique: vi.fn() },
    timetableEntry: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    membership: { findFirst: vi.fn() },
    timetableEntryAssignee: {
      upsert: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
    auditLog: { create: vi.fn() },
  },
}));

// Mock date-utils so tests are timezone-independent
vi.mock("@/lib/date-utils", () => ({
  localToUTC: vi.fn(() => ({
    utcDate: new Date("2026-04-20T00:00:00Z"),
    utcStartTimeMin: 360,
  })),
  utcToLocal: vi.fn(() => ({
    localDateStr: "2026-04-20",
    localStartTimeMin: 360,
  })),
  localMidnightUTC: vi.fn((d: string) => new Date(`${d}T00:00:00Z`).getTime()),
  addCalendarDays: vi.fn((d: string, n: number) => {
    const dt = new Date(`${d}T00:00:00Z`);
    dt.setUTCDate(dt.getUTCDate() + n);
    return dt.toISOString().slice(0, 10);
  }),
}));

const mockEntry = {
  id: "entry-1",
  orgId: "org-1",
  taskId: "task-1",
  taskName: "Open shop",
  taskColor: "#F59E0B",
  taskDescription: null,
  durationMin: 30,
  date: new Date("2026-04-20T00:00:00Z"),
  startTimeMin: 360,
  endTimeMin: 390,
  status: "TODO",
};

beforeEach(() => vi.clearAllMocks());
// ─── createTimetableEntry ─────────────────────────────────────────────────────

describe("createTimetableEntry", () => {
  it("creates entry and returns ok: true", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({
      id: "org-child-a",
      parentId: "root-org",
      timezone: "UTC",
    } as any);
    vi.mocked(prisma.task.findUnique).mockResolvedValue({
      id: "task-1",
      name: "Open",
      color: "#F59E0B",
      description: null,
      durationMin: 30,
      organization: {
        id: "org-child-b",
        parentId: "root-org",
      },
    } as any);
    vi.mocked(prisma.timetableEntry.create).mockResolvedValue(mockEntry as any);

    const result = await createTimetableEntry(
      "org-1",
      "task-1",
      "2026-04-20",
      360,
    );

    expect(result).toEqual({ ok: true, data: mockEntry });
  });

  it("returns NOT_FOUND when org does not exist", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue(null);

    const result = await createTimetableEntry(
      "org-bad",
      "task-1",
      "2026-04-20",
      360,
    );

    expect(result).toEqual({
      ok: false,
      error: "Org not found",
      code: "NOT_FOUND",
    });
  });

  it("returns NOT_FOUND when task is in a different franchise root", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({
      id: "org-a",
      parentId: null,
      timezone: "UTC",
    } as any);
    vi.mocked(prisma.task.findUnique).mockResolvedValue({
      id: "task-1",
      name: "Open",
      color: "#F59E0B",
      description: null,
      durationMin: 30,
      organization: {
        id: "org-b",
        parentId: null,
      },
    } as any);

    const result = await createTimetableEntry(
      "org-1",
      "bad-task",
      "2026-04-20",
      360,
    );

    expect(result).toEqual({
      ok: false,
      error: "Task not found",
      code: "NOT_FOUND",
    });
  });

  it("allows creation when org and task share the same parentId", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({
      id: "org-child-a",
      parentId: "root-org",
      timezone: "UTC",
    } as any);
    vi.mocked(prisma.task.findUnique).mockResolvedValue({
      id: "task-1",
      name: "Open",
      color: "#F59E0B",
      description: null,
      durationMin: 30,
      organization: {
        id: "org-child-b",
        parentId: "root-org",
      },
    } as any);
    vi.mocked(prisma.timetableEntry.create).mockResolvedValue(mockEntry as any);

    const result = await createTimetableEntry(
      "org-child-a",
      "task-1",
      "2026-04-20",
      360,
    );

    expect(result).toEqual({ ok: true, data: mockEntry });
  });
});

// ─── updateTimetableEntry ─────────────────────────────────────────────────────

describe("updateTimetableEntry", () => {
  it("updates status and returns ok: true", async () => {
    vi.mocked(prisma.timetableEntry.findFirst).mockResolvedValue({
      id: "entry-1",
      durationMin: 30,
      date: new Date(),
      startTimeMin: 360,
    } as any);
    vi.mocked(prisma.timetableEntry.update).mockResolvedValue(mockEntry as any);

    const result = await updateTimetableEntry("org-1", "entry-1", {
      status: "DONE" as any,
    });

    expect(result).toEqual({ ok: true, data: mockEntry });
    expect(prisma.timetableEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "entry-1" } }),
    );
  });

  it("returns NOT_FOUND when entry does not exist in org", async () => {
    vi.mocked(prisma.timetableEntry.findFirst).mockResolvedValue(null);

    const result = await updateTimetableEntry("org-1", "bad-entry", {
      status: "DONE" as any,
    });

    expect(result).toEqual({
      ok: false,
      error: "Entry not found",
      code: "NOT_FOUND",
    });
    expect(prisma.timetableEntry.update).not.toHaveBeenCalled();
  });

  it("fetches org timezone when time update is needed", async () => {
    vi.mocked(prisma.timetableEntry.findFirst).mockResolvedValue({
      id: "entry-1",
      durationMin: 30,
      date: new Date("2026-04-20T00:00:00Z"),
      startTimeMin: 360,
    } as any);
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({
      timezone: "UTC",
    } as any);
    vi.mocked(prisma.timetableEntry.update).mockResolvedValue(mockEntry as any);

    await updateTimetableEntry("org-1", "entry-1", { startTimeMin: 480 });

    expect(prisma.organization.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "org-1" } }),
    );
  });
});

// ─── deleteTimetableEntry ─────────────────────────────────────────────────────

describe("deleteTimetableEntry", () => {
  it("deletes entry and returns ok: true", async () => {
    vi.mocked(prisma.timetableEntry.findFirst).mockResolvedValue({
      id: "entry-1",
    } as any);
    vi.mocked(prisma.timetableEntry.delete).mockResolvedValue({} as any);

    const result = await deleteTimetableEntry("org-1", "entry-1");

    expect(result).toEqual({ ok: true, data: null });
    expect(prisma.timetableEntry.delete).toHaveBeenCalledWith({
      where: { id: "entry-1" },
    });
  });

  it("returns NOT_FOUND when entry does not exist in org", async () => {
    vi.mocked(prisma.timetableEntry.findFirst).mockResolvedValue(null);

    const result = await deleteTimetableEntry("org-1", "bad-entry");

    expect(result).toEqual({
      ok: false,
      error: "Entry not found",
      code: "NOT_FOUND",
    });
    expect(prisma.timetableEntry.delete).not.toHaveBeenCalled();
  });
});

// ─── addTimetableEntryAssignee ────────────────────────────────────────────────

describe("addTimetableEntryAssignee", () => {
  it("upserts and returns ok: true when both entry and membership exist", async () => {
    vi.mocked(prisma.timetableEntry.findFirst).mockResolvedValue({
      id: "entry-1",
    } as any);
    vi.mocked(prisma.membership.findFirst).mockResolvedValue({
      id: "mem-1",
    } as any);
    vi.mocked(prisma.timetableEntryAssignee.upsert).mockResolvedValue(
      {} as any,
    );

    const result = await addTimetableEntryAssignee("org-1", "entry-1", "mem-1");

    expect(result).toEqual({ ok: true, data: null });
  });

  it("returns NOT_FOUND when entry is missing", async () => {
    vi.mocked(prisma.timetableEntry.findFirst).mockResolvedValue(null);

    const result = await addTimetableEntryAssignee(
      "org-1",
      "bad-entry",
      "mem-1",
    );

    expect(result).toEqual({
      ok: false,
      error: "Entry not found",
      code: "NOT_FOUND",
    });
  });

  it("returns NOT_FOUND when membership is missing", async () => {
    vi.mocked(prisma.timetableEntry.findFirst).mockResolvedValue({
      id: "entry-1",
    } as any);
    vi.mocked(prisma.membership.findFirst).mockResolvedValue(null);

    const result = await addTimetableEntryAssignee(
      "org-1",
      "entry-1",
      "bad-mem",
    );

    expect(result).toEqual({
      ok: false,
      error: "Membership not found",
      code: "NOT_FOUND",
    });
  });

  it("is idempotent — safe to call twice (upsert)", async () => {
    vi.mocked(prisma.timetableEntry.findFirst).mockResolvedValue({
      id: "entry-1",
    } as any);
    vi.mocked(prisma.membership.findFirst).mockResolvedValue({
      id: "mem-1",
    } as any);
    vi.mocked(prisma.timetableEntryAssignee.upsert).mockResolvedValue(
      {} as any,
    );

    await addTimetableEntryAssignee("org-1", "entry-1", "mem-1");
    const result = await addTimetableEntryAssignee("org-1", "entry-1", "mem-1");

    expect(result).toEqual({ ok: true, data: null });
    expect(prisma.timetableEntryAssignee.upsert).toHaveBeenCalledTimes(2);
  });
});

// ─── removeTimetableEntryAssignee ─────────────────────────────────────────────

describe("removeTimetableEntryAssignee", () => {
  it("deletes the assignee link and returns ok: true", async () => {
    vi.mocked(prisma.timetableEntryAssignee.findFirst).mockResolvedValue({
      id: "asn-1",
    } as any);
    vi.mocked(prisma.timetableEntryAssignee.delete).mockResolvedValue(
      {} as any,
    );

    const result = await removeTimetableEntryAssignee(
      "org-1",
      "entry-1",
      "mem-1",
    );

    expect(result).toEqual({ ok: true, data: null });
    expect(prisma.timetableEntryAssignee.delete).toHaveBeenCalledWith({
      where: { id: "asn-1" },
    });
  });

  it("returns NOT_FOUND when assignee link does not exist", async () => {
    vi.mocked(prisma.timetableEntryAssignee.findFirst).mockResolvedValue(null);

    const result = await removeTimetableEntryAssignee(
      "org-1",
      "entry-1",
      "mem-1",
    );

    expect(result).toEqual({
      ok: false,
      error: "Not found",
      code: "NOT_FOUND",
    });
  });
});
