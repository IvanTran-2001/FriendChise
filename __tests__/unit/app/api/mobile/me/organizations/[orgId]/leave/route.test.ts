import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz/_shared", () => ({
  getAuthUser: vi.fn(),
  getOrgMembership: vi.fn(),
}));
vi.mock("@/lib/services/bots", () => ({
  memberToBot: vi.fn(),
}));

import { getAuthUser, getOrgMembership } from "@/lib/authz/_shared";
import { memberToBot } from "@/lib/services/bots";
import { DELETE } from "@/app/api/mobile/me/organizations/[orgId]/leave/route";

function createRequest(): Request {
  return new Request("http://localhost:3000/api/mobile/me/organizations/org-1/leave", {
    method: "DELETE",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DELETE /api/mobile/me/organizations/[orgId]/leave", () => {
  it("returns 401 when the bearer token is missing", async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null as any);

    const res = await DELETE(createRequest(), { params: Promise.resolve({ orgId: "org-1" }) });
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
    expect(getOrgMembership).not.toHaveBeenCalled();
    expect(memberToBot).not.toHaveBeenCalled();
  });

  it("returns 404 when the caller is not a member", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ id: "user-1", email: "user@example.com" } as any);
    vi.mocked(getOrgMembership).mockResolvedValue(null as any);

    const res = await DELETE(createRequest(), { params: Promise.resolve({ orgId: "org-1" }) });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Membership not found");
    expect(memberToBot).not.toHaveBeenCalled();
  });

  it("returns 403 with a warning when the caller is the owner", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ id: "user-1", email: "user@example.com" } as any);
    vi.mocked(getOrgMembership).mockResolvedValue({ id: "membership-1" } as any);
    vi.mocked(memberToBot).mockResolvedValue({
      ok: false,
      code: "INVALID",
      error: "Cannot convert the organization owner to a bot",
    } as any);

    const res = await DELETE(createRequest(), { params: Promise.resolve({ orgId: "org-1" }) });
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toBe("Organization owners can't leave. Transfer ownership first.");
    expect(memberToBot).toHaveBeenCalledWith(
      "org-1",
      { membershipId: "membership-1", overrideName: "placeholder" },
      "user-1",
      "user@example.com",
    );
  });

  it("returns ok when the membership conversion succeeds", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ id: "user-1", email: "user@example.com" } as any);
    vi.mocked(getOrgMembership).mockResolvedValue({ id: "membership-1" } as any);
    vi.mocked(memberToBot).mockResolvedValue({ ok: true, data: {} as any } as any);

    const res = await DELETE(createRequest(), { params: Promise.resolve({ orgId: "org-1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
  });
});