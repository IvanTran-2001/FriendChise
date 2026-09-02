import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz/_shared", () => ({
  getAuthUser: vi.fn(),
  getAuthUserId: vi.fn(),
  getOrgMembership: vi.fn(),
}));
vi.mock("@/lib/authz", () => ({
  requireOrgMember: vi.fn(),
  requireOrgPermission: vi.fn(),
}));
vi.mock("@/lib/platform/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/platform/supabase-storage", () => ({
  getPublicUrl: vi.fn((path: string) => `https://cdn.example.com/${path}`),
}));
vi.mock("@/lib/http/request-body", () => ({
  parseRequestBody: vi.fn(),
}));
vi.mock("@/lib/services/memberships", () => ({
  getMembershipsPage: vi.fn(),
}));
vi.mock("@/lib/services/invites", () => ({
  createMemberInvite: vi.fn(),
}));

import { requireOrgMember, requireOrgPermission } from "@/lib/authz";
import { parseRequestBody } from "@/lib/http/request-body";
import { prisma } from "@/lib/platform/prisma";
import { createMemberInvite } from "@/lib/services/invites";
import { getMembershipsPage } from "@/lib/services/memberships";
import { GET, POST } from "@/app/api/mobile/me/organizations/[orgId]/memberships/route";

beforeEach(() => {
  vi.clearAllMocks();
});

function createGetRequest(url = "http://localhost:3000/api/mobile/me/organizations/org-1/memberships?page=1&pageSize=10") {
  return new Request(url, { method: "GET" });
}

function createPostRequest(body: unknown) {
  return new Request("http://localhost:3000/api/mobile/me/organizations/org-1/memberships", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("GET /api/mobile/me/organizations/[orgId]/memberships", () => {
  it("returns paged memberships for members", async () => {
    vi.mocked(requireOrgMember).mockResolvedValue({ ok: true, userId: "user-1", userEmail: "user@example.com", membership: {} as any } as any);
    vi.mocked(getMembershipsPage).mockResolvedValue({
      memberships: [
        {
          id: "mem-1",
          userId: "user-1",
          botName: null,
          status: "ACTIVE",
          joinedAt: new Date("2026-01-01T00:00:00.000Z"),
          workingDays: [],
          user: { id: "user-1", name: "Riley", email: "riley@example.com", image: null },
          memberRoles: [{ role: { id: "role-1", name: "Member", color: "#000" } }],
        },
      ] as any,
      totalCount: 1,
      totalPages: 1,
      page: 1,
      pageSize: 10,
      search: undefined,
      roleId: null,
    } as any);

    const res = await GET(createGetRequest(), { params: Promise.resolve({ orgId: "org-1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.hasMore).toBe(false);
    expect(data.memberships[0].name).toBe("Riley");
    expect(getMembershipsPage).toHaveBeenCalledWith(
      "org-1",
      expect.objectContaining({ page: 1, pageSize: 10 }),
    );
  });
});

describe("POST /api/mobile/me/organizations/[orgId]/memberships", () => {
  it("invites a member with manage-members permission", async () => {
    vi.mocked(requireOrgPermission).mockResolvedValue({ ok: true, userId: "user-1", userEmail: "owner@example.com", membership: {} as any } as any);
    vi.mocked(parseRequestBody).mockResolvedValue({ email: "new@example.com", roleIds: [], workingDays: ["mon"] } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "user-new" } as any);
    vi.mocked(createMemberInvite).mockResolvedValue({ ok: true, data: null } as any);

    const res = await POST(createPostRequest({ email: "new@example.com", roleIds: [], workingDays: ["mon"] }), { params: Promise.resolve({ orgId: "org-1" }) });
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.ok).toBe(true);
    expect(createMemberInvite).toHaveBeenCalledWith("org-1", "user-1", "user-new", [], ["mon"], { actorEmail: "owner@example.com" });
  });
});