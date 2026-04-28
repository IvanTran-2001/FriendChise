/**
 * Integration tests for lib/services/roles.ts
 *
 * Tests real DB behaviour: role creation with permissions + task eligibility
 * in a single transaction, system role guards (Owner/DefaultMember not deletable),
 * cross-org scoping, and cascade cleanup.
 */
import { prisma } from "@/lib/prisma";
import { createRole, deleteRole, updateRole } from "@/lib/services/roles";
import { PermissionAction } from "@prisma/client";
import { ROLE_KEYS } from "@/lib/rbac";

const SEED_USER_EMAIL =
  process.env.INTEGRATION_TEST_USER_EMAIL ?? "alt28919@gmail.com";

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

describe("createRole", () => {
  it("creates the role, permissions, and task eligibility atomically", async () => {
    const org = await getSeedOrg();

    // Create a task to attach eligibility to
    const task = await prisma.task.create({
      data: {
        orgId: org.id,
        name: `Eligible Task ${crypto.randomUUID()}`,
        color: "#abc",
        durationMin: 15,
      },
    });

    const result = await createRole(org.id, {
      name: `Baker ${crypto.randomUUID()}`,
      color: "#ff9900",
      permissions: [
        PermissionAction.MANAGE_TASKS,
        PermissionAction.VIEW_TIMETABLE,
      ],
      taskIds: [task.id],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const role = result.data;
    expect(role.name).toContain("Baker");
    expect(role.permissions.map((p) => p.action)).toContain(
      PermissionAction.MANAGE_TASKS,
    );
    expect(role.eligibleFor.map((e) => e.task.id)).toContain(task.id);

    // Confirm DB state directly
    const dbRole = await prisma.role.findUniqueOrThrow({
      where: { id: role.id },
      include: { permissions: true, eligibleFor: true },
    });
    expect(dbRole.permissions).toHaveLength(2);
    expect(dbRole.eligibleFor).toHaveLength(1);
  });

  it("returns INVALID and writes nothing if a taskId belongs to another org", async () => {
    const org = await getSeedOrg();
    const otherOrg = await prisma.organization.findFirstOrThrow({
      where: { id: { not: org.id } },
    });
    const foreignTask = await prisma.task.create({
      data: {
        orgId: otherOrg.id,
        name: "Foreign Task",
        color: "#000",
        durationMin: 10,
      },
    });

    const before = await prisma.role.count({ where: { orgId: org.id } });

    const result = await createRole(org.id, {
      name: `Cross-Org Role ${crypto.randomUUID()}`,
      color: "#fff",
      permissions: [],
      taskIds: [foreignTask.id],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INVALID");

    // Transaction rolled back — no new role written
    const after = await prisma.role.count({ where: { orgId: org.id } });
    expect(after).toBe(before);
  });
});

describe("deleteRole", () => {
  it("deletes a custom role and cascades its permissions", async () => {
    const org = await getSeedOrg();

    const created = await createRole(org.id, {
      name: `Temp Role ${crypto.randomUUID()}`,
      color: "#ccc",
      permissions: [PermissionAction.VIEW_TIMETABLE],
      taskIds: [],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const roleId = created.data.id;
    const result = await deleteRole(org.id, roleId);
    expect(result.ok).toBe(true);

    const found = await prisma.role.findUnique({ where: { id: roleId } });
    expect(found).toBeNull();

    const permissions = await prisma.permission.findMany({ where: { roleId } });
    expect(permissions).toHaveLength(0);
  });

  it("refuses to delete the Owner role", async () => {
    const org = await getSeedOrg();
    const ownerRole = await prisma.role.findFirstOrThrow({
      where: { orgId: org.id, key: ROLE_KEYS.OWNER },
    });

    const result = await deleteRole(org.id, ownerRole.id);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INVALID");

    // Still exists
    const still = await prisma.role.findUnique({ where: { id: ownerRole.id } });
    expect(still).not.toBeNull();
  });

  it("returns NOT_FOUND for a cross-org delete attempt", async () => {
    const org = await getSeedOrg();
    const created = await createRole(org.id, {
      name: `Scoped Role ${crypto.randomUUID()}`,
      color: "#123",
      permissions: [],
      taskIds: [],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const otherOrg = await prisma.organization.findFirstOrThrow({
      where: { id: { not: org.id } },
    });
    const result = await deleteRole(otherOrg.id, created.data.id);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("NOT_FOUND");
  });
});

describe("updateRole", () => {
  it("replaces permissions and task eligibility wholesale", async () => {
    const org = await getSeedOrg();

    const task1 = await prisma.task.create({
      data: {
        orgId: org.id,
        name: `Task A ${crypto.randomUUID()}`,
        color: "#111",
        durationMin: 10,
      },
    });
    const task2 = await prisma.task.create({
      data: {
        orgId: org.id,
        name: `Task B ${crypto.randomUUID()}`,
        color: "#222",
        durationMin: 20,
      },
    });

    const created = await createRole(org.id, {
      name: `Updatable Role ${crypto.randomUUID()}`,
      color: "#aaa",
      permissions: [
        PermissionAction.MANAGE_TASKS,
        PermissionAction.VIEW_TIMETABLE,
      ],
      taskIds: [task1.id],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    // Replace: swap permission and task
    const result = await updateRole(org.id, created.data.id, {
      name: created.data.name,
      color: "#bbb",
      permissions: [PermissionAction.MANAGE_TIMETABLE],
      taskIds: [task2.id],
    });
    expect(result.ok).toBe(true);

    const dbRole = await prisma.role.findUniqueOrThrow({
      where: { id: created.data.id },
      include: { permissions: true, eligibleFor: true },
    });

    expect(dbRole.permissions.map((p) => p.action)).toEqual([
      PermissionAction.MANAGE_TIMETABLE,
    ]);
    expect(dbRole.eligibleFor.map((e) => e.taskId)).toEqual([task2.id]);
  });

  it("returns INVALID for the Owner role without entering a transaction", async () => {
    const org = await getSeedOrg();
    const ownerRole = await prisma.role.findFirstOrThrow({
      where: { orgId: org.id, key: ROLE_KEYS.OWNER },
    });

    const result = await updateRole(org.id, ownerRole.id, {
      name: "Hacked Owner",
      color: "#000",
      permissions: [],
      taskIds: [],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INVALID");
  });
});
