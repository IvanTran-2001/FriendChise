import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz/_shared", () => ({
  getAuthUser: vi.fn(),
}));
vi.mock("@/lib/http/request-body", () => ({
  parseRequestBody: vi.fn(),
}));
vi.mock("@/lib/services/orgs", () => ({
  joinFranchise: vi.fn(),
}));
vi.mock("@/lib/platform/supabase-storage", () => ({
  getPublicUrl: vi.fn((path: string) => `https://cdn.example.com/${path}`),
}));

import { getAuthUser } from "@/lib/authz/_shared";
import { parseRequestBody } from "@/lib/http/request-body";
import { joinFranchise as joinFranchiseService } from "@/lib/services/orgs";
import { POST } from "@/app/api/mobile/me/organizations/join/route";

function createJsonRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/mobile/me/organizations/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/mobile/me/organizations/join", () => {
  it("returns 401 when the bearer token is missing", async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null as any);

    const res = await POST(createJsonRequest({ token: "invite-token" }));
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
    expect(joinFranchiseService).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ id: "user-1", email: "user@example.com" } as any);
    vi.mocked(parseRequestBody).mockResolvedValue(NextResponse.json({ error: "Malformed JSON body." }, { status: 400 }) as any);

    const res = await POST(createJsonRequest("not-json"));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Malformed JSON body.");
    expect(joinFranchiseService).not.toHaveBeenCalled();
  });

  it("joins a franchise with bearer auth", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ id: "user-1", email: "user@example.com" } as any);
    vi.mocked(parseRequestBody).mockResolvedValue({ token: "invite-token" } as any);
    vi.mocked(joinFranchiseService).mockResolvedValue({
      org: {
        id: "org-new",
        name: "Demo Franchise: Riley",
        image: "orgs/franchise.png",
      } as any,
      clonedRoles: [] as any,
      membership: {} as any,
    });

    const res = await POST(createJsonRequest({ token: "invite-token" }));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.organization).toEqual({
      id: "org-new",
      name: "Demo Franchise: Riley",
      image: "https://cdn.example.com/orgs/franchise.png",
    });
    expect(joinFranchiseService).toHaveBeenCalledWith("user-1", "user@example.com", expect.objectContaining({ token: "invite-token" }));
  });
});