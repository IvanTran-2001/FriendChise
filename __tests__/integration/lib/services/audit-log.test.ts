/**
 * Integration tests for lib/services/audit-log.ts
 *
 * Verifies that recordAudit persists entries correctly and that getAuditLogs
 * returns them scoped to the org, newest-first.
 */
import { prisma } from "@/lib/prisma";
import { recordAudit, getAuditLogs } from "@/lib/services/audit-log";
import { getSeedOrg } from "../../helpers";

describe("recordAudit", () => {
  it("persists an entry with the correct fields", async () => {
    const org = await getSeedOrg();
    const targetId = crypto.randomUUID();

    await recordAudit({
      orgId: org.id,
      action: "test.create",
      targetType: "TestEntity",
      targetId,
      after: { foo: "bar" },
    });

    const entry = await prisma.auditLog.findFirst({
      where: { orgId: org.id, targetId, action: "test.create" },
    });

    expect(entry).not.toBeNull();
    expect(entry?.targetType).toBe("TestEntity");
    expect(entry?.after).toMatchObject({ foo: "bar" });
    expect(entry?.actorId).toBeNull();
  });

  it("records actorId and before/after snapshots", async () => {
    const org = await getSeedOrg();
    const user = await prisma.user.findFirstOrThrow({
      where: { memberships: { some: { orgId: org.id } } },
    });
    const targetId = crypto.randomUUID();

    await recordAudit({
      orgId: org.id,
      actorId: user.id,
      action: "test.update",
      targetType: "TestEntity",
      targetId,
      before: { name: "old" },
      after: { name: "new" },
    });

    const entry = await prisma.auditLog.findFirst({
      where: { orgId: org.id, targetId, action: "test.update" },
    });

    expect(entry?.actorId).toBe(user.id);
    expect(entry?.before).toMatchObject({ name: "old" });
    expect(entry?.after).toMatchObject({ name: "new" });
  });

  it("swallows errors for a bad orgId (fire-and-forget)", async () => {
    // recordAudit must not throw even for invalid data when no tx client
    await expect(
      recordAudit({
        orgId: "nonexistent-org-id",
        action: "test.noop",
        targetType: "Test",
        targetId: "no-target",
      }),
    ).resolves.toBeUndefined();
  });
});

describe("getAuditLogs", () => {
  it("returns entries for the org, newest-first", async () => {
    const org = await getSeedOrg();
    const targetId = crypto.randomUUID();

    await recordAudit({
      orgId: org.id,
      action: "test.first",
      targetType: "T",
      targetId,
    });
    await recordAudit({
      orgId: org.id,
      action: "test.second",
      targetType: "T",
      targetId,
    });

    const logs = await getAuditLogs(org.id);
    const relevant = logs.filter((l) => l.targetId === targetId);

    expect(relevant).toHaveLength(2);
    expect(relevant[0].action).toBe("test.second"); // newest first
    expect(relevant[1].action).toBe("test.first");
  });

  it("scopes entries to the org — does not bleed into another org", async () => {
    const org = await getSeedOrg();
    const otherOrg = await prisma.organization.findFirstOrThrow({
      where: { id: { not: org.id } },
    });
    const targetId = crypto.randomUUID();

    await recordAudit({
      orgId: org.id,
      action: "test.scoped",
      targetType: "T",
      targetId,
    });

    const logs = await getAuditLogs(otherOrg.id);
    expect(logs.some((l) => l.targetId === targetId)).toBe(false);
  });

  it("honours the limit parameter", async () => {
    const org = await getSeedOrg();
    const logs = await getAuditLogs(org.id, 1);
    expect(logs.length).toBeLessThanOrEqual(1);
  });
});
