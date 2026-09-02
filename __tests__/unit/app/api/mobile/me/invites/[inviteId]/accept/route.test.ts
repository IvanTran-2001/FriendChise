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
  acceptMemberInvite: vi.fn(),
  acceptBotSlotInvite: vi.fn(),
}));
vi.mock("@/lib/services/orgs", () => ({
  joinFranchise: vi.fn(),
}));

import { getAuthUser } from "@/lib/authz/_shared";
import { prisma } from "@/lib/platform/prisma";
import { acceptMemberInvite, acceptBotSlotInvite } from "@/lib/services/invites";
import { joinFranchise } from "@/lib/services/orgs";
import { POST } from "@/app/api/mobile/me/invites/[inviteId]/accept/route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/mobile/me/invites/[inviteId]/accept", () => {
  it("accepts a member invite", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ id: "user-1", email: "user@example.com" } as any);
    vi.mocked(prisma.invite.findUnique).mockResolvedValue({
      id: "inv-1",
      recipientId: "user-1",
      type: "MEMBER",
      metadata: {},
      orgId: "org-1",
    } as any);
    vi.mocked(acceptMemberInvite).mockResolvedValue({ ok: true, data: null } as any);

    const res = await POST(new Request("http://localhost:3000", { method: "POST" }), {
      params: Promise.resolve({ inviteId: "inv-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(acceptMemberInvite).toHaveBeenCalledWith("inv-1", "user-1", "user@example.com");
  });

  it("accepts a bot-slot invite", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ id: "user-1", email: "user@example.com" } as any);
    vi.mocked(prisma.invite.findUnique).mockResolvedValue({
      id: "inv-2",
      recipientId: "user-1",
      type: "MEMBER",
      metadata: { botMembershipId: "mem-bot" },
      orgId: "org-1",
    } as any);
    vi.mocked(acceptBotSlotInvite).mockResolvedValue({ ok: true, data: null } as any);

    const res = await POST(new Request("http://localhost:3000", { method: "POST" }), {
      params: Promise.resolve({ inviteId: "inv-2" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(acceptBotSlotInvite).toHaveBeenCalledWith("inv-2", "user-1", "user@example.com");
  });

  it("accepts a franchise invite by joining the franchise", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ id: "user-1", email: "user@example.com" } as any);
    vi.mocked(prisma.invite.findUnique).mockResolvedValue({
      id: "inv-3",
      recipientId: "user-1",
      type: "FRANCHISE",
      metadata: { token: "franchise-token" },
      orgId: "org-1",
    } as any);
    vi.mocked(joinFranchise).mockResolvedValue({
      org: { id: "org-new", name: "Acme: User", image: null },
      clonedRoles: [],
      membership: {},
    } as any);

    const res = await POST(new Request("http://localhost:3000", { method: "POST" }), {
      params: Promise.resolve({ inviteId: "inv-3" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.organization.id).toBe("org-new");
    expect(joinFranchise).toHaveBeenCalledWith("user-1", "user@example.com", { token: "franchise-token" });
  });
});
