/**
 * Integration tests for lib/services/templates.ts
 *
 * Covers the full template lifecycle: create, add/remove/update entries,
 * resize cycle length, manage assignees, rename, duplicate, and delete.
 * All tests use the seeded org and tasks from Donut Shop A — no new users needed.
 */
import { prisma } from "@/lib/prisma";
import {
  createTemplate,
  addTemplateInstance,
  removeTemplateInstance,
  updateTemplateInstance,
  updateTemplateDays,
  addTemplateInstanceAssignee,
  removeTemplateInstanceAssignee,
  renameTemplate,
  duplicateTemplate,
  deleteTemplate,
} from "@/lib/services/templates";
import { getSeedOrg } from "../../helpers";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Creates a fresh template in the seed org with a unique name. */
async function makeTemplate(orgId: string, cycleLengthDays = 7) {
  const result = await createTemplate(
    orgId,
    `Template ${crypto.randomUUID()}`,
    cycleLengthDays,
  );
  if (!result.ok) throw new Error("createTemplate failed in test setup");
  return result.data;
}

// ─────────────────────────────────────────────────────────────────────────────
// createTemplate
// ─────────────────────────────────────────────────────────────────────────────

describe("createTemplate", () => {
  it("creates a template with the correct fields", async () => {
    const org = await getSeedOrg();
    const name = `Template ${crypto.randomUUID()}`;

    const result = await createTemplate(org.id, name, 7);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const template = await prisma.template.findUnique({
      where: { id: result.data.id },
    });
    expect(template).not.toBeNull();
    expect(template?.name).toBe(name);
    expect(template?.cycleLengthDays).toBe(7);
    expect(template?.orgId).toBe(org.id);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// addTemplateInstance / removeTemplateInstance
// ─────────────────────────────────────────────────────────────────────────────

describe("addTemplateInstance", () => {
  it("adds a task entry to a template at the correct day and time", async () => {
    const org = await getSeedOrg();
    const task = await prisma.task.findFirstOrThrow({
      where: { orgId: org.id },
    });
    const { id: templateId } = await makeTemplate(org.id, 7);

    const result = await addTemplateInstance(
      org.id,
      templateId,
      task.id,
      0, // dayIndex
      360, // 06:00
    );

    expect(result.ok).toBe(true);

    const entry = await prisma.templateEntry.findFirst({
      where: { templateId, taskId: task.id, dayIndex: 0 },
    });
    expect(entry).not.toBeNull();
    expect(entry?.startTimeMin).toBe(360);
  });

  it("returns INVALID when dayIndex is out of range", async () => {
    const org = await getSeedOrg();
    const task = await prisma.task.findFirstOrThrow({
      where: { orgId: org.id },
    });
    const { id: templateId } = await makeTemplate(org.id, 7);

    const result = await addTemplateInstance(
      org.id,
      templateId,
      task.id,
      7, // cycleLengthDays is 7 so valid indices are 0–6
      360,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INVALID");
  });

  it("returns NOT_FOUND when the task belongs to a different org", async () => {
    const org = await getSeedOrg();
    const crossOrgTask = await prisma.task.findFirstOrThrow({
      where: { orgId: { not: org.id } },
    });
    const { id: templateId } = await makeTemplate(org.id, 7);

    const result = await addTemplateInstance(
      org.id,
      templateId,
      crossOrgTask.id,
      0,
      360,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("NOT_FOUND");
  });
});

describe("removeTemplateInstance", () => {
  it("removes the entry from the template", async () => {
    const org = await getSeedOrg();
    const task = await prisma.task.findFirstOrThrow({
      where: { orgId: org.id },
    });
    const { id: templateId } = await makeTemplate(org.id, 7);

    await addTemplateInstance(org.id, templateId, task.id, 0, 360);
    const entry = await prisma.templateEntry.findFirstOrThrow({
      where: { templateId, taskId: task.id },
    });

    const result = await removeTemplateInstance(org.id, entry.id);

    expect(result.ok).toBe(true);
    const gone = await prisma.templateEntry.findUnique({
      where: { id: entry.id },
    });
    expect(gone).toBeNull();
  });

  it("returns NOT_FOUND for a nonexistent entry", async () => {
    const org = await getSeedOrg();

    const result = await removeTemplateInstance(org.id, "nonexistent-id");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("NOT_FOUND");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateTemplateInstance
// ─────────────────────────────────────────────────────────────────────────────

describe("updateTemplateInstance", () => {
  it("updates the dayIndex of a template entry", async () => {
    const org = await getSeedOrg();
    const task = await prisma.task.findFirstOrThrow({
      where: { orgId: org.id },
    });
    const { id: templateId } = await makeTemplate(org.id, 7);

    await addTemplateInstance(org.id, templateId, task.id, 0, 360);
    const entry = await prisma.templateEntry.findFirstOrThrow({
      where: { templateId, taskId: task.id },
    });

    const result = await updateTemplateInstance(org.id, entry.id, {
      dayIndex: 3,
    });

    expect(result.ok).toBe(true);

    const updated = await prisma.templateEntry.findUnique({
      where: { id: entry.id },
    });
    expect(updated?.dayIndex).toBe(3);
  });

  it("returns INVALID when the new dayIndex is out of range", async () => {
    const org = await getSeedOrg();
    const task = await prisma.task.findFirstOrThrow({
      where: { orgId: org.id },
    });
    const { id: templateId } = await makeTemplate(org.id, 7);

    await addTemplateInstance(org.id, templateId, task.id, 0, 360);
    const entry = await prisma.templateEntry.findFirstOrThrow({
      where: { templateId, taskId: task.id },
    });

    const result = await updateTemplateInstance(org.id, entry.id, {
      dayIndex: 10, // > cycleLengthDays - 1
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INVALID");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateTemplateDays
// ─────────────────────────────────────────────────────────────────────────────

describe("updateTemplateDays", () => {
  it("resizes the cycle length when no entries would be stranded", async () => {
    const org = await getSeedOrg();
    const { id: templateId } = await makeTemplate(org.id, 7);

    const result = await updateTemplateDays(org.id, templateId, 14);

    expect(result.ok).toBe(true);

    const updated = await prisma.template.findUnique({
      where: { id: templateId },
    });
    expect(updated?.cycleLengthDays).toBe(14);
  });

  it("returns INVALID when shrinking would strand existing entries", async () => {
    const org = await getSeedOrg();
    const task = await prisma.task.findFirstOrThrow({
      where: { orgId: org.id },
    });
    const { id: templateId } = await makeTemplate(org.id, 7);

    // Add an entry at dayIndex 5 — would be stranded by a shrink to 3
    await addTemplateInstance(org.id, templateId, task.id, 5, 360);

    const result = await updateTemplateDays(org.id, templateId, 3);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INVALID");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// addTemplateInstanceAssignee / removeTemplateInstanceAssignee
// ─────────────────────────────────────────────────────────────────────────────

describe("addTemplateInstanceAssignee / removeTemplateInstanceAssignee", () => {
  it("adds and removes a membership from a template entry", async () => {
    const org = await getSeedOrg();
    const task = await prisma.task.findFirstOrThrow({
      where: { orgId: org.id },
    });
    const member = await prisma.membership.findFirstOrThrow({
      where: { orgId: org.id, userId: { not: null } },
    });
    const { id: templateId } = await makeTemplate(org.id, 7);

    await addTemplateInstance(org.id, templateId, task.id, 0, 360);
    const entry = await prisma.templateEntry.findFirstOrThrow({
      where: { templateId, taskId: task.id },
    });

    // Add
    const addResult = await addTemplateInstanceAssignee(
      org.id,
      entry.id,
      member.id,
    );
    expect(addResult.ok).toBe(true);

    const link = await prisma.templateEntryAssignee.findFirst({
      where: { templateEntryId: entry.id, membershipId: member.id },
    });
    expect(link).not.toBeNull();

    // Remove
    const removeResult = await removeTemplateInstanceAssignee(
      org.id,
      entry.id,
      member.id,
    );
    expect(removeResult.ok).toBe(true);

    const gone = await prisma.templateEntryAssignee.findFirst({
      where: { templateEntryId: entry.id, membershipId: member.id },
    });
    expect(gone).toBeNull();
  });

  it("addTemplateInstanceAssignee returns NOT_FOUND for a cross-org membership", async () => {
    const org = await getSeedOrg();
    const task = await prisma.task.findFirstOrThrow({
      where: { orgId: org.id },
    });
    const otherOrg = await prisma.organization.findFirstOrThrow({
      where: { id: { not: org.id } },
    });
    const crossMember = await prisma.membership.findFirstOrThrow({
      where: { orgId: otherOrg.id, userId: { not: null } },
    });
    const { id: templateId } = await makeTemplate(org.id, 7);

    await addTemplateInstance(org.id, templateId, task.id, 0, 360);
    const entry = await prisma.templateEntry.findFirstOrThrow({
      where: { templateId, taskId: task.id },
    });

    const result = await addTemplateInstanceAssignee(
      org.id,
      entry.id,
      crossMember.id,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("NOT_FOUND");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// renameTemplate
// ─────────────────────────────────────────────────────────────────────────────

describe("renameTemplate", () => {
  it("updates the template name", async () => {
    const org = await getSeedOrg();
    const { id: templateId } = await makeTemplate(org.id);
    const newName = `Renamed ${crypto.randomUUID()}`;

    const result = await renameTemplate(org.id, templateId, newName);

    expect(result.ok).toBe(true);

    const updated = await prisma.template.findUnique({
      where: { id: templateId },
    });
    expect(updated?.name).toBe(newName);
  });

  it("returns NOT_FOUND for a nonexistent template", async () => {
    const org = await getSeedOrg();

    const result = await renameTemplate(org.id, "nonexistent-id", "New Name");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("NOT_FOUND");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// duplicateTemplate
// ─────────────────────────────────────────────────────────────────────────────

describe("duplicateTemplate", () => {
  it("creates a copy with all entries preserved", async () => {
    const org = await getSeedOrg();
    const task = await prisma.task.findFirstOrThrow({
      where: { orgId: org.id },
    });
    const { id: templateId } = await makeTemplate(org.id, 7);

    await addTemplateInstance(org.id, templateId, task.id, 2, 480);

    const result = await duplicateTemplate(org.id, templateId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const copy = await prisma.template.findUnique({
      where: { id: result.data.id },
      include: { entries: true },
    });
    expect(copy).not.toBeNull();
    expect(copy?.name).toMatch(/^Copy of /);
    expect(copy?.cycleLengthDays).toBe(7);
    expect(copy?.entries).toHaveLength(1);
    expect(copy?.entries[0].dayIndex).toBe(2);
  });

  it("returns NOT_FOUND for a nonexistent template", async () => {
    const org = await getSeedOrg();

    const result = await duplicateTemplate(org.id, "nonexistent-id");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("NOT_FOUND");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// deleteTemplate
// ─────────────────────────────────────────────────────────────────────────────

describe("deleteTemplate", () => {
  it("removes the template and cascades its entries", async () => {
    const org = await getSeedOrg();
    const task = await prisma.task.findFirstOrThrow({
      where: { orgId: org.id },
    });
    const { id: templateId } = await makeTemplate(org.id, 7);

    await addTemplateInstance(org.id, templateId, task.id, 0, 360);

    const result = await deleteTemplate(org.id, templateId);

    expect(result.ok).toBe(true);

    const gone = await prisma.template.findUnique({
      where: { id: templateId },
    });
    expect(gone).toBeNull();

    const entries = await prisma.templateEntry.findMany({
      where: { templateId },
    });
    expect(entries).toHaveLength(0);
  });

  it("returns NOT_FOUND for a nonexistent template", async () => {
    const org = await getSeedOrg();

    const result = await deleteTemplate(org.id, "nonexistent-id");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("NOT_FOUND");
  });
});
