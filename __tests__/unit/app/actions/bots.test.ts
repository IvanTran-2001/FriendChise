import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock modules ─────────────────────────────────────────────────────────────

vi.mock("@/lib/authz", () => ({ requireOrgPermissionAction: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    role: { findFirst: vi.fn() },
    membership: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/services/bots", () => ({
  createBot: vi.fn(),
  deleteBot: vi.fn(),
  memberToBot: vi.fn(),
  updateBot: vi.fn(),
}));
vi.mock("@/lib/services/invites", () => ({
  createMemberInvite: vi.fn(),
}));

import { requireOrgPermissionAction } from "@/lib/authz";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  createBot as createBotService,
  deleteBot as deleteBotService,
  memberToBot as memberToBotService,
  updateBot as updateBotService,
} from "@/lib/services/bots";
import { createMemberInvite } from "@/lib/services/invites";
import {
  createBotAction,
  deleteBotAction,
  memberToBotAction,
  inviteBotSlotAction,
  updateBotAction,
} from "@/app/actions/bots";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const authorised = {
  ok: true as const,
  userId: "u-1",
  membership: { id: "m-1" } as any,
};
const unauthorised = { ok: false as const };

beforeEach(() => vi.clearAllMocks());

// ─── createBotAction ──────────────────────────────────────────────────────────

describe("createBotAction", () => {
  it("returns unauthorized when permission check fails", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(unauthorised);

    const result = await createBotAction("org-1", {
      botName: "Bot",
      roleIds: [],
    });

    expect(result).toEqual({ ok: false, error: "Unauthorized" });
    expect(createBotService).not.toHaveBeenCalled();
  });

  it("returns validation error for invalid input", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);

    // botName is required
    const result = await createBotAction("org-1", { botName: "", roleIds: [] });

    expect(result.ok).toBe(false);
    expect(createBotService).not.toHaveBeenCalled();
  });

  it("falls back to default role when roleIds is empty", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(prisma.role.findFirst).mockResolvedValue({
      id: "role-default",
    } as any);
    vi.mocked(createBotService).mockResolvedValue({
      ok: true,
      data: {} as any,
    });

    const result = await createBotAction("org-1", {
      botName: "Bot",
      roleIds: [],
    });

    expect(result).toEqual({ ok: true });
    expect(createBotService).toHaveBeenCalledWith(
      "org-1",
      expect.objectContaining({ roleIds: ["role-default"] }),
    );
  });

  it("returns error when no default role exists", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(prisma.role.findFirst).mockResolvedValue(null);

    const result = await createBotAction("org-1", {
      botName: "Bot",
      roleIds: [],
    });

    expect(result).toEqual({
      ok: false,
      error: "No default role found for this org",
    });
  });

  it("calls service with provided roleIds and returns ok: true on success", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(createBotService).mockResolvedValue({
      ok: true,
      data: {} as any,
    });

    const result = await createBotAction("org-1", {
      botName: "Bot",
      roleIds: ["crole00001"],
    });

    expect(result).toEqual({ ok: true });
    expect(revalidatePath).toHaveBeenCalled();
  });

  it("propagates service errors", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(createBotService).mockResolvedValue({
      ok: false,
      error: "One or more roles not found or do not belong to this org",
      code: "INVALID",
    });

    const result = await createBotAction("org-1", {
      botName: "Bot",
      roleIds: ["crole00002"],
    });

    expect(result).toEqual({
      ok: false,
      error: "One or more roles not found or do not belong to this org",
    });
  });
});

// ─── deleteBotAction ──────────────────────────────────────────────────────────

describe("deleteBotAction", () => {
  it("returns unauthorized when permission check fails", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(unauthorised);

    const result = await deleteBotAction("org-1", "mem-bot");

    expect(result).toEqual({ ok: false, error: "Unauthorized" });
  });

  it("deletes the bot and revalidates the path", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(deleteBotService).mockResolvedValue({ ok: true, data: null });

    const result = await deleteBotAction("org-1", "mem-bot");

    expect(result).toEqual({ ok: true });
    expect(deleteBotService).toHaveBeenCalledWith("org-1", "mem-bot");
    expect(revalidatePath).toHaveBeenCalled();
  });

  it("propagates service NOT_FOUND error", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(deleteBotService).mockResolvedValue({
      ok: false,
      error: "Bot not found",
      code: "NOT_FOUND",
    });

    const result = await deleteBotAction("org-1", "mem-bad");

    expect(result).toEqual({ ok: false, error: "Bot not found" });
  });
});

// ─── memberToBotAction ────────────────────────────────────────────────────────

describe("memberToBotAction", () => {
  it("returns unauthorized when permission check fails", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(unauthorised);

    const result = await memberToBotAction("org-1", { membershipId: "mem-1" });

    expect(result).toEqual({ ok: false, error: "Unauthorized" });
  });

  it("returns validation error for invalid input", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);

    const result = await memberToBotAction("org-1", {});

    expect(result.ok).toBe(false);
    expect(memberToBotService).not.toHaveBeenCalled();
  });

  it("converts member to bot and revalidates path on success", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(memberToBotService).mockResolvedValue({
      ok: true,
      data: {} as any,
    });

    const result = await memberToBotAction("org-1", {
      membershipId: "cmem000001",
    });

    expect(result).toEqual({ ok: true });
    expect(revalidatePath).toHaveBeenCalled();
  });
});

// ─── inviteBotSlotAction ──────────────────────────────────────────────────────

describe("inviteBotSlotAction", () => {
  beforeEach(() => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "u-1" } } as any);
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({
      id: "mem-bot",
      userId: null,
      memberRoles: [{ roleId: "role-1" }],
      workingDays: ["MON"],
    } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-rec",
    } as any);
    vi.mocked(createMemberInvite).mockResolvedValue({ ok: true, data: null });
  });

  it("returns unauthorized when permission check fails", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(unauthorised);

    const result = await inviteBotSlotAction("org-1", "mem-bot", {
      email: "a@b.com",
    });

    expect(result).toEqual({ ok: false, error: "Unauthorized" });
  });

  it("returns validation error for invalid email", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);

    const result = await inviteBotSlotAction("org-1", "mem-bot", {
      email: "not-an-email",
    });

    expect(result.ok).toBe(false);
  });

  it("returns error when bot membership not found", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(prisma.membership.findUnique).mockResolvedValue(null);

    const result = await inviteBotSlotAction("org-1", "mem-bot", {
      email: "user@example.com",
    });

    expect(result).toEqual({ ok: false, error: "Membership not found" });
  });

  it("returns error when slot is already a real user", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({
      id: "mem-bot",
      userId: "real-user",
      memberRoles: [],
      workingDays: [],
    } as any);

    const result = await inviteBotSlotAction("org-1", "mem-bot", {
      email: "user@example.com",
    });

    expect(result).toEqual({
      ok: false,
      error: "This slot already belongs to a real user",
    });
  });

  it("returns error when no account found for email", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const result = await inviteBotSlotAction("org-1", "mem-bot", {
      email: "unknown@example.com",
    });

    expect(result).toEqual({
      ok: false,
      error: "No account found with that email address",
    });
  });

  it("creates a member invite with the bot slot and returns ok: true", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);

    const result = await inviteBotSlotAction("org-1", "mem-bot", {
      email: "user@example.com",
    });

    expect(result).toEqual({ ok: true });
    expect(createMemberInvite).toHaveBeenCalledWith(
      "org-1",
      "u-1",
      "user-rec",
      ["role-1"],
      ["MON"],
      "mem-bot",
    );
    expect(revalidatePath).toHaveBeenCalled();
  });
});

// ─── updateBotAction ──────────────────────────────────────────────────────────

describe("updateBotAction", () => {
  const validData = {
    botName: "Updated",
    workingDays: ["tue"],
    roleIds: ["crole00001"],
  };

  it("returns unauthorized when permission check fails", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(unauthorised);

    const result = await updateBotAction("org-1", "mem-bot", validData);

    expect(result).toEqual({ ok: false, error: "Unauthorized" });
  });

  it("returns validation error for invalid input", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);

    const result = await updateBotAction("org-1", "mem-bot", {
      botName: "",
      roleIds: [],
    });

    expect(result.ok).toBe(false);
  });

  it("updates bot and revalidates paths on success", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(updateBotService).mockResolvedValue({ ok: true, data: null });

    const result = await updateBotAction("org-1", "mem-bot", validData);

    expect(result).toEqual({ ok: true });
    expect(updateBotService).toHaveBeenCalledWith(
      "org-1",
      "mem-bot",
      expect.objectContaining(validData),
    );
    expect(revalidatePath).toHaveBeenCalledTimes(2);
  });

  it("propagates service errors", async () => {
    vi.mocked(requireOrgPermissionAction).mockResolvedValue(authorised);
    vi.mocked(updateBotService).mockResolvedValue({
      ok: false,
      error: "Bot not found",
      code: "NOT_FOUND",
    });

    const result = await updateBotAction("org-1", "mem-bot", validData);

    expect(result).toEqual({ ok: false, error: "Bot not found" });
  });
});
