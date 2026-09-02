import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz/_shared", () => ({
  getAuthUser: vi.fn(),
}));
vi.mock("@/lib/services/invites", () => ({
  getPaginatedInvitesForUser: vi.fn(),
}));

import { getAuthUser } from "@/lib/authz/_shared";
import { getPaginatedInvitesForUser } from "@/lib/services/invites";
import { GET } from "@/app/api/mobile/me/invites/route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/mobile/me/invites", () => {
  it("returns paged invite history with subtypes", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ id: "user-1", email: "user@example.com" } as any);
    vi.mocked(getPaginatedInvitesForUser).mockResolvedValue({
      items: [
        {
          id: "inv-1",
          type: "MEMBER",
          status: "PENDING",
          orgId: "org-1",
          orgName: "Acme",
          inviterName: "Owner",
          seenAt: null,
          expiresAt: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          acceptedAt: null,
          declinedAt: null,
          metadata: {},
        },
      ] as any,
      total: 1,
      totalPages: 1,
    } as any);

    const res = await GET(new Request("http://localhost:3000/api/mobile/me/invites?page=1&pageSize=10"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.hasMore).toBe(false);
    expect(data.invites[0].subtype).toBe("MEMBER");
  });

  it("passes search through to the invite service", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ id: "user-1", email: "user@example.com" } as any);
    vi.mocked(getPaginatedInvitesForUser).mockResolvedValue({
      items: [],
      total: 0,
      totalPages: 1,
    } as any);

    await GET(new Request("http://localhost:3000/api/mobile/me/invites?page=2&pageSize=5&search=alex"));

    expect(getPaginatedInvitesForUser).toHaveBeenCalledWith(
      "user-1",
      2,
      5,
      expect.objectContaining({ view: "all", search: "alex" }),
    );
  });
});
