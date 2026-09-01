import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz/_shared", () => ({
  getAuthUser: vi.fn(),
  getAuthUserId: vi.fn(),
}));
vi.mock("@/lib/platform/prisma", () => ({
  prisma: {
    membership: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));
vi.mock("@/lib/platform/supabase-storage", () => ({
  getPublicUrl: vi.fn((path: string) => `https://cdn.example.com/${path}`),
}));
vi.mock("@/lib/http/request-body", () => ({
  parseRequestBody: vi.fn(),
}));
vi.mock("@/lib/demo", () => ({
  checkDemoLimit: vi.fn(),
}));
vi.mock("@/lib/services/orgs", () => ({
  createOrg: vi.fn(),
}));

import { getAuthUser } from "@/lib/authz/_shared";
import { parseRequestBody } from "@/lib/http/request-body";
import { checkDemoLimit } from "@/lib/demo";
import { createOrg as createOrgService } from "@/lib/services/orgs";
import { POST } from "@/app/api/mobile/me/organizations/route";

const mockUser = (id = "user-1", email = "user@example.com") =>
  vi.mocked(getAuthUser).mockResolvedValue({ id, email } as any);

function createJsonRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/mobile/me/organizations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(checkDemoLimit).mockResolvedValue({ ok: true } as any);
});

describe("POST /api/mobile/me/organizations", () => {
  it("returns 401 when the bearer token is missing", async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null as any);

    const res = await POST(createJsonRequest({ title: "Acme Org" }));
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
    expect(createOrgService).not.toHaveBeenCalled();
  });

  it("returns 429 when the demo org limit is reached", async () => {
    mockUser();
    vi.mocked(checkDemoLimit).mockResolvedValue({ ok: false, error: "Demo organization limit reached." } as any);

    const res = await POST(createJsonRequest({ title: "Acme Org" }));
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(data.error).toBe("Demo organization limit reached.");
    expect(createOrgService).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON", async () => {
    mockUser();
    vi.mocked(parseRequestBody).mockResolvedValue(NextResponse.json({ error: "Malformed JSON body." }, { status: 400 }) as any);

    const res = await POST(createJsonRequest("not-json"));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Malformed JSON body.");
    expect(createOrgService).not.toHaveBeenCalled();
  });

  it("creates an organization with bearer auth", async () => {
    mockUser("user-1", "test@example.com");
    vi.mocked(parseRequestBody).mockResolvedValue({ title: "Acme Org", timezone: "Australia/Sydney" } as any);
    vi.mocked(createOrgService).mockResolvedValue({
      org: {
        id: "org-new",
        name: "Acme Org",
        timezone: "Australia/Sydney",
        address: null,
        operatingDays: [],
        openTimeMin: null,
        closeTimeMin: null,
        image: "orgs/acme.png",
      } as any,
      ownerRole: {} as any,
      memberRole: {} as any,
      membership: {} as any,
    });

    const res = await POST(createJsonRequest({ title: "Acme Org" }));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.organization).toEqual({
      id: "org-new",
      name: "Acme Org",
      timezone: "Australia/Sydney",
      address: null,
      operatingDays: [],
      openTimeMin: null,
      closeTimeMin: null,
      image: "https://cdn.example.com/orgs/acme.png",
    });
    expect(createOrgService).toHaveBeenCalledWith("user-1", expect.objectContaining({ title: "Acme Org" }), "test@example.com");
  });
});