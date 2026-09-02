import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({
  requireOrgPermission: vi.fn(),
}));
vi.mock("@/lib/services/memberships", () => ({
  deleteMembership: vi.fn(),
}));

import { requireOrgPermission } from "@/lib/authz";
import { deleteMembership } from "@/lib/services/memberships";
import { DELETE } from "@/app/api/mobile/me/organizations/[orgId]/memberships/[membershipId]/route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DELETE /api/mobile/me/organizations/[orgId]/memberships/[membershipId]", () => {
  it("removes a member when authorized", async () => {
    vi.mocked(requireOrgPermission).mockResolvedValue({ ok: true, userId: "user-1", userEmail: "owner@example.com", membership: {} as any } as any);
    vi.mocked(deleteMembership).mockResolvedValue({ ok: true, data: null } as any);

    const res = await DELETE(new Request("http://localhost:3000", { method: "DELETE" }), {
      params: Promise.resolve({ orgId: "org-1", membershipId: "mem-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(deleteMembership).toHaveBeenCalledWith("org-1", "mem-1", "user-1", "owner@example.com");
  });
});