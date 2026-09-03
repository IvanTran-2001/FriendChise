import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({
  requireOrgMember: vi.fn(),
}));
vi.mock("@/lib/services/roles", () => ({
  getRoles: vi.fn(),
}));

import { requireOrgMember } from "@/lib/authz";
import { getRoles } from "@/lib/services/roles";
import { GET } from "@/app/api/mobile/me/organizations/[orgId]/roles/route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/mobile/me/organizations/[orgId]/roles", () => {
  it("returns paged roles for org members", async () => {
    vi.mocked(requireOrgMember).mockResolvedValue({
      ok: true,
      userId: "user-1",
      userEmail: "owner@example.com",
      membership: { id: "mem-1" } as any,
    } as any);
    vi.mocked(getRoles).mockResolvedValue({
      roles: [
        {
          id: "role-1",
          name: "Manager",
          color: "#111111",
          key: "manager",
          isDeletable: true,
          isDefault: false,
          permissions: [{ action: "MANAGE_MEMBERS" }],
          eligibleFor: [{ task: { id: "task-1", name: "Morning Shift", color: "#00aa00" } }],
        },
      ],
      totalCount: 1,
      totalPages: 1,
      page: 1,
      pageSize: 10,
    } as any);

    const res: Response = await GET(new Request("http://localhost:3000/api/mobile/me/organizations/org-1/roles?page=1&pageSize=10&search=man"), {
      params: Promise.resolve({ orgId: "org-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.hasMore).toBe(false);
    expect(data.roles[0].name).toBe("Manager");
    expect(data.roles[0].permissions).toHaveLength(1);
    expect(getRoles).toHaveBeenCalledWith("org-1", expect.objectContaining({ page: 1, pageSize: 10, search: "man" }));
  });

  it("normalizes page and pageSize defaults", async () => {
    vi.mocked(requireOrgMember).mockResolvedValue({
      ok: true,
      userId: "user-1",
      userEmail: "owner@example.com",
      membership: { id: "mem-1" } as any,
    } as any);
    vi.mocked(getRoles).mockResolvedValue({
      roles: [],
      totalCount: 0,
      totalPages: 1,
      page: 1,
      pageSize: 20,
    } as any);

    const res: Response = await GET(new Request("http://localhost:3000/api/mobile/me/organizations/org-1/roles?page=0&pageSize=999"), {
      params: Promise.resolve({ orgId: "org-1" }),
    });

    expect(res.status).toBe(200);
    expect(getRoles).toHaveBeenCalledWith("org-1", expect.objectContaining({ page: 1, pageSize: 50 }));
  });

  it("rejects unauthenticated users", async () => {
    vi.mocked(requireOrgMember).mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    } as any);

    const res: Response = await GET(new Request("http://localhost:3000/api/mobile/me/organizations/org-1/roles"), {
      params: Promise.resolve({ orgId: "org-1" }),
    });

    expect(res.status).toBe(401);
    expect(getRoles).not.toHaveBeenCalled();
  });
});