import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({
  requireOrgMember: vi.fn(),
}));
vi.mock("@/lib/services/tools", () => ({
  getToolItemListDetail: vi.fn(),
}));

import { requireOrgMember } from "@/lib/authz";
import { getToolItemListDetail } from "@/lib/services/tools";
import { GET } from "@/app/api/mobile/orgs/[orgId]/tools/[setId]/route";

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

describe("GET /api/mobile/orgs/[orgId]/tools/[setId]", () => {
  it("returns the tool set detail for org members", async () => {
    vi.mocked(requireOrgMember).mockResolvedValue(memberAuthz());
    vi.mocked(getToolItemListDetail).mockResolvedValue({
      id: "set-1",
      orgId: "org-1",
      name: "Kitchen Checklist",
      description: "Daily prep",
      displayType: "GRID",
      gridConfig: { gridCols: 4, gridRows: 4 },
      entries: [
        {
          id: "entry-1",
          position: 0,
          amount: 2,
          item: { id: "item-1", name: "Flour", unit: "kg", imgUrl: null },
          checklistEntry: null,
        },
      ],
    } as any);

    const res: Response = await GET(
      new Request("http://localhost:3000/api/mobile/orgs/org-1/tools/set-1"),
      { params: Promise.resolve({ orgId: "org-1", setId: "set-1" }) },
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.toolSet.name).toBe("Kitchen Checklist");
    expect(data.toolSet.entries).toHaveLength(1);
    expect(data.toolSet.entries[0].item.name).toBe("Flour");
    expect(getToolItemListDetail).toHaveBeenCalledWith("set-1", "org-1");
  });

  it("returns 404 when the set does not exist or belongs to another org", async () => {
    vi.mocked(requireOrgMember).mockResolvedValue(memberAuthz());
    vi.mocked(getToolItemListDetail).mockResolvedValue(null as any);

    const res: Response = await GET(
      new Request("http://localhost:3000/api/mobile/orgs/org-1/tools/missing"),
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
      new Request("http://localhost:3000/api/mobile/orgs/org-1/tools/set-1"),
      { params: Promise.resolve({ orgId: "org-1", setId: "set-1" }) },
    );

    expect(res.status).toBe(401);
    expect(getToolItemListDetail).not.toHaveBeenCalled();
  });
});
