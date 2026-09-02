import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({
  requireOrgPermission: vi.fn(),
}));
vi.mock("@/lib/services/roles", () => ({
  deleteRole: vi.fn(),
  updateRole: vi.fn(),
}));

import { requireOrgPermission } from "@/lib/authz";
import { deleteRole, updateRole } from "@/lib/services/roles";
import { DELETE, PATCH } from "@/app/api/mobile/me/organizations/[orgId]/roles/[roleId]/route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PATCH /api/mobile/me/organizations/[orgId]/roles/[roleId]", () => {
  it("updates a role for managers", async () => {
    vi.mocked(requireOrgPermission).mockResolvedValue({
      ok: true,
      userId: "user-1",
      userEmail: "owner@example.com",
      membership: {} as any,
    } as any);
    vi.mocked(updateRole).mockResolvedValue({ ok: true, data: {} as any } as any);

    const res: Response = await PATCH(
      new Request("http://localhost:3000", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Manager",
          color: "#111111",
          permissions: ["MANAGE_MEMBERS"],
          taskIds: ["task-1"],
        }),
      }),
      {
        params: Promise.resolve({ orgId: "org-1", roleId: "role-1" }),
      },
    );

    expect(res.status).toBe(200);
    expect(updateRole).toHaveBeenCalledWith(
      "org-1",
      "role-1",
      {
        name: "Manager",
        color: "#111111",
        permissions: ["MANAGE_MEMBERS"],
        taskIds: ["task-1"],
      },
      "user-1",
      "owner@example.com",
    );
  });

  it("rejects invalid payloads", async () => {
    vi.mocked(requireOrgPermission).mockResolvedValue({
      ok: true,
      userId: "user-1",
      userEmail: "owner@example.com",
      membership: {} as any,
    } as any);

    const res: Response = await PATCH(
      new Request("http://localhost:3000", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "" }),
      }),
      {
        params: Promise.resolve({ orgId: "org-1", roleId: "role-1" }),
      },
    );

    expect(res.status).toBe(400);
    expect(updateRole).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/mobile/me/organizations/[orgId]/roles/[roleId]", () => {
  it("deletes a role for managers", async () => {
    vi.mocked(requireOrgPermission).mockResolvedValue({
      ok: true,
      userId: "user-1",
      userEmail: "owner@example.com",
      membership: {} as any,
    } as any);
    vi.mocked(deleteRole).mockResolvedValue({ ok: true, data: null } as any);

    const res: Response = await DELETE(new Request("http://localhost:3000", { method: "DELETE" }), {
      params: Promise.resolve({ orgId: "org-1", roleId: "role-1" }),
    });

    expect(res.status).toBe(200);
    expect(deleteRole).toHaveBeenCalledWith("org-1", "role-1", "user-1", "owner@example.com");
  });
});