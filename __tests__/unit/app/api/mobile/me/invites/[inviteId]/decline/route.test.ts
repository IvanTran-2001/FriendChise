import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz/_shared", () => ({
  getAuthUser: vi.fn(),
}));
vi.mock("@/lib/platform/prisma", () => ({
  prisma: {
    invite: {
      findUnique: vi.fn(),
    },
  },
}));
vi.mock("@/lib/services/invites", () => ({
  declineMemberInvite: vi.fn(),
  declineBotSlotInvite: vi.fn(),
  declineFranchiseInvite: vi.fn(),
}));

import { getAuthUser } from "@/lib/authz/_shared";
import { prisma } from "@/lib/platform/prisma";
import {
  declineMemberInvite,
  declineBotSlotInvite,
  declineFranchiseInvite,
} from "@/lib/services/invites";
import { POST } from "@/app/api/mobile/me/invites/[inviteId]/decline/route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/mobile/me/invites/[inviteId]/decline", () => {
  it("declines a member invite", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ id: "user-1", email: "user@example.com" } as any);
    vi.mocked(prisma.invite.findUnique).mockResolvedValue({
      id: "inv-1",
      recipientId: "user-1",
      type: "MEMBER",
      metadata: {},
    } as any);
    vi.mocked(declineMemberInvite).mockResolvedValue({ ok: true, data: null } as any);

    const res = await POST(new Request("http://localhost:3000", { method: "POST" }), {
      params: Promise.resolve({ inviteId: "inv-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(declineMemberInvite).toHaveBeenCalledWith("inv-1", "user-1");
  });

  it("declines a franchise invite", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ id: "user-1", email: "user@example.com" } as any);
    vi.mocked(prisma.invite.findUnique).mockResolvedValue({
      id: "inv-2",
      recipientId: "user-1",
      type: "FRANCHISE",
      metadata: { token: "franchise-token" },
    } as any);
    vi.mocked(declineFranchiseInvite).mockResolvedValue({ ok: true, data: null } as any);

    const res = await POST(new Request("http://localhost:3000", { method: "POST" }), {
      params: Promise.resolve({ inviteId: "inv-2" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(declineFranchiseInvite).toHaveBeenCalledWith("inv-2", "user-1");
  });

  it("maps handled franchise invite failures to 409", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ id: "user-1", email: "user@example.com" } as any);
    vi.mocked(prisma.invite.findUnique).mockResolvedValue({
      id: "inv-3",
      recipientId: "user-1",
      type: "FRANCHISE",
      metadata: { token: "franchise-token" },
    } as any);
    vi.mocked(declineFranchiseInvite).mockResolvedValue({ ok: false, error: "This invite has already been handled", code: "CONFLICT" } as any);

    const res = await POST(new Request("http://localhost:3000", { method: "POST" }), {
      params: Promise.resolve({ inviteId: "inv-3" }),
    });
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toBe("This invite has already been handled");
  });
});
