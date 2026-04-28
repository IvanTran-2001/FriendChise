/**
 * Integration tests for lib/services/assignees.ts
 *
 * Tests the assignee API-layer service (createAssignee, deleteAssignee,
 * getAssignees) which includes cross-org validation not present in the
 * lower-level timetable-entries helpers.
 */
import { prisma } from "@/lib/prisma";
import {
  createAssignee,
  deleteAssignee,
  getAssignees,
} from "@/lib/services/assignees";
import { getSeedOrg, createSeedEntry } from "../../helpers";

describe("createAssignee", () => {
  it("creates the link and returns the row", async () => {
    const org = await getSeedOrg();
    const entry = await createSeedEntry(org.id);
    const member = await prisma.membership.findFirstOrThrow({
      where: { orgId: org.id, userId: { not: null } },
    });

    const result = await createAssignee(org.id, entry.id, member.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.timetableEntryId).toBe(entry.id);
    expect(result.data.membershipId).toBe(member.id);
  });

  it("returns CONFLICT on a duplicate assignment", async () => {
    const org = await getSeedOrg();
    const entry = await createSeedEntry(org.id);
    const member = await prisma.membership.findFirstOrThrow({
      where: { orgId: org.id, userId: { not: null } },
    });

    await createAssignee(org.id, entry.id, member.id); // first — OK

    const result = await createAssignee(org.id, entry.id, member.id); // duplicate

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("CONFLICT");
  });

  it("returns NOT_FOUND when the entry belongs to a different org", async () => {
    const org = await getSeedOrg();
    const otherOrg = await prisma.organization.findFirstOrThrow({
      where: { id: { not: org.id } },
    });
    const entry = await createSeedEntry(org.id);
    const member = await prisma.membership.findFirstOrThrow({
      where: { orgId: org.id, userId: { not: null } },
    });

    // Query the entry using the wrong org
    const result = await createAssignee(otherOrg.id, entry.id, member.id);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("NOT_FOUND");
  });

  it("returns NOT_FOUND when the membership belongs to a different org", async () => {
    const org = await getSeedOrg();
    const otherOrg = await prisma.organization.findFirstOrThrow({
      where: { id: { not: org.id } },
    });
    const entry = await createSeedEntry(org.id);
    const crossOrgMember = await prisma.membership.findFirstOrThrow({
      where: { orgId: otherOrg.id, userId: { not: null } },
    });

    const result = await createAssignee(org.id, entry.id, crossOrgMember.id);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("NOT_FOUND");
  });
});

describe("deleteAssignee", () => {
  it("removes the assignee link from the DB", async () => {
    const org = await getSeedOrg();
    const entry = await createSeedEntry(org.id);
    const member = await prisma.membership.findFirstOrThrow({
      where: { orgId: org.id, userId: { not: null } },
    });

    await createAssignee(org.id, entry.id, member.id);

    const result = await deleteAssignee(org.id, entry.id, member.id);

    expect(result.ok).toBe(true);

    const link = await prisma.timetableEntryAssignee.findFirst({
      where: { timetableEntryId: entry.id, membershipId: member.id },
    });
    expect(link).toBeNull();
  });

  it("returns NOT_FOUND when the link does not exist", async () => {
    const org = await getSeedOrg();
    const entry = await createSeedEntry(org.id);
    const member = await prisma.membership.findFirstOrThrow({
      where: { orgId: org.id, userId: { not: null } },
    });

    // No assignee was ever added
    const result = await deleteAssignee(org.id, entry.id, member.id);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("NOT_FOUND");
  });
});

describe("getAssignees", () => {
  it("returns all assignees with membership and user details", async () => {
    const org = await getSeedOrg();
    const entry = await createSeedEntry(org.id);
    const member = await prisma.membership.findFirstOrThrow({
      where: { orgId: org.id, userId: { not: null } },
    });

    await createAssignee(org.id, entry.id, member.id);

    const assignees = await getAssignees(org.id, entry.id);

    expect(assignees).toHaveLength(1);
    expect(assignees[0].membershipId).toBe(member.id);
    expect(assignees[0].membership.user).not.toBeNull();
  });

  it("returns an empty array when no assignees have been added", async () => {
    const org = await getSeedOrg();
    const entry = await createSeedEntry(org.id);

    const assignees = await getAssignees(org.id, entry.id);

    expect(assignees).toHaveLength(0);
  });
});
