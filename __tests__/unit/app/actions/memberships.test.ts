import { describe, it, expect, vi, beforeEach } from "vitest";
import { PermissionAction } from "@prisma/client";

// ─── Mock modules ─────────────────────────────────────────────────────────────

vi.mock("@/lib/authz", () => ({ requireOrgPermissionAction: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    role: { findFirst: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/services/memberships", () => ({
  deleteMembership: vi.fn(),
  updateMembership: vi.fn(),
  setMembershipStatus: vi.fn(),
}));
vi.mock("@/lib/services/invites", () => ({
  createMemberInvite: vi.fn(),
}));

import { requireOrgPermissionAction } from "@/lib/authz";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  deleteMembership as deleteMembershipService,
  updateMembership as updateMembershipService,
  setMembershipStatus as setMembershipStatusService,
} from "@/lib/services/memberships";
import { createMemberInvite } from "@/lib/services/invites";
import {
  sendMemberInviteAction,
  deleteMembershipAction,
  updateMembershipAction,
  setMemberStatusAction,
} from "@/app/actions/memberships";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const authorised = {
  ok: true as const,
  userId: "u-1",
  membership: { id: "m-1" } as any,
};
const unauthorised = { ok: false as const };

beforeEach(() => vi.clearAllMocks());

// ─── sendMemberInviteAction ───────────────────────────────────────────────────

describe("sendMemberInviteAction", () => {
  beforeEach(() => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "u-1" } } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-rec",
    } as any);
    vi.mocked(createMemberInvite).mockResolvedValue({ ok: true, data: null });
  });

  it("returns unauthorized when permission check fails", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(unauthorised);

    const result = await sendMemberInviteAction("org-1", {
      email: "a@b.com",
      roleIds: [],
      workingDays: [],
    });

    expect(result).toEqual({ ok: false, error: "Unauthorized" });
  });

  it("returns field error for invalid email", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);

    const result = await sendMemberInviteAction("org-1", {
      email: "not-valid",
      roleIds: [],
      workingDays: [],
    });

    expect(result.ok).toBe(false);
    expect((result as any).field).toBe("email");
  });

  it("returns error when no user found with that email", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const result = await sendMemberInviteAction("org-1", {
      email: "unknown@example.com",
      roleIds: ["crole00001"],
      workingDays: [],
    });

    expect(result).toMatchObject({ ok: false, field: "email" });
  });

  it("falls back to default role when roleIds is empty", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(prisma.role.findFirst).mockResolvedValue({
      id: "role-default",
    } as any);

    await sendMemberInviteAction("org-1", {
      email: "user@example.com",
      roleIds: [],
      workingDays: [],
    });

    expect(createMemberInvite).toHaveBeenCalledWith(
      "org-1",
      "u-1",
      "user-rec",
      ["role-default"],
      [],
    );
  });

  it("sends invite with specified roles and revalidates on success", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);

    const result = await sendMemberInviteAction("org-1", {
      email: "user@example.com",
      roleIds: ["crole00001"],
      workingDays: ["mon"],
    });

    expect(result).toEqual({ ok: true });
    expect(createMemberInvite).toHaveBeenCalledWith(
      "org-1",
      "u-1",
      "user-rec",
      ["crole00001"],
      ["mon"],
    );
    expect(revalidatePath).toHaveBeenCalled();
  });

  it("normalizes email to lowercase before lookup", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);

    await sendMemberInviteAction("org-1", {
      email: "User@Example.COM",
      roleIds: ["crole00001"],
      workingDays: [],
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "user@example.com" } }),
    );
  });

  it("propagates service CONFLICT error with email field", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(createMemberInvite).mockResolvedValue({
      ok: false,
      error: "This user already has a pending invite",
      code: "CONFLICT",
    });

    const result = await sendMemberInviteAction("org-1", {
      email: "user@example.com",
      roleIds: ["crole00001"],
      workingDays: [],
    });

    expect(result).toMatchObject({ ok: false, field: "email" });
  });
});

// ─── deleteMembershipAction ───────────────────────────────────────────────────

describe("deleteMembershipAction", () => {
  it("returns unauthorized when permission check fails", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(unauthorised);

    const result = await deleteMembershipAction("org-1", "mem-1");

    expect(result).toEqual({ ok: false, error: "Unauthorized" });
  });

  it("deletes membership and revalidates on success", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(deleteMembershipService).mockResolvedValue({
      ok: true,
      data: null,
    });

    const result = await deleteMembershipAction("org-1", "mem-1");

    expect(result).toEqual({ ok: true });
    expect(deleteMembershipService).toHaveBeenCalledWith("org-1", "mem-1", "u-1");
    expect(revalidatePath).toHaveBeenCalled();
  });

  it("propagates service NOT_FOUND error", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(deleteMembershipService).mockResolvedValue({
      ok: false,
      error: "Membership not found",
      code: "NOT_FOUND",
    });

    const result = await deleteMembershipAction("org-1", "mem-bad");

    expect(result).toEqual({ ok: false, error: "Membership not found" });
  });
});

// ─── updateMembershipAction ───────────────────────────────────────────────────

describe("updateMembershipAction", () => {
  const updateData = { workingDays: ["MON"], roleIds: ["role-1"] };

  it("returns unauthorized when permission check fails", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(unauthorised);

    const result = await updateMembershipAction("org-1", "mem-1", updateData);

    expect(result).toEqual({ ok: false, error: "Unauthorized" });
  });

  it("updates membership and revalidates both paths on success", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(updateMembershipService).mockResolvedValue({
      ok: true,
      data: null,
    });

    const result = await updateMembershipAction("org-1", "mem-1", updateData);

    expect(result).toEqual({ ok: true });
    expect(updateMembershipService).toHaveBeenCalledWith(
      "org-1",
      "mem-1",
      updateData,
      "u-1",
    );
    expect(revalidatePath).toHaveBeenCalledTimes(2);
  });

  it("propagates service INVALID error", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(updateMembershipService).mockResolvedValue({
      ok: false,
      error: "At least one role is required",
      code: "INVALID",
    });

    const result = await updateMembershipAction("org-1", "mem-1", {
      workingDays: [],
      roleIds: [],
    });

    expect(result).toEqual({
      ok: false,
      error: "At least one role is required",
    });
  });
});

// ─── setMemberStatusAction ────────────────────────────────────────────────────

describe("setMemberStatusAction", () => {
  it("returns unauthorized when permission check fails", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(unauthorised);

    const result = await setMemberStatusAction("org-1", "mem-1", "RESTRICTED");

    expect(result).toEqual({ ok: false, error: "Unauthorized" });
  });

  it("sets member status and revalidates both paths on success", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(setMembershipStatusService).mockResolvedValue({
      ok: true,
      data: null,
    });

    const result = await setMemberStatusAction("org-1", "mem-1", "RESTRICTED");

    expect(result).toEqual({ ok: true });
    expect(setMembershipStatusService).toHaveBeenCalledWith(
      "org-1",
      "mem-1",
      "RESTRICTED",
      "u-1",
    );
    expect(revalidatePath).toHaveBeenCalledTimes(2);
  });

  it("propagates service NOT_FOUND error", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(setMembershipStatusService).mockResolvedValue({
      ok: false,
      error: "Membership not found",
      code: "NOT_FOUND",
    });

    const result = await setMemberStatusAction("org-1", "mem-bad", "ACTIVE");

    expect(result).toEqual({ ok: false, error: "Membership not found" });
  });
});
