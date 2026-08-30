import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock modules ─────────────────────────────────────────────────────────────

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));
vi.mock("@/lib/platform/prisma", () => ({
  prisma: {
    membership: {
      count: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));
vi.mock("@/lib/platform/supabase-storage", () => ({
  getPublicUrl: vi.fn((path: string) => `https://cdn.example.com/${path}`),
}));
vi.mock("@/lib/services/orgs", () => ({
  createOrg: vi.fn(),
}));
vi.mock("@/lib/demo", () => ({
  checkDemoLimit: vi.fn(),
}));

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/platform/prisma";
import { createOrg as createOrgService } from "@/lib/services/orgs";
import { checkDemoLimit } from "@/lib/demo";
import { GET, POST } from "@/app/api/me/organizations/route";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockSession = (userId = "user-1", email = "user@example.com") =>
  vi.mocked(auth).mockResolvedValue({
    user: { id: userId, email },
  } as any);

const noSession = () => vi.mocked(auth).mockResolvedValue(null as any);

function createJsonPostRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/me/organizations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(checkDemoLimit).mockResolvedValue({ ok: true } as any);
});

// ─── GET /api/me/organizations ────────────────────────────────────────────────

describe("GET /api/me/organizations", () => {
  it("returns empty result when no session is present", async () => {
    noSession();

    const req = new Request("http://localhost:3000/api/me/organizations");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.organizations).toEqual([]);
    expect(data.totalCount).toBe(0);
  });

  it("returns paginated organizations for authenticated user", async () => {
    mockSession("user-1");
    vi.mocked(prisma.membership.count).mockResolvedValue(1);
    vi.mocked(prisma.membership.findMany).mockResolvedValue([
      {
        organization: { id: "org-1", name: "Downtown Doughnuts", image: "orgs/downtown.jpg" },
      },
    ] as any);

    const req = new Request("http://localhost:3000/api/me/organizations");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.organizations).toEqual([
      {
        id: "org-1",
        name: "Downtown Doughnuts",
        image: "https://cdn.example.com/orgs/downtown.jpg",
      },
    ]);
    expect(data.totalCount).toBe(1);
  });
});

// ─── POST /api/me/organizations ───────────────────────────────────────────────

describe("POST /api/me/organizations", () => {
  it("returns 401 Unauthorized when no session is present", async () => {
    noSession();

    const req = createJsonPostRequest({ title: "Acme Org" });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
    expect(createOrgService).not.toHaveBeenCalled();
  });

  it("returns 429 when demo limit is reached", async () => {
    mockSession("user-1");
    vi.mocked(checkDemoLimit).mockResolvedValue({
      ok: false,
      error: "Demo organization limit reached.",
    } as any);

    const req = createJsonPostRequest({ title: "Acme Org" });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(data.error).toBe("Demo organization limit reached.");
    expect(createOrgService).not.toHaveBeenCalled();
  });

  it("returns 400 when request body is malformed JSON", async () => {
    mockSession("user-1");

    const req = new Request("http://localhost:3000/api/me/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-a-json",
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Malformed JSON body.");
    expect(createOrgService).not.toHaveBeenCalled();
  });

  it("returns 400 when validation fails for empty title", async () => {
    mockSession("user-1");

    const req = createJsonPostRequest({ title: "" });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Validation failed");
    expect(data.errors).toBeDefined();
    expect(createOrgService).not.toHaveBeenCalled();
  });

  it("returns 400 when open time is after close time", async () => {
    mockSession("user-1");

    const req = createJsonPostRequest({
      title: "Acme Org",
      openTimeMin: 1000,
      closeTimeMin: 500,
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Validation failed");
    expect(createOrgService).not.toHaveBeenCalled();
  });

  it("creates organization and returns 201 with formatted organization data", async () => {
    mockSession("user-1", "test@example.com");
    vi.mocked(createOrgService).mockResolvedValue({
      org: {
        id: "org-new",
        name: "Acme Org",
        timezone: "Australia/Sydney",
        address: "123 Test St",
        operatingDays: ["mon", "tue", "wed"],
        openTimeMin: 480,
        closeTimeMin: 1020,
        image: "orgs/acme.png",
      } as any,
      ownerRole: {} as any,
      memberRole: {} as any,
      membership: {} as any,
    });

    const req = createJsonPostRequest({
      title: "Acme Org",
      timezone: "Australia/Sydney",
      address: "123 Test St",
      operatingDays: ["mon", "tue", "wed"],
      openTimeMin: 480,
      closeTimeMin: 1020,
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.organization).toEqual({
      id: "org-new",
      name: "Acme Org",
      timezone: "Australia/Sydney",
      address: "123 Test St",
      operatingDays: ["mon", "tue", "wed"],
      openTimeMin: 480,
      closeTimeMin: 1020,
      image: "https://cdn.example.com/orgs/acme.png",
    });
    expect(createOrgService).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ title: "Acme Org" }),
      "test@example.com",
    );
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("returns 500 when service layer throws an unexpected error", async () => {
    mockSession("user-1");
    vi.mocked(createOrgService).mockRejectedValue(new Error("Database write error"));

    const req = createJsonPostRequest({ title: "Acme Org" });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("Database write error");
  });
});
