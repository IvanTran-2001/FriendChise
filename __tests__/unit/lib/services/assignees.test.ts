import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createAssignee, deleteAssignee } from "@/lib/services/assignees";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    timetableEntry: {
      findFirst: vi.fn(),
    },
    membership: {
      findFirst: vi.fn(),
    },
    timetableEntryAssignee: {
      create: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

beforeEach(() => vi.clearAllMocks());

// ─── createAssignee ───────────────────────────────────────────────────────────

describe("createAssignee", () => {
  it("creates and returns the assignee when both entry and membership exist", async () => {
    const assignee = {
      id: "asn-1",
      timetableEntryId: "entry-1",
      membershipId: "mem-1",
    };
    vi.mocked(prisma.timetableEntry.findFirst).mockResolvedValue({
      id: "entry-1",
    } as any);
    vi.mocked(prisma.membership.findFirst).mockResolvedValue({
      id: "mem-1",
    } as any);
    vi.mocked(prisma.timetableEntryAssignee.create).mockResolvedValue(
      assignee as any,
    );

    const result = await createAssignee("org-1", "entry-1", "mem-1");

    expect(result).toEqual({ ok: true, data: assignee });
    expect(prisma.timetableEntryAssignee.create).toHaveBeenCalledWith({
      data: { timetableEntryId: "entry-1", membershipId: "mem-1" },
    });
  });

  it("returns NOT_FOUND when timetable entry does not belong to org", async () => {
    vi.mocked(prisma.timetableEntry.findFirst).mockResolvedValue(null);

    const result = await createAssignee("org-1", "bad-entry", "mem-1");

    expect(result).toEqual({
      ok: false,
      error: "Timetable entry not found in this org",
      code: "NOT_FOUND",
    });
    expect(prisma.membership.findFirst).not.toHaveBeenCalled();
    expect(prisma.timetableEntryAssignee.create).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND when membership does not belong to org", async () => {
    vi.mocked(prisma.timetableEntry.findFirst).mockResolvedValue({
      id: "entry-1",
    } as any);
    vi.mocked(prisma.membership.findFirst).mockResolvedValue(null);

    const result = await createAssignee("org-1", "entry-1", "bad-mem");

    expect(result).toEqual({
      ok: false,
      error: "Membership not found in this org",
      code: "NOT_FOUND",
    });
    expect(prisma.timetableEntryAssignee.create).not.toHaveBeenCalled();
  });

  it("returns CONFLICT on duplicate assignee (P2002)", async () => {
    vi.mocked(prisma.timetableEntry.findFirst).mockResolvedValue({
      id: "entry-1",
    } as any);
    vi.mocked(prisma.membership.findFirst).mockResolvedValue({
      id: "mem-1",
    } as any);
    const err = new Prisma.PrismaClientKnownRequestError("Unique constraint", {
      code: "P2002",
      clientVersion: "5.0.0",
      meta: {},
    });
    vi.mocked(prisma.timetableEntryAssignee.create).mockRejectedValue(err);

    const result = await createAssignee("org-1", "entry-1", "mem-1");

    expect(result).toEqual({
      ok: false,
      error: "Assignee already exists",
      code: "CONFLICT",
    });
  });

  it("re-throws unexpected errors", async () => {
    vi.mocked(prisma.timetableEntry.findFirst).mockResolvedValue({
      id: "entry-1",
    } as any);
    vi.mocked(prisma.membership.findFirst).mockResolvedValue({
      id: "mem-1",
    } as any);
    vi.mocked(prisma.timetableEntryAssignee.create).mockRejectedValue(
      new Error("DB down"),
    );

    await expect(createAssignee("org-1", "entry-1", "mem-1")).rejects.toThrow(
      "DB down",
    );
  });
});

// ─── deleteAssignee ───────────────────────────────────────────────────────────

describe("deleteAssignee", () => {
  it("deletes the assignee and returns ok: true", async () => {
    vi.mocked(prisma.timetableEntryAssignee.findFirst).mockResolvedValue({
      id: "asn-1",
    } as any);
    vi.mocked(prisma.timetableEntryAssignee.delete).mockResolvedValue(
      {} as any,
    );

    const result = await deleteAssignee("org-1", "entry-1", "mem-1");

    expect(result).toEqual({ ok: true, data: null });
    expect(prisma.timetableEntryAssignee.delete).toHaveBeenCalledWith({
      where: { id: "asn-1" },
    });
  });

  it("returns NOT_FOUND when no matching assignee link exists", async () => {
    vi.mocked(prisma.timetableEntryAssignee.findFirst).mockResolvedValue(null);

    const result = await deleteAssignee("org-1", "entry-1", "mem-1");

    expect(result).toEqual({
      ok: false,
      error: "Assignee not found",
      code: "NOT_FOUND",
    });
    expect(prisma.timetableEntryAssignee.delete).not.toHaveBeenCalled();
  });

  it("validates org scope via timetableEntry and membership relations", async () => {
    vi.mocked(prisma.timetableEntryAssignee.findFirst).mockResolvedValue(null);

    await deleteAssignee("org-2", "entry-1", "mem-1");

    // Confirm the where clause includes org scoping through relations
    expect(prisma.timetableEntryAssignee.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          timetableEntryId: "entry-1",
          membershipId: "mem-1",
          timetableEntry: { is: { orgId: "org-2" } },
          membership: { is: { orgId: "org-2" } },
        }),
      }),
    );
  });
});
