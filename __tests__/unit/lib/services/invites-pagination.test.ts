import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/platform/prisma", () => ({
  prisma: {
    invite: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/platform/prisma";
import { getPaginatedInvitesForUser } from "@/lib/services/invites";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getPaginatedInvitesForUser", () => {
  it("normalizes invalid pagination values before querying Prisma", async () => {
    vi.mocked(prisma.invite.findMany).mockResolvedValueOnce([] as any);
    vi.mocked(prisma.invite.findMany).mockResolvedValueOnce([] as any);
    vi.mocked(prisma.invite.updateMany).mockResolvedValue({ count: 0 } as any);
    vi.mocked(prisma.invite.count).mockResolvedValue(0);

    await getPaginatedInvitesForUser("user-1", Number.POSITIVE_INFINITY, Number.NaN);

    expect(prisma.invite.findMany).toHaveBeenCalledTimes(2);
    expect(prisma.invite.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ skip: 0, take: 10 }),
    );
  });
});