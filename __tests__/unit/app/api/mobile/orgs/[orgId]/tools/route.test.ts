import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({
  requireOrgMember: vi.fn(),
}));
vi.mock("@/lib/services/tools", () => ({
  getToolItemLists: vi.fn(),
}));

import { requireOrgMember } from "@/lib/authz";
import { getToolItemLists } from "@/lib/services/tools";
import { GET } from "@/app/api/mobile/orgs/[orgId]/tools/route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/mobile/orgs/[orgId]/tools", () => {
  it("returns tool sets for org members with bearer auth", async () => {
    vi.mocked(requireOrgMember).mockResolvedValue({
      ok: true,
      userId: "user-1",
      userEmail: "owner@example.com",
      membership: { id: "mem-1" } as any,
    } as any);
    vi.mocked(getToolItemLists).mockResolvedValue([
      {
        id: "set-1",
        name: "Kitchen Checklist",
        description: null,
        displayType: "GRID",
        updatedAt: new Date("2026-09-01T00:00:00Z"),
        _count: { select: { entries: 3 } },
      },
    ] as any);

    const res: Response = await GET(new Request("http://localhost:3000/api/mobile/orgs/org-1/tools"), {
      params: Promise.resolve({ orgId: "org-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(data.items[0].name).toBe("Kitchen Checklist");
    expect(getToolItemLists).toHaveBeenCalledWith("org-1");
  });

  it("returns 401 for unauthenticated callers", async () => {
    vi.mocked(requireOrgMember).mockResolvedValue({
      ok: false,
      response: Response.json({ error: "Unauthorized" }, { status: 401 }),
    } as any);

    const res: Response = await GET(new Request("http://localhost:3000/api/mobile/orgs/org-1/tools"), {
      params: Promise.resolve({ orgId: "org-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
    expect(getToolItemLists).not.toHaveBeenCalled();
  });

  it("returns 403 for non-members", async () => {
    vi.mocked(requireOrgMember).mockResolvedValue({
      ok: false,
      response: Response.json({ error: "Forbidden" }, { status: 403 }),
    } as any);

    const res: Response = await GET(new Request("http://localhost:3000/api/mobile/orgs/org-1/tools"), {
      params: Promise.resolve({ orgId: "org-1" }),
    });

    expect(res.status).toBe(403);
    expect(getToolItemLists).not.toHaveBeenCalled();
  });
});
