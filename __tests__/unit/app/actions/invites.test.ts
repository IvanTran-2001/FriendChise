import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock modules ─────────────────────────────────────────────────────────────

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/services/invites", () => ({
  markInvitesSeen: vi.fn(),
  markNotificationsSeen: vi.fn(),
  acceptMemberInvite: vi.fn(),
  declineMemberInvite: vi.fn(),
  acceptBotSlotInvite: vi.fn(),
  declineBotSlotInvite: vi.fn(),
  declineFranchiseInvite: vi.fn(),
}));

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  markInvitesSeen as markInvitesSeenService,
  markNotificationsSeen as markNotificationsSeenService,
  acceptMemberInvite as acceptMemberInviteService,
  declineMemberInvite as declineMemberInviteService,
  acceptBotSlotInvite as acceptBotSlotInviteService,
  declineBotSlotInvite as declineBotSlotInviteService,
  declineFranchiseInvite as declineFranchiseInviteService,
} from "@/lib/services/invites";
import {
  markInvitesSeenAction,
  acceptMemberInviteAction,
  declineMemberInviteAction,
  acceptBotSlotInviteAction,
  declineBotSlotInviteAction,
  declineFranchiseInviteAction,
} from "@/app/actions/invites";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockSession = (userId = "user-1") =>
  vi.mocked(auth).mockResolvedValue({ user: { id: userId } } as any);

const noSession = () => vi.mocked(auth).mockResolvedValue(null as any);

beforeEach(() => vi.clearAllMocks());

// ─── markInvitesSeenAction ────────────────────────────────────────────────────

describe("markInvitesSeenAction", () => {
  it("marks both invites and notifications seen for the current user", async () => {
    mockSession();

    await markInvitesSeenAction();

    expect(markInvitesSeenService).toHaveBeenCalledWith("user-1");
    expect(markNotificationsSeenService).toHaveBeenCalledWith("user-1");
  });

  it("does nothing when no session exists", async () => {
    noSession();

    await markInvitesSeenAction();

    expect(markInvitesSeenService).not.toHaveBeenCalled();
    expect(markNotificationsSeenService).not.toHaveBeenCalled();
  });
});

// ─── acceptMemberInviteAction ─────────────────────────────────────────────────

describe("acceptMemberInviteAction", () => {
  it("returns unauthorized when no session", async () => {
    noSession();

    const result = await acceptMemberInviteAction("inv-1");

    expect(result).toEqual({ ok: false, error: "Unauthorized" });
    expect(acceptMemberInviteService).not.toHaveBeenCalled();
  });

  it("calls service and revalidates root on success", async () => {
    mockSession();
    vi.mocked(acceptMemberInviteService).mockResolvedValue({ ok: true, data: null });

    const result = await acceptMemberInviteAction("inv-1");

    expect(result).toEqual({ ok: true });
    expect(acceptMemberInviteService).toHaveBeenCalledWith("inv-1", "user-1");
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("propagates service error without revalidating", async () => {
    mockSession();
    vi.mocked(acceptMemberInviteService).mockResolvedValue({
      ok: false,
      error: "Invite not found",
      code: "NOT_FOUND",
    });

    const result = await acceptMemberInviteAction("inv-bad");

    expect(result).toEqual({ ok: false, error: "Invite not found" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

// ─── declineMemberInviteAction ────────────────────────────────────────────────

describe("declineMemberInviteAction", () => {
  it("returns unauthorized when no session", async () => {
    noSession();

    const result = await declineMemberInviteAction("inv-1");

    expect(result).toEqual({ ok: false, error: "Unauthorized" });
  });

  it("declines invite and revalidates root on success", async () => {
    mockSession();
    vi.mocked(declineMemberInviteService).mockResolvedValue({ ok: true, data: null });

    const result = await declineMemberInviteAction("inv-1");

    expect(result).toEqual({ ok: true });
    expect(declineMemberInviteService).toHaveBeenCalledWith("inv-1", "user-1");
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("propagates service error", async () => {
    mockSession();
    vi.mocked(declineMemberInviteService).mockResolvedValue({
      ok: false,
      error: "Invite not found or already handled",
      code: "NOT_FOUND",
    });

    const result = await declineMemberInviteAction("inv-bad");

    expect(result).toEqual({ ok: false, error: "Invite not found or already handled" });
  });
});

// ─── acceptBotSlotInviteAction ────────────────────────────────────────────────

describe("acceptBotSlotInviteAction", () => {
  it("returns unauthorized when no session", async () => {
    noSession();

    const result = await acceptBotSlotInviteAction("inv-1");

    expect(result).toEqual({ ok: false, error: "Unauthorized" });
  });

  it("accepts bot slot invite and revalidates root on success", async () => {
    mockSession();
    vi.mocked(acceptBotSlotInviteService).mockResolvedValue({ ok: true, data: null });

    const result = await acceptBotSlotInviteAction("inv-bot");

    expect(result).toEqual({ ok: true });
    expect(acceptBotSlotInviteService).toHaveBeenCalledWith("inv-bot", "user-1");
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("propagates service CONFLICT error", async () => {
    mockSession();
    vi.mocked(acceptBotSlotInviteService).mockResolvedValue({
      ok: false,
      error: "The bot slot was already filled by another user",
      code: "CONFLICT",
    });

    const result = await acceptBotSlotInviteAction("inv-bot");

    expect(result).toEqual({ ok: false, error: "The bot slot was already filled by another user" });
  });
});

// ─── declineBotSlotInviteAction ───────────────────────────────────────────────

describe("declineBotSlotInviteAction", () => {
  it("returns unauthorized when no session", async () => {
    noSession();

    const result = await declineBotSlotInviteAction("inv-1");

    expect(result).toEqual({ ok: false, error: "Unauthorized" });
  });

  it("declines bot slot invite and revalidates root on success", async () => {
    mockSession();
    vi.mocked(declineBotSlotInviteService).mockResolvedValue({ ok: true, data: null });

    const result = await declineBotSlotInviteAction("inv-bot");

    expect(result).toEqual({ ok: true });
    expect(declineBotSlotInviteService).toHaveBeenCalledWith("inv-bot", "user-1");
  });
});

// ─── declineFranchiseInviteAction ─────────────────────────────────────────────

describe("declineFranchiseInviteAction", () => {
  it("returns unauthorized when no session", async () => {
    noSession();

    const result = await declineFranchiseInviteAction("inv-1");

    expect(result).toEqual({ ok: false, error: "Unauthorized" });
  });

  it("declines franchise invite and revalidates root on success", async () => {
    mockSession();
    vi.mocked(declineFranchiseInviteService).mockResolvedValue({ ok: true, data: null });

    const result = await declineFranchiseInviteAction("inv-fr");

    expect(result).toEqual({ ok: true });
    expect(declineFranchiseInviteService).toHaveBeenCalledWith("inv-fr", "user-1");
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("propagates service CONFLICT error", async () => {
    mockSession();
    vi.mocked(declineFranchiseInviteService).mockResolvedValue({
      ok: false,
      error: "This invite has already been handled",
      code: "CONFLICT",
    });

    const result = await declineFranchiseInviteAction("inv-fr");

    expect(result).toEqual({ ok: false, error: "This invite has already been handled" });
  });
});
