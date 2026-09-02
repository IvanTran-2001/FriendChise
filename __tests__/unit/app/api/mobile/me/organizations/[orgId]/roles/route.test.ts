import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz/_shared", () => ({
  getAuthUserId: vi.fn(),
  getOrgMembership: vi.fn(),
}));
vi.mock("@/lib/services/roles", () => ({
  getRolesPage: vi.fn(),
}));

import { getAuthUserId, getOrgMembership } from "@/lib/authz/_shared";
import { getRolesPage } from "@/lib/services/roles";
import { GET } from "@/app/api/mobile/me/organizations/[orgId]/roles/route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/mobile/me/organizations/[orgId]/roles", () => {
  it("returns paged roles for org members", async () => {
    vi.mocked(getAuthUserId).mockResolvedValue("user-1");
    vi.mocked(getOrgMembership).mockResolvedValue({ id: "mem-1" } as any);
    vi.mocked(getRolesPage).mockResolvedValue({
      roles: [{ id: "role-1", name: "Manager", color: "#111111", isDefault: false }],
      totalCount: 1,
      totalPages: 1,
      page: 1,
      pageSize: 10,
    } as any);

    const res = await GET(new Request("http://localhost:3000/api/mobile/me/organizations/org-1/roles?page=1&pageSize=10&search=man"), {
      params: Promise.resolve({ orgId: "org-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.hasMore).toBe(false);
    expect(data.roles[0].name).toBe("Manager");
    expect(getRolesPage).toHaveBeenCalledWith("org-1", expect.objectContaining({ page: 1, pageSize: 10, search: "man" }));
  });

  it("rejects unauthenticated users", async () => {
    vi.mocked(getAuthUserId).mockResolvedValue(null);

    const res = await GET(new Request("http://localhost:3000/api/mobile/me/organizations/org-1/roles"), {
      params: Promise.resolve({ orgId: "org-1" }),
    });

    expect(res.status).toBe(401);
    expect(getOrgMembership).not.toHaveBeenCalled();
  });
});