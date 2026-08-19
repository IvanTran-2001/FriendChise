import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  reconcileIvanSeedIdentity,
  reconcileIvanSeedIdentityAtomic,
} from "@/scripts/seeds/seed-donut-shop-a-identity";

const legacyEmail = "mystoganx2001@gmail.com";
const canonicalEmail = "friendchise+ivan@seed.local";

function makePrismaMock() {
  const prisma: any = {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    organization: { updateMany: vi.fn() },
    account: { updateMany: vi.fn() },
    session: { updateMany: vi.fn() },
    demoSession: { updateMany: vi.fn() },
    invite: { updateMany: vi.fn() },
    notification: { updateMany: vi.fn() },
    announcementRead: { updateMany: vi.fn() },
    auditLog: { updateMany: vi.fn() },
    feedback: { updateMany: vi.fn() },
    task: { updateMany: vi.fn() },
    taskComment: { updateMany: vi.fn() },
    taskCommentVote: { updateMany: vi.fn() },
    scanTaskResult: { updateMany: vi.fn() },
    membership: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    memberRole: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    timetableEntryAssignee: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    timetableTemplateEntryAssignee: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    rosterEntry: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    rosterTemplateEntry: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  };

  prisma.$transaction = vi.fn(async (fn: any) => fn(prisma));

  return prisma;
}

beforeEach(() => vi.clearAllMocks());

describe("reconcileIvanSeedIdentity", () => {
  it("renames the legacy Ivan row when rerunning the previous seed state", async () => {
    const prisma = makePrismaMock();
    prisma.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "legacy-ivan", email: legacyEmail, name: "Ivan" });
    prisma.user.update.mockResolvedValue({ id: "legacy-ivan", email: canonicalEmail, name: "Ivan" });

    const result = await reconcileIvanSeedIdentity(prisma, canonicalEmail, legacyEmail);

    expect(result).toEqual({ id: "legacy-ivan", email: canonicalEmail, name: "Ivan" });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "legacy-ivan" },
      data: { email: canonicalEmail, name: "Ivan" },
    });
  });

  it("merges a duplicate legacy Ivan record into the canonical user", async () => {
    const prisma = makePrismaMock();
    prisma.user.findUnique
      .mockResolvedValueOnce({ id: "seed-ivan", email: canonicalEmail, name: "Ivan" })
      .mockResolvedValueOnce({ id: "legacy-ivan", email: legacyEmail, name: "Ivan" });
    prisma.membership.findMany.mockResolvedValue([{ id: "legacy-membership", orgId: "org-1" }]);
    prisma.membership.findFirst.mockResolvedValue({ id: "seed-membership", orgId: "org-1" });
    prisma.memberRole.findMany
      .mockResolvedValueOnce([{ id: "mr-1", membershipId: "legacy-membership", roleId: "role-a" }])
      .mockResolvedValueOnce([{ id: "mr-2", membershipId: "seed-membership", roleId: "role-b" }]);
    prisma.timetableEntryAssignee.findMany
      .mockResolvedValueOnce([{ id: "tea-1", membershipId: "legacy-membership", timetableEntryId: "entry-a" }])
      .mockResolvedValueOnce([]);
    prisma.timetableTemplateEntryAssignee.findMany
      .mockResolvedValueOnce([{ id: "ttea-1", membershipId: "legacy-membership", templateEntryId: "tmpl-a" }])
      .mockResolvedValueOnce([]);
    prisma.rosterEntry.findMany
      .mockResolvedValueOnce([{ id: "re-1", membershipId: "legacy-membership", orgId: "org-1", weekStart: new Date("2024-01-01T00:00:00Z"), dayIndex: 1 }])
      .mockResolvedValueOnce([]);
    prisma.rosterTemplateEntry.findMany
      .mockResolvedValueOnce([{ id: "rte-1", membershipId: "legacy-membership", templateId: "tmpl-1", weekIndex: 0, dayIndex: 1 }])
      .mockResolvedValueOnce([]);
    prisma.scanTaskResult.updateMany.mockResolvedValue(undefined);

    await reconcileIvanSeedIdentity(prisma, canonicalEmail, legacyEmail);

    expect(prisma.organization.updateMany).toHaveBeenCalledWith({
      where: { ownerId: "legacy-ivan" },
      data: { ownerId: "seed-ivan" },
    });
    expect(prisma.scanTaskResult.updateMany).toHaveBeenCalledWith({
      where: { createdById: "legacy-ivan" },
      data: { createdById: "seed-ivan" },
    });
    expect(prisma.membership.delete).toHaveBeenCalledWith({ where: { id: "legacy-membership" } });
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: "legacy-ivan" } });
  });

  it("rolls back earlier reconciliation writes when a delegate fails", async () => {
    const state = {
      organizationUpdated: false,
    };

    const prisma: any = {
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      organization: {
        updateMany: vi.fn(async () => {
          state.organizationUpdated = true;
        }),
      },
      account: { updateMany: vi.fn() },
      session: { updateMany: vi.fn() },
      demoSession: { updateMany: vi.fn() },
      invite: { updateMany: vi.fn() },
      notification: { updateMany: vi.fn() },
      announcementRead: { updateMany: vi.fn() },
      auditLog: { updateMany: vi.fn() },
      feedback: { updateMany: vi.fn() },
      task: { updateMany: vi.fn() },
      taskComment: { updateMany: vi.fn() },
      taskCommentVote: { updateMany: vi.fn() },
      scanTaskResult: {
        updateMany: vi.fn(async () => {
          throw new Error("scan-task failure");
        }),
      },
      membership: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        updateMany: vi.fn(),
        delete: vi.fn(),
      },
      memberRole: {
        findMany: vi.fn(),
        updateMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      timetableEntryAssignee: {
        findMany: vi.fn(),
        updateMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      timetableTemplateEntryAssignee: {
        findMany: vi.fn(),
        updateMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      rosterEntry: {
        findMany: vi.fn(),
        updateMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      rosterTemplateEntry: {
        findMany: vi.fn(),
        updateMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      $transaction: vi.fn(async (fn: any) => {
        const snapshot = { ...state };
        try {
          return await fn(prisma);
        } catch (error) {
          state.organizationUpdated = snapshot.organizationUpdated;
          throw error;
        }
      }),
    };

    prisma.user.findUnique
      .mockResolvedValueOnce({ id: "seed-ivan", email: canonicalEmail, name: "Ivan" })
      .mockResolvedValueOnce({ id: "legacy-ivan", email: legacyEmail, name: "Ivan" });
    prisma.membership.findMany.mockResolvedValue([{ id: "legacy-membership", orgId: "org-1" }]);
    prisma.membership.findFirst.mockResolvedValue({ id: "seed-membership", orgId: "org-1" });
    prisma.memberRole.findMany
      .mockResolvedValueOnce([{ id: "mr-1", membershipId: "legacy-membership", roleId: "role-a" }])
      .mockResolvedValueOnce([{ id: "mr-2", membershipId: "seed-membership", roleId: "role-b" }]);
    prisma.timetableEntryAssignee.findMany
      .mockResolvedValueOnce([{ id: "tea-1", membershipId: "legacy-membership", timetableEntryId: "entry-a" }])
      .mockResolvedValueOnce([]);
    prisma.timetableTemplateEntryAssignee.findMany
      .mockResolvedValueOnce([{ id: "ttea-1", membershipId: "legacy-membership", templateEntryId: "tmpl-a" }])
      .mockResolvedValueOnce([]);
    prisma.rosterEntry.findMany
      .mockResolvedValueOnce([{ id: "re-1", membershipId: "legacy-membership", orgId: "org-1", weekStart: new Date("2024-01-01T00:00:00Z"), dayIndex: 1 }])
      .mockResolvedValueOnce([]);
    prisma.rosterTemplateEntry.findMany
      .mockResolvedValueOnce([{ id: "rte-1", membershipId: "legacy-membership", templateId: "tmpl-1", weekIndex: 0, dayIndex: 1 }])
      .mockResolvedValueOnce([]);

    await expect(reconcileIvanSeedIdentityAtomic(prisma, canonicalEmail, legacyEmail)).rejects.toThrow("scan-task failure");
    expect(state.organizationUpdated).toBe(false);
  });
});