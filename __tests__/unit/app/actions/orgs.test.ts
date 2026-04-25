import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock modules ─────────────────────────────────────────────────────────────

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => { throw new Error("NEXT_REDIRECT"); }),
}));
vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));
vi.mock("@/lib/services/orgs", () => ({
  createOrg: vi.fn(),
  joinFranchise: vi.fn(),
  updateOrgSettings: vi.fn(),
  transferOrgOwnership: vi.fn(),
  deleteOrg: vi.fn(),
}));

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  createOrg as createOrgService,
  joinFranchise as joinFranchiseService,
} from "@/lib/services/orgs";
import {
  createOrg,
  joinFranchise,
} from "@/app/actions/orgs";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockSession = (userId: string, email = "user@example.com") =>
  vi.mocked(auth).mockResolvedValue({
    user: { id: userId, email },
  } as any);

const noSession = () => vi.mocked(auth).mockResolvedValue(null as any);

beforeEach(() => vi.clearAllMocks());

// ─── createOrg ────────────────────────────────────────────────────────────────

describe("createOrg", () => {
  it("returns unauthorized when no session", async () => {
    noSession();

    const result = await createOrg({ title: "Acme" });

    expect(result).toEqual({ ok: false, error: "Unauthorized" });
    expect(createOrgService).not.toHaveBeenCalled();
  });

  it("returns validation failed for invalid input", async () => {
    mockSession("user-1");

    const result = await createOrg({ title: "" });

    expect(result).toEqual({ ok: false, error: "Validation failed" });
    expect(createOrgService).not.toHaveBeenCalled();
  });

  it("calls createOrg service with parsed data and returns orgId", async () => {
    mockSession("user-1");
    vi.mocked(createOrgService).mockResolvedValue({
      org: { id: "org-new" },
    } as any);

    const result = await createOrg({ title: "Acme Café" });

    expect(result).toEqual({ ok: true, orgId: "org-new" });
    expect(createOrgService).toHaveBeenCalledWith("user-1", expect.objectContaining({ title: "Acme Café" }));
  });

  it("revalidates the layout after successful create", async () => {
    mockSession("user-1");
    vi.mocked(createOrgService).mockResolvedValue({ org: { id: "org-new" } } as any);

    await createOrg({ title: "Acme" });

    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("accepts valid schedule fields alongside title", async () => {
    mockSession("user-1");
    vi.mocked(createOrgService).mockResolvedValue({ org: { id: "org-2" } } as any);

    const result = await createOrg({
      title: "Acme",
      timezone: "Australia/Sydney",
      openTimeMin: 480,
      closeTimeMin: 1020,
    });

    expect(result).toEqual({ ok: true, orgId: "org-2" });
  });
});

// ─── joinFranchise ────────────────────────────────────────────────────────────

describe("joinFranchise", () => {
  it("returns unauthorized when no session", async () => {
    noSession();

    const result = await joinFranchise({ token: "tok-123" });

    expect(result).toEqual({ ok: false, error: "Unauthorized" });
    expect(joinFranchiseService).not.toHaveBeenCalled();
  });

  it("returns validation failed for missing token", async () => {
    mockSession("user-1");

    const result = await joinFranchise({ token: "" });

    expect(result).toEqual({ ok: false, error: "Validation failed" });
    expect(joinFranchiseService).not.toHaveBeenCalled();
  });

  it("calls joinFranchise service and returns orgId on success", async () => {
    mockSession("user-1", "alice@example.com");
    vi.mocked(joinFranchiseService).mockResolvedValue({ org: { id: "child-org" } } as any);

    const result = await joinFranchise({ token: "tok-valid" });

    expect(result).toEqual({ ok: true, orgId: "child-org" });
    expect(joinFranchiseService).toHaveBeenCalledWith(
      "user-1",
      "alice@example.com",
      expect.objectContaining({ token: "tok-valid" }),
    );
  });

  it("returns error message when service throws", async () => {
    mockSession("user-1");
    vi.mocked(joinFranchiseService).mockRejectedValue(new Error("Token has expired"));

    const result = await joinFranchise({ token: "tok-expired" });

    expect(result).toEqual({ ok: false, error: "Token has expired" });
  });

  it("returns generic error message when service throws non-Error", async () => {
    mockSession("user-1");
    vi.mocked(joinFranchiseService).mockRejectedValue("something bad");

    const result = await joinFranchise({ token: "tok-bad" });

    expect(result).toEqual({ ok: false, error: "Failed to join franchise" });
  });

  it("revalidates the layout after successful join", async () => {
    mockSession("user-1");
    vi.mocked(joinFranchiseService).mockResolvedValue({ org: { id: "child-org" } } as any);

    await joinFranchise({ token: "tok-valid" });

    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });
});
