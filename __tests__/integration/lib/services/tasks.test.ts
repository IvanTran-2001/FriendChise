/**
 * Integration tests for lib/services/tasks.ts
 *
 * Tests real DB behaviour: persisted rows, org scoping, NOT_FOUND guards,
 * and cascade cleanup when a task is deleted while eligibility rows exist.
 */
import { prisma } from "@/lib/prisma";
import {
  createTask,
  deleteTask,
  getTasks,
  updateTask,
} from "@/lib/services/tasks";

const SEED_USER_EMAIL =
  process.env.INTEGRATION_TEST_USER_EMAIL ?? "alt28919@gmail.com";

// Re-use the first seeded org that belongs to the integration test user.
async function getSeedOrg() {
  const user = await prisma.user.findFirstOrThrow({
    where: { email: SEED_USER_EMAIL },
  });
  const membership = await prisma.membership.findFirstOrThrow({
    where: { userId: user.id },
    include: { organization: true },
  });
  return membership.organization;
}

function uniqueTask() {
  return {
    title: `Test Task ${crypto.randomUUID()}`,
    color: "#ff0000",
    durationMin: 30,
  };
}

describe("createTask", () => {
  it("persists a task and returns it with the correct org", async () => {
    const org = await getSeedOrg();
    const input = uniqueTask();
    const task = await createTask(org.id, input);

    expect(task.name).toBe(input.title);
    expect(task.orgId).toBe(org.id);

    const found = await prisma.task.findUnique({ where: { id: task.id } });
    expect(found).not.toBeNull();
  });

  it("scopes tasks to the org — does not appear in another org", async () => {
    const org = await getSeedOrg();
    const task = await createTask(org.id, uniqueTask());

    const otherOrg = await prisma.organization.findFirstOrThrow({
      where: { id: { not: org.id } },
    });
    const tasks = await getTasks(otherOrg.id);
    const ids = tasks.map((t) => t.id);
    expect(ids).not.toContain(task.id);
  });
});

describe("deleteTask", () => {
  it("removes the task from the DB", async () => {
    const org = await getSeedOrg();
    const task = await createTask(org.id, uniqueTask());

    const result = await deleteTask(org.id, task.id);
    expect(result.ok).toBe(true);

    const found = await prisma.task.findUnique({ where: { id: task.id } });
    expect(found).toBeNull();
  });

  it("returns NOT_FOUND when the task doesn't exist", async () => {
    const org = await getSeedOrg();
    const result = await deleteTask(org.id, "non-existent-task-id");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("NOT_FOUND");
  });

  it("returns NOT_FOUND when the task belongs to a different org", async () => {
    const org = await getSeedOrg();
    const task = await createTask(org.id, uniqueTask());

    const otherOrg = await prisma.organization.findFirstOrThrow({
      where: { id: { not: org.id } },
    });

    // Attempt cross-org delete — must be rejected
    const result = await deleteTask(otherOrg.id, task.id);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("NOT_FOUND");

    // Original task should still exist
    const found = await prisma.task.findUnique({ where: { id: task.id } });
    expect(found).not.toBeNull();
  });

  it("cascades — TaskEligibility rows are removed with the task", async () => {
    const org = await getSeedOrg();
    const task = await createTask(org.id, uniqueTask());

    // Create a role with eligibility for this task
    const role = await prisma.role.create({
      data: {
        orgId: org.id,
        name: `Test Cascade Role ${crypto.randomUUID()}`,
        key: crypto.randomUUID(),
        color: "#888",
        isDeletable: true,
        isDefault: false,
      },
    });
    await prisma.taskEligibility.create({
      data: { taskId: task.id, roleId: role.id },
    });

    await deleteTask(org.id, task.id);

    const eligibility = await prisma.taskEligibility.findFirst({
      where: { taskId: task.id },
    });
    expect(eligibility).toBeNull();
  });
});

describe("updateTask", () => {
  it("persists the updated fields", async () => {
    const org = await getSeedOrg();
    const task = await createTask(org.id, uniqueTask());

    const result = await updateTask(org.id, task.id, {
      title: "Updated Task",
      color: "#00ff00",
      durationMin: 60,
    });
    expect(result.ok).toBe(true);

    const updated = await prisma.task.findUniqueOrThrow({
      where: { id: task.id },
    });
    expect(updated.name).toBe("Updated Task");
    expect(updated.durationMin).toBe(60);
  });

  it("returns NOT_FOUND when the task doesn't exist", async () => {
    const org = await getSeedOrg();
    const result = await updateTask(org.id, "non-existent-id", {
      title: `x ${crypto.randomUUID()}`,
      color: "#000",
      durationMin: 10,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("NOT_FOUND");
  });
});
