import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({
  requireOrgPermission: vi.fn(),
}));
vi.mock("@/lib/services/memberships", () => ({
  getMembershipDetail: vi.fn(),
  updateMembership: vi.fn(),
  deleteMembership: vi.fn(),
}));

import { requireOrgPermission } from "@/lib/authz";
import { getMembershipDetail, updateMembership } from "@/lib/services/memberships";
import { PATCH } from "@/app/api/mobile/me/organizations/[orgId]/memberships/[membershipId]/route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PATCH /api/mobile/me/organizations/[orgId]/memberships/[membershipId]", () => {
  it("updates roles without resending working days", async () => {
    vi.mocked(requireOrgPermission).mockResolvedValue({ ok: true, userId: "user-1", userEmail: "owner@example.com", membership: {} as any } as any);
    vi.mocked(getMembershipDetail).mockResolvedValue({ workingDays: ["mon", "tue"] } as any);
    vi.mocked(updateMembership).mockResolvedValue({ ok: true, data: null } as any);

    const res = await PATCH(new Request("http://localhost:3000", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roleIds: ["role-1"] }),
    }), {
      params: Promise.resolve({ orgId: "org-1", membershipId: "mem-1" }),
    });

    expect(res.status).toBe(200);
    expect(updateMembership).toHaveBeenCalledWith(
      "org-1",
      "mem-1",
      { roleIds: ["role-1"] },
      "user-1",
      "owner@example.com",
    );
  });
});
