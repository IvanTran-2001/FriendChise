/**
 * Integration tests for lib/services/timetable-entries.ts
 *
 * Tests the core CRUD operations and assignee management against the real DB.
 * Uses seeded tasks and memberships from Donut Shop A — no extra setup users needed.
 */
import { prisma } from "@/lib/prisma";
import {
  createTimetableEntry,
  listTimetableEntries,
  getTimetableEntry,
  updateTimetableEntryStatus,
  updateTimetableEntry,
  deleteTimetableEntry,
  addTimetableEntryAssignee,
  removeTimetableEntryAssignee,
} from "@/lib/services/timetable-entries";
import { EntryStatus } from "@prisma/client";
import { getSeedOrg } from "../../helpers";

describe("createTimetableEntry", () => {
  it("persists an entry with snapshot fields copied from the task", async () => {
    const org = await getSeedOrg();
    const task = await prisma.task.findFirstOrThrow({
      where: { orgId: org.id },
    });

    const result = await createTimetableEntry(
      org.id,
      task.id,
      "2026-08-01",
      360,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const entry = result.data;
    expect(entry.orgId).toBe(org.id);
    expect(entry.taskId).toBe(task.id);
    expect(entry.taskName).toBe(task.name);
    expect(entry.taskColor).toBe(task.color);
    expect(entry.durationMin).toBe(task.durationMin);
    expect(entry.status).toBe(EntryStatus.TODO);
  });

  it("returns NOT_FOUND when the task belongs to a different org", async () => {
    const org = await getSeedOrg();
    const crossOrgTask = await prisma.task.findFirstOrThrow({
      where: { orgId: { not: org.id } },
    });

    const result = await createTimetableEntry(
      org.id,
      crossOrgTask.id,
      "2026-08-01",
      360,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("NOT_FOUND");
  });
});

describe("listTimetableEntries", () => {
  it("returns all entries for the org (scoped)", async () => {
    const org = await getSeedOrg();
    const task = await prisma.task.findFirstOrThrow({
      where: { orgId: org.id },
    });
    const created = await createTimetableEntry(org.id, task.id, "2026-08-02", 480);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const entries = await listTimetableEntries(org.id);

    expect(entries.length).toBeGreaterThanOrEqual(1);
    expect(entries.every((e) => e.orgId === org.id)).toBe(true);
    expect(entries.some((e) => e.id === created.data.id && e.startTimeMin === 480)).toBe(true);
  });

  it("filters by exact status when the status option is provided", async () => {
    const org = await getSeedOrg();
    const task = await prisma.task.findFirstOrThrow({
      where: { orgId: org.id },
    });
    const created = await createTimetableEntry(
      org.id,
      task.id,
      "2026-08-03",
      480,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    // Mark it DONE
    await updateTimetableEntryStatus(org.id, created.data.id, EntryStatus.DONE);

    const todos = await listTimetableEntries(org.id, {
      status: EntryStatus.TODO,
    });
    expect(todos.every((e) => e.status === EntryStatus.TODO)).toBe(true);

    const dones = await listTimetableEntries(org.id, {
      status: EntryStatus.DONE,
    });
    expect(dones.some((e) => e.id === created.data.id)).toBe(true);
  });
});

describe("getTimetableEntry", () => {
  it("returns the entry when it exists in the org", async () => {
    const org = await getSeedOrg();
    const task = await prisma.task.findFirstOrThrow({
      where: { orgId: org.id },
    });
    const created = await createTimetableEntry(
      org.id,
      task.id,
      "2026-08-04",
      480,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await getTimetableEntry(org.id, created.data.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.id).toBe(created.data.id);
  });

  it("returns NOT_FOUND when queried from a different org", async () => {
    const org = await getSeedOrg();
    const otherOrg = await prisma.organization.findFirstOrThrow({
      where: { id: { not: org.id } },
    });
    const task = await prisma.task.findFirstOrThrow({
      where: { orgId: org.id },
    });
    const created = await createTimetableEntry(
      org.id,
      task.id,
      "2026-08-05",
      480,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await getTimetableEntry(otherOrg.id, created.data.id);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("NOT_FOUND");
  });
});

describe("updateTimetableEntryStatus", () => {
  it("updates the status of an existing entry", async () => {
    const org = await getSeedOrg();
    const task = await prisma.task.findFirstOrThrow({
      where: { orgId: org.id },
    });
    const created = await createTimetableEntry(
      org.id,
      task.id,
      "2026-08-06",
      480,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await updateTimetableEntryStatus(
      org.id,
      created.data.id,
      EntryStatus.DONE,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.status).toBe(EntryStatus.DONE);
  });

  it("returns NOT_FOUND for a nonexistent entry", async () => {
    const org = await getSeedOrg();

    const result = await updateTimetableEntryStatus(
      org.id,
      "nonexistent-entry-id",
      EntryStatus.DONE,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("NOT_FOUND");
  });
});

describe("updateTimetableEntry", () => {
  it("persists a status change", async () => {
    const org = await getSeedOrg();
    const task = await prisma.task.findFirstOrThrow({
      where: { orgId: org.id },
    });
    const created = await createTimetableEntry(
      org.id,
      task.id,
      "2026-08-07",
      480,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await updateTimetableEntry(org.id, created.data.id, {
      status: EntryStatus.IN_PROGRESS,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.status).toBe(EntryStatus.IN_PROGRESS);
  });

  it("returns NOT_FOUND for a nonexistent entry", async () => {
    const org = await getSeedOrg();

    const result = await updateTimetableEntry(org.id, "nonexistent-id", {
      status: EntryStatus.DONE,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("NOT_FOUND");
  });
});

describe("deleteTimetableEntry", () => {
  it("removes the entry from the DB", async () => {
    const org = await getSeedOrg();
    const task = await prisma.task.findFirstOrThrow({
      where: { orgId: org.id },
    });
    const created = await createTimetableEntry(
      org.id,
      task.id,
      "2026-08-08",
      480,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await deleteTimetableEntry(org.id, created.data.id);

    expect(result.ok).toBe(true);

    const gone = await prisma.timetableEntry.findUnique({
      where: { id: created.data.id },
    });
    expect(gone).toBeNull();
  });

  it("returns NOT_FOUND for a nonexistent entry", async () => {
    const org = await getSeedOrg();

    const result = await deleteTimetableEntry(org.id, "nonexistent-entry-id");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("NOT_FOUND");
  });
});

describe("addTimetableEntryAssignee / removeTimetableEntryAssignee", () => {
  it("adds and removes a membership from an entry", async () => {
    const org = await getSeedOrg();
    const task = await prisma.task.findFirstOrThrow({
      where: { orgId: org.id },
    });
    const member = await prisma.membership.findFirstOrThrow({
      where: { orgId: org.id, userId: { not: null } },
    });
    const created = await createTimetableEntry(
      org.id,
      task.id,
      "2026-08-09",
      480,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    // Add
    const addResult = await addTimetableEntryAssignee(
      org.id,
      created.data.id,
      member.id,
    );
    expect(addResult.ok).toBe(true);

    const link = await prisma.timetableEntryAssignee.findFirst({
      where: { timetableEntryId: created.data.id, membershipId: member.id },
    });
    expect(link).not.toBeNull();

    // Remove
    const removeResult = await removeTimetableEntryAssignee(
      org.id,
      created.data.id,
      member.id,
    );
    expect(removeResult.ok).toBe(true);

    const gone = await prisma.timetableEntryAssignee.findFirst({
      where: { timetableEntryId: created.data.id, membershipId: member.id },
    });
    expect(gone).toBeNull();
  });

  it("returns NOT_FOUND when removing a link that does not exist", async () => {
    const org = await getSeedOrg();
    const task = await prisma.task.findFirstOrThrow({
      where: { orgId: org.id },
    });
    const member = await prisma.membership.findFirstOrThrow({
      where: { orgId: org.id, userId: { not: null } },
    });
    const created = await createTimetableEntry(
      org.id,
      task.id,
      "2026-08-10",
      480,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    // No assignee was added — remove should fail
    const result = await removeTimetableEntryAssignee(
      org.id,
      created.data.id,
      member.id,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("NOT_FOUND");
  });
});
