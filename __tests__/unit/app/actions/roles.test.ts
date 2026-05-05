import { describe, it, expect, vi, beforeEach } from "vitest";
import { PermissionAction } from "@prisma/client";

// ─── Mock modules ─────────────────────────────────────────────────────────────

vi.mock("@/lib/authz", () => ({ requireOrgPermissionAction: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/services/roles", () => ({
  deleteRole: vi.fn(),
  createRole: vi.fn(),
  updateRole: vi.fn(),
}));

import { requireOrgPermissionAction } from "@/lib/authz";
import { revalidatePath } from "next/cache";
import {
  deleteRole as deleteRoleService,
  createRole as createRoleService,
  updateRole as updateRoleService,
} from "@/lib/services/roles";
import {
  deleteRoleAction,
  createRoleAction,
  updateRoleAction,
} from "@/app/actions/roles";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const authorised = {
  ok: true as const,
  userId: "u-1",
  userEmail: "user@example.com",
  membership: { id: "m-1" } as any,
};
const unauthorised = { ok: false as const };
const validRoleInput = {
  name: "Manager",
  color: "#3B82F6",
  permissions: [] as PermissionAction[],
  taskIds: [] as string[],
};

beforeEach(() => vi.clearAllMocks());

// ─── deleteRoleAction ─────────────────────────────────────────────────────────

describe("deleteRoleAction", () => {
  it("returns unauthorized when permission check fails", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(unauthorised);

    const result = await deleteRoleAction("org-1", "role-1");

    expect(result).toEqual({ ok: false, error: "Unauthorized." });
    expect(deleteRoleService).not.toHaveBeenCalled();
  });

  it("deletes role and revalidates on success", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(deleteRoleService).mockResolvedValue({ ok: true, data: null });

    const result = await deleteRoleAction("org-1", "role-1");

    expect(result).toEqual({ ok: true });
    expect(deleteRoleService).toHaveBeenCalledWith(
      "org-1",
      "role-1",
      "u-1",
      "user@example.com",
    );
    expect(revalidatePath).toHaveBeenCalled();
  });

  it("propagates service NOT_FOUND error", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(deleteRoleService).mockResolvedValue({
      ok: false,
      error: "Role not found.",
      code: "NOT_FOUND",
    });

    const result = await deleteRoleAction("org-1", "role-bad");

    expect(result).toEqual({ ok: false, error: "Role not found." });
  });

  it("propagates service INVALID error for system roles", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(deleteRoleService).mockResolvedValue({
      ok: false,
      error: "This role cannot be deleted.",
      code: "INVALID",
    });

    const result = await deleteRoleAction("org-1", "role-owner");

    expect(result).toEqual({
      ok: false,
      error: "This role cannot be deleted.",
    });
  });
});

// ─── createRoleAction ─────────────────────────────────────────────────────────

describe("createRoleAction", () => {
  it("returns unauthorized when permission check fails", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(unauthorised);

    const result = await createRoleAction("org-1", validRoleInput);

    expect(result).toEqual({ ok: false, error: "Unauthorized." });
  });

  it("returns validation error for invalid input", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);

    const result = await createRoleAction("org-1", {
      ...validRoleInput,
      name: "",
    });

    expect(result.ok).toBe(false);
    expect(createRoleService).not.toHaveBeenCalled();
  });

  it("creates role and revalidates on success", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(createRoleService).mockResolvedValue({
      ok: true,
      data: { id: "role-new" } as any,
    });

    const result = await createRoleAction("org-1", validRoleInput);

    expect(result).toEqual({ ok: true });
    expect(createRoleService).toHaveBeenCalledWith(
      "org-1",
      expect.objectContaining({ name: "Manager" }),
      "u-1",
      "user@example.com",
    );
    expect(revalidatePath).toHaveBeenCalled();
  });

  it("propagates service INVALID error", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(createRoleService).mockResolvedValue({
      ok: false,
      error: "One or more tasks are invalid for this organization.",
      code: "INVALID",
    });

    const result = await createRoleAction("org-1", validRoleInput);

    expect(result).toEqual({
      ok: false,
      error: "One or more tasks are invalid for this organization.",
    });
  });
});

// ─── updateRoleAction ─────────────────────────────────────────────────────────

describe("updateRoleAction", () => {
  it("returns unauthorized when permission check fails", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(unauthorised);

    const result = await updateRoleAction("org-1", "role-1", validRoleInput);

    expect(result).toEqual({ ok: false, error: "Unauthorized." });
  });

  it("returns validation error for invalid input", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);

    const result = await updateRoleAction("org-1", "role-1", {
      ...validRoleInput,
      name: "",
    });

    expect(result.ok).toBe(false);
    expect(updateRoleService).not.toHaveBeenCalled();
  });

  it("updates role and revalidates on success", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(updateRoleService).mockResolvedValue({
      ok: true,
      data: {} as any,
    });

    const result = await updateRoleAction("org-1", "role-1", validRoleInput);

    expect(result).toEqual({ ok: true });
    expect(updateRoleService).toHaveBeenCalledWith(
      "org-1",
      "role-1",
      expect.objectContaining({ name: "Manager" }),
      "u-1",
      "user@example.com",
    );
    expect(revalidatePath).toHaveBeenCalled();
  });

  it("propagates service INVALID error for owner role edit", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(updateRoleService).mockResolvedValue({
      ok: false,
      error: "The Owner role cannot be edited.",
      code: "INVALID",
    });

    const result = await updateRoleAction(
      "org-1",
      "role-owner",
      validRoleInput,
    );

    expect(result).toEqual({
      ok: false,
      error: "The Owner role cannot be edited.",
    });
  });
});
