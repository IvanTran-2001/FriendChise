import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({
  requireOrgPermission: vi.fn(),
}));
vi.mock("@/lib/http/request-body", () => ({
  parseRequestBody: vi.fn(),
}));
vi.mock("@/lib/services/bots", () => ({
  memberToBot: vi.fn(),
  botToMember: vi.fn(),
}));

import { requireOrgPermission } from "@/lib/authz";
import { parseRequestBody } from "@/lib/http/request-body";
import { memberToBot, botToMember } from "@/lib/services/bots";
import { POST } from "@/app/api/mobile/me/organizations/[orgId]/memberships/[membershipId]/convert/route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/mobile/me/organizations/[orgId]/memberships/[membershipId]/convert", () => {
  it("converts a member to a bot", async () => {
    vi.mocked(requireOrgPermission).mockResolvedValue({ ok: true, userId: "user-1", userEmail: "owner@example.com", membership: {} as any } as any);
    vi.mocked(parseRequestBody).mockResolvedValue({ kind: "bot", overrideName: "placeholder" } as any);
    vi.mocked(memberToBot).mockResolvedValue({ ok: true, data: {} as any } as any);

    const res = await POST(new Request("http://localhost:3000", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "bot", overrideName: "placeholder" }),
    }), { params: Promise.resolve({ orgId: "org-1", membershipId: "mem-1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(memberToBot).toHaveBeenCalledWith("org-1", { membershipId: "mem-1", overrideName: "placeholder" }, "user-1", "owner@example.com");
  });

  it("converts a bot to a member", async () => {
    vi.mocked(requireOrgPermission).mockResolvedValue({ ok: true, userId: "user-1", userEmail: "owner@example.com", membership: {} as any } as any);
    vi.mocked(parseRequestBody).mockResolvedValue({ kind: "member", userId: "usr-new" } as any);
    vi.mocked(botToMember).mockResolvedValue({ ok: true, data: {} as any } as any);

    const res = await POST(new Request("http://localhost:3000", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "member", userId: "usr-new" }),
    }), { params: Promise.resolve({ orgId: "org-1", membershipId: "mem-1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(botToMember).toHaveBeenCalledWith("org-1", { membershipId: "mem-1", userId: "usr-new" }, "user-1");
  });
});