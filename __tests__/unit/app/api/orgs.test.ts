import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

// ─── Mock modules ─────────────────────────────────────────────────────────────

vi.mock("@/lib/authz", () => ({
  requireUser: vi.fn(),
}));
vi.mock("@/lib/services/orgs", () => ({
  createOrg: vi.fn(),
}));

import { requireUser } from "@/lib/authz";
import { createOrg } from "@/lib/services/orgs";
import { POST } from "@/app/api/orgs/route";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeReq = (body: unknown) =>
  new Request("http://localhost/api/orgs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const authenticated = { ok: true as const, userId: "user-1" };
const unauthenticated = {
  ok: false as const,
  response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
};

beforeEach(() => vi.clearAllMocks());

// ─── POST /api/orgs ───────────────────────────────────────────────────────────

describe("POST /api/orgs", () => {
  it("returns 401 when not authenticated", async () => {
    vi.mocked(requireUser).mockResolvedValue(unauthenticated);

    const res = await POST(makeReq({ title: "Acme" }));

    expect(res.status).toBe(401);
  });

  it("returns 400 on invalid JSON body", async () => {
    vi.mocked(requireUser).mockResolvedValue(authenticated);

    const req = new Request("http://localhost/api/orgs", {
      method: "POST",
      body: "not-json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid JSON body");
  });

  it("returns 400 with issues on validation failure", async () => {
    vi.mocked(requireUser).mockResolvedValue(authenticated);

    const res = await POST(makeReq({ title: "" }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Validation failed");
    expect(body.issues).toBeDefined();
  });

  it("calls createOrg service with userId and parsed data", async () => {
    vi.mocked(requireUser).mockResolvedValue(authenticated);
    vi.mocked(createOrg).mockResolvedValue({ org: { id: "org-1" } } as any);

    await POST(makeReq({ title: "Acme Café" }));

    expect(createOrg).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ title: "Acme Café" }),
    );
  });

  it("returns 201 with org data on success", async () => {
    vi.mocked(requireUser).mockResolvedValue(authenticated);
    vi.mocked(createOrg).mockResolvedValue({ org: { id: "org-1", name: "Acme Café" } } as any);

    const res = await POST(makeReq({ title: "Acme Café" }));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ org: { id: "org-1" } });
  });
});
