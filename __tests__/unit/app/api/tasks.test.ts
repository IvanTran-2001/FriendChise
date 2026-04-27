import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

// ─── Mock modules ─────────────────────────────────────────────────────────────

vi.mock("@/lib/authz", () => ({
  requireOrgPermission: vi.fn(),
  requireOrgMember: vi.fn(),
}));
vi.mock("@/lib/services/tasks", () => ({
  createTask: vi.fn(),
  deleteTask: vi.fn(),
  getTasks: vi.fn(),
}));

import { requireOrgPermission, requireOrgMember } from "@/lib/authz";
import { createTask, deleteTask, getTasks } from "@/lib/services/tasks";
import { POST, DELETE, GET } from "@/app/api/orgs/[orgId]/tasks/route";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeReq = (method: string, body?: unknown) =>
  new Request("http://localhost/api/orgs/org-1/tasks", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

const params = Promise.resolve({ orgId: "org-1" });

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

// ─── POST /api/orgs/[orgId]/tasks ─────────────────────────────────────────────

describe("POST /api/orgs/[orgId]/tasks", () => {
  it("returns 403 when permission check fails", async () => {
    vi.mocked(requireOrgPermission).mockResolvedValue(forbidden);

    const res = await POST(
      makeReq("POST", { title: "Task A", durationMin: 30, color: "#6366f1" }),
      { params },
    );

    expect(res.status).toBe(403);
  });

  it("returns 400 on invalid JSON body", async () => {
    vi.mocked(requireOrgPermission).mockResolvedValue(permitted);

    const req = new Request("http://localhost/api/orgs/org-1/tasks", {
      method: "POST",
      body: "{bad-json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, { params });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid JSON body");
  });

  it("returns 400 with issues when validation fails", async () => {
    vi.mocked(requireOrgPermission).mockResolvedValue(permitted);

    // Missing required fields
    const res = await POST(makeReq("POST", { color: "#6366f1" }), { params });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Validation failed");
  });

  it("calls createTask and returns 201 on success", async () => {
    vi.mocked(requireOrgPermission).mockResolvedValue(permitted);
    const task = { id: "task-1", name: "Task A" };
    vi.mocked(createTask).mockResolvedValue(task as any);

    const res = await POST(
      makeReq("POST", {
        title: "Task A",
        durationMin: 30,
        color: "#6366f1",
        minWaitDays: 7,
      }),
      { params },
    );

    expect(res.status).toBe(201);
    expect(createTask).toHaveBeenCalledWith(
      "org-1",
      expect.objectContaining({ title: "Task A" }),
    );
    const body = await res.json();
    expect(body).toMatchObject({ id: "task-1" });
  });
});

// ─── DELETE /api/orgs/[orgId]/tasks ───────────────────────────────────────────

describe("DELETE /api/orgs/[orgId]/tasks", () => {
  it("returns 403 when permission check fails", async () => {
    vi.mocked(requireOrgPermission).mockResolvedValue(forbidden);

    const res = await DELETE(makeReq("DELETE", { id: "task-1" }), { params });

    expect(res.status).toBe(403);
  });

  it("returns 400 on validation failure (missing id)", async () => {
    vi.mocked(requireOrgPermission).mockResolvedValue(permitted);

    const res = await DELETE(makeReq("DELETE", {}), { params });

    expect(res.status).toBe(400);
  });

  it("returns 404 when task not found", async () => {
    vi.mocked(requireOrgPermission).mockResolvedValue(permitted);
    vi.mocked(deleteTask).mockResolvedValue({
      ok: false,
      error: "Task not found",
      code: "NOT_FOUND",
    });

    const res = await DELETE(makeReq("DELETE", { id: "task-bad" }), { params });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Task not found");
  });

  it("returns 200 with success message when task deleted", async () => {
    vi.mocked(requireOrgPermission).mockResolvedValue(permitted);
    vi.mocked(deleteTask).mockResolvedValue({ ok: true, data: null });

    const res = await DELETE(makeReq("DELETE", { id: "task-1" }), { params });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBeDefined();
  });
});

// ─── GET /api/orgs/[orgId]/tasks ──────────────────────────────────────────────

describe("GET /api/orgs/[orgId]/tasks", () => {
  it("returns 403 when not a member", async () => {
    vi.mocked(requireOrgMember).mockResolvedValue(forbidden);

    const res = await GET(makeReq("GET"), { params });

    expect(res.status).toBe(403);
  });

  it("returns tasks array on success", async () => {
    vi.mocked(requireOrgMember).mockResolvedValue(permitted);
    const tasks = [{ id: "task-1", name: "Task A" }];
    vi.mocked(getTasks).mockResolvedValue(tasks as any);

    const res = await GET(makeReq("GET"), { params });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(tasks);
    expect(getTasks).toHaveBeenCalledWith("org-1");
  });
});
