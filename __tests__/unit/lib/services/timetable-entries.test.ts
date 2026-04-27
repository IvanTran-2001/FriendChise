import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  createTimetableEntryFromInput,
  createTimetableEntry,
  updateTimetableEntry,
  deleteTimetableEntry,
  addTimetableEntryAssignee,
  removeTimetableEntryAssignee,
} from "@/lib/services/timetable-entries";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    task: { findFirst: vi.fn() },
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

// ─── createTimetableEntryFromInput ────────────────────────────────────────────

describe("createTimetableEntryFromInput", () => {
  const input = { taskId: "task-1", date: "2026-04-20", startTimeMin: 360 };

  it("creates and returns entry when task belongs to org", async () => {
    vi.mocked(prisma.task.findFirst).mockResolvedValue({
      id: "task-1",
      name: "Open shop",
      color: "#F59E0B",
      description: null,
      durationMin: 30,
    } as any);
    vi.mocked(prisma.timetableEntry.create).mockResolvedValue(mockEntry as any);

    const result = await createTimetableEntryFromInput("org-1", input as any);

    expect(result).toEqual({ ok: true, data: mockEntry });
    expect(prisma.timetableEntry.create).toHaveBeenCalled();
  });

  it("returns INVALID when task does not belong to org", async () => {
    vi.mocked(prisma.task.findFirst).mockResolvedValue(null);

    const result = await createTimetableEntryFromInput("org-1", input as any);

    expect(result).toEqual({
      ok: false,
      error: "Invalid taskId: not found or does not belong to this org",
      code: "INVALID",
    });
    expect(prisma.timetableEntry.create).not.toHaveBeenCalled();
  });

  it("caps endTimeMin at 1440 when task extends past midnight", async () => {
    vi.mocked(prisma.task.findFirst).mockResolvedValue({
      id: "task-1",
      name: "Night task",
      color: "#000",
      description: null,
      durationMin: 120,
    } as any);
    vi.mocked(prisma.timetableEntry.create).mockResolvedValue(mockEntry as any);

    // startTimeMin 1380 (23:00) + 120 min = 1500 → should cap to 1440
    await createTimetableEntryFromInput("org-1", {
      ...input,
      startTimeMin: 1380,
    } as any);

    const createCall = vi.mocked(prisma.timetableEntry.create).mock.calls[0][0];
    expect((createCall as any).data.endTimeMin).toBeLessThanOrEqual(1440);
  });

  it("returns INVALID on foreign key violation (P2003)", async () => {
    vi.mocked(prisma.task.findFirst).mockResolvedValue({
      id: "task-1",
      name: "t",
      color: "#000",
      description: null,
      durationMin: 30,
    } as any);
    const err = new Prisma.PrismaClientKnownRequestError("FK violation", {
      code: "P2003",
      clientVersion: "5.0.0",
      meta: {},
    });
    vi.mocked(prisma.timetableEntry.create).mockRejectedValue(err);

    const result = await createTimetableEntryFromInput("org-1", input as any);

    expect(result).toEqual({
      ok: false,
      error: "Invalid taskId: not found or does not belong to this org",
      code: "INVALID",
    });
  });
});

// ─── createTimetableEntry ─────────────────────────────────────────────────────

describe("createTimetableEntry", () => {
  it("creates entry and returns ok: true", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({
      timezone: "UTC",
    } as any);
    vi.mocked(prisma.task.findFirst).mockResolvedValue({
      id: "task-1",
      name: "Open",
      color: "#F59E0B",
      description: null,
      durationMin: 30,
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

  it("returns NOT_FOUND when task does not belong to org", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({
      timezone: "UTC",
    } as any);
    vi.mocked(prisma.task.findFirst).mockResolvedValue(null);

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
