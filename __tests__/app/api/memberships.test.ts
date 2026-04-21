import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

// ─── Mock modules ─────────────────────────────────────────────────────────────

vi.mock("@/lib/authz", () => ({
  requireOrgPermission: vi.fn(),
}));
vi.mock("@/lib/services/memberships", () => ({
  createMembership: vi.fn(),
  deleteMembership: vi.fn(),
  getMemberships: vi.fn(),
}));

import { requireOrgPermission } from "@/lib/authz";
import { createMembership, deleteMembership, getMemberships } from "@/lib/services/memberships";
import { POST, DELETE, GET } from "@/app/api/orgs/[orgId]/memberships/route";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeReq = (method: string, body?: unknown) =>
  new Request("http://localhost/api/orgs/org-1/memberships", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

const params = Promise.resolve({ orgId: "org-1" });

const validCuid = "clh5z1a0o0000p1v8fq5xz3y4";
const validCuid2 = "clh5z1a0o0001p1v8fq5xz3y4";

const permitted = {
  ok: true as const,
  userId: "user-1",
  membership: { id: "mem-1" } as any,
};
const forbidden = {
  ok: false as const,
  response: NextResponse.json({ error: "Permission denied" }, { status: 403 }),
};

beforeEach(() => vi.clearAllMocks());

// ─── POST /api/orgs/[orgId]/memberships ───────────────────────────────────────

describe("POST /api/orgs/[orgId]/memberships", () => {
  it("returns 403 when permission check fails", async () => {
    vi.mocked(requireOrgPermission).mockResolvedValue(forbidden);

    const res = await POST(makeReq("POST", { userId: validCuid, roleId: validCuid2 }), { params });

    expect(res.status).toBe(403);
  });

  it("returns 400 on invalid JSON body", async () => {
    vi.mocked(requireOrgPermission).mockResolvedValue(permitted);

    const req = new Request("http://localhost/api/orgs/org-1/memberships", {
      method: "POST",
      body: "bad-json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, { params });

    expect(res.status).toBe(400);
  });

  it("returns 400 when validation fails (non-cuid userId)", async () => {
    vi.mocked(requireOrgPermission).mockResolvedValue(permitted);

    const res = await POST(makeReq("POST", { userId: "not-cuid", roleId: validCuid }), { params });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Validation failed");
  });

  it("returns 409 when membership already exists (CONFLICT)", async () => {
    vi.mocked(requireOrgPermission).mockResolvedValue(permitted);
    vi.mocked(createMembership).mockResolvedValue({
      ok: false, error: "Already a member", code: "CONFLICT",
    });

    const res = await POST(makeReq("POST", { userId: validCuid, roleId: validCuid2 }), { params });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("Already a member");
  });

  it("returns 201 with membership on success", async () => {
    vi.mocked(requireOrgPermission).mockResolvedValue(permitted);
    const membership = { id: "mem-new", userId: validCuid };
    vi.mocked(createMembership).mockResolvedValue({ ok: true, data: membership as any });

    const res = await POST(makeReq("POST", { userId: validCuid, roleId: validCuid2 }), { params });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ id: "mem-new" });
  });
});

// ─── DELETE /api/orgs/[orgId]/memberships ─────────────────────────────────────

describe("DELETE /api/orgs/[orgId]/memberships", () => {
  it("returns 403 when permission check fails", async () => {
    vi.mocked(requireOrgPermission).mockResolvedValue(forbidden);

    const res = await DELETE(makeReq("DELETE", { userId: validCuid }), { params });

    expect(res.status).toBe(403);
  });

  it("returns 400 when validation fails", async () => {
    vi.mocked(requireOrgPermission).mockResolvedValue(permitted);

    const res = await DELETE(makeReq("DELETE", { userId: "not-cuid" }), { params });

    expect(res.status).toBe(400);
  });

  it("returns 404 when membership not found", async () => {
    vi.mocked(requireOrgPermission).mockResolvedValue(permitted);
    vi.mocked(deleteMembership).mockResolvedValue({
      ok: false, error: "Not found", code: "NOT_FOUND",
    });

    const res = await DELETE(makeReq("DELETE", { userId: validCuid }), { params });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Not found");
  });

  it("returns 200 on successful delete", async () => {
    vi.mocked(requireOrgPermission).mockResolvedValue(permitted);
    vi.mocked(deleteMembership).mockResolvedValue({ ok: true, data: null });

    const res = await DELETE(makeReq("DELETE", { userId: validCuid }), { params });

    expect(res.status).toBe(200);
  });
});

// ─── GET /api/orgs/[orgId]/memberships ────────────────────────────────────────

describe("GET /api/orgs/[orgId]/memberships", () => {
  it("returns 403 when permission check fails", async () => {
    vi.mocked(requireOrgPermission).mockResolvedValue(forbidden);

    const res = await GET(makeReq("GET"), { params });

    expect(res.status).toBe(403);
  });

  it("returns memberships array on success", async () => {
    vi.mocked(requireOrgPermission).mockResolvedValue(permitted);
    const memberships = [{ id: "mem-1", userId: "user-1" }];
    vi.mocked(getMemberships).mockResolvedValue(memberships as any);

    const res = await GET(makeReq("GET"), { params });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(memberships);
    expect(getMemberships).toHaveBeenCalledWith("org-1");
  });
});
