import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({
  requireOrgMember: vi.fn(),
}));
vi.mock("@/lib/services/tools", () => ({
  getToolItemListDetail: vi.fn(),
}));

import { requireOrgMember } from "@/lib/authz";
import { getToolItemListDetail } from "@/lib/services/tools";
import { GET } from "@/app/api/mobile/orgs/[orgId]/tools/[setId]/items/route";

beforeEach(() => {
  vi.clearAllMocks();
});

function memberAuthz() {
  return {
    ok: true,
    userId: "user-1",
    userEmail: "owner@example.com",
    membership: { id: "mem-1" } as any,
  } as any;
}

describe("GET /api/mobile/orgs/[orgId]/tools/[setId]/items", () => {
  it("returns the items of a tool set in list order", async () => {
    vi.mocked(requireOrgMember).mockResolvedValue(memberAuthz());
    vi.mocked(getToolItemListDetail).mockResolvedValue({
      id: "set-1",
      orgId: "org-1",
      name: "Kitchen Checklist",
      entries: [
        {
          id: "entry-1",
          position: 0,
          amount: 2,
          item: { id: "item-1", name: "Flour", unit: "kg", imgUrl: "org-1/flour.png" },
          checklistEntry: { checkedAt: new Date("2026-09-01T10:00:00Z") },
        },
        {
          id: "entry-2",
          position: 1,
          amount: 0,
          item: { id: "item-2", name: "Sugar", unit: "g", imgUrl: null },
          checklistEntry: null,
        },
      ],
    } as any);

    const res: Response = await GET(
      new Request("http://localhost:3000/api/mobile/orgs/org-1/tools/set-1/items"),
      { params: Promise.resolve({ orgId: "org-1", setId: "set-1" }) },
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.items).toHaveLength(2);
    expect(data.items[0]).toMatchObject({
      id: "item-1",
      name: "Flour",
      unit: "kg",
      imgUrl: "org-1/flour.png",
      amount: 2,
      position: 0,
    });
    expect(data.items[0].checkedAt).toBeTruthy();
    expect(data.items[1].checkedAt).toBeNull();
    expect(getToolItemListDetail).toHaveBeenCalledWith("set-1", "org-1");
  });

  it("returns 404 when the set does not exist or belongs to another org", async () => {
    vi.mocked(requireOrgMember).mockResolvedValue(memberAuthz());
    vi.mocked(getToolItemListDetail).mockResolvedValue(null as any);

    const res: Response = await GET(
      new Request("http://localhost:3000/api/mobile/orgs/org-1/tools/missing/items"),
      { params: Promise.resolve({ orgId: "org-1", setId: "missing" }) },
    );
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Tool set not found");
  });

  it("returns 401 for unauthenticated callers", async () => {
    vi.mocked(requireOrgMember).mockResolvedValue({
      ok: false,
      response: Response.json({ error: "Unauthorized" }, { status: 401 }),
    } as any);

    const res: Response = await GET(
      new Request("http://localhost:3000/api/mobile/orgs/org-1/tools/set-1/items"),
      { params: Promise.resolve({ orgId: "org-1", setId: "set-1" }) },
    );

    expect(res.status).toBe(401);
    expect(getToolItemListDetail).not.toHaveBeenCalled();
  });
});
