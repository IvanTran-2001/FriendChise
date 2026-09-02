import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz/_shared", () => ({
  getAuthUser: vi.fn(),
}));
vi.mock("@/lib/http/request-body", () => ({
  parseRequestBody: vi.fn(),
}));
vi.mock("@/lib/services/orgs", () => ({
  deleteOrg: vi.fn(),
}));

import { getAuthUser } from "@/lib/authz/_shared";
import { parseRequestBody } from "@/lib/http/request-body";
import { deleteOrg as deleteOrgService } from "@/lib/services/orgs";
import { DELETE } from "@/app/api/mobile/me/organizations/[orgId]/route";

function createRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/mobile/me/organizations/org-1", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DELETE /api/mobile/me/organizations/[orgId]", () => {
  it("returns 401 when the bearer token is missing", async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null as any);

    const res = await DELETE(createRequest({ confirmName: "My Café" }), { params: Promise.resolve({ orgId: "org-1" }) });
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
    expect(deleteOrgService).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ id: "user-1", email: "owner@example.com" } as any);
    vi.mocked(parseRequestBody).mockResolvedValue(NextResponse.json({ error: "Malformed JSON body." }, { status: 400 }) as any);

    const res = await DELETE(createRequest("not-json"), { params: Promise.resolve({ orgId: "org-1" }) });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Malformed JSON body.");
    expect(deleteOrgService).not.toHaveBeenCalled();
  });

  it("deletes when the confirmation name matches", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ id: "user-1", email: "owner@example.com" } as any);
    vi.mocked(parseRequestBody).mockResolvedValue({ confirmName: "My Café" } as any);
    vi.mocked(deleteOrgService).mockResolvedValue(undefined as any);

    const res = await DELETE(createRequest({ confirmName: "My Café" }), { params: Promise.resolve({ orgId: "org-1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(deleteOrgService).toHaveBeenCalledWith("org-1", "user-1", "My Café", "owner@example.com");
  });

  it("maps confirmation mismatch to 400", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ id: "user-1", email: "owner@example.com" } as any);
    vi.mocked(parseRequestBody).mockResolvedValue({ confirmName: "Wrong Name" } as any);
    vi.mocked(deleteOrgService).mockRejectedValue(new Error("Confirmation name does not match"));

    const res = await DELETE(createRequest({ confirmName: "Wrong Name" }), { params: Promise.resolve({ orgId: "org-1" }) });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Confirmation name does not match");
  });
});