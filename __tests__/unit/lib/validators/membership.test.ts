import { describe, it, expect } from "vitest";
import {
  createMembershipSchema,
  deleteMembershipSchema,
  sendMemberInviteSchema,
} from "@/lib/validators/membership";

// A valid cuid for testing
const validCuid = "clh5z1a0o0000p1v8fq5xz3y4";
const validCuid2 = "clh5z1a0o0001p1v8fq5xz3y4";

// ─── createMembershipSchema ───────────────────────────────────────────────────

describe("createMembershipSchema", () => {
  it("accepts valid userId and roleId cuids", () => {
    const result = createMembershipSchema.safeParse({
      userId: validCuid,
      roleId: validCuid2,
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-cuid userId", () => {
    const result = createMembershipSchema.safeParse({
      userId: "not-a-cuid",
      roleId: validCuid,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-cuid roleId", () => {
    const result = createMembershipSchema.safeParse({
      userId: validCuid,
      roleId: "not-a-cuid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing userId", () => {
    const result = createMembershipSchema.safeParse({ roleId: validCuid });
    expect(result.success).toBe(false);
  });

  it("rejects missing roleId", () => {
    const result = createMembershipSchema.safeParse({ userId: validCuid });
    expect(result.success).toBe(false);
  });

  it("rejects empty object", () => {
    const result = createMembershipSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ─── deleteMembershipSchema ───────────────────────────────────────────────────

describe("deleteMembershipSchema", () => {
  it("accepts a valid membershipId cuid", () => {
    const result = deleteMembershipSchema.safeParse({ membershipId: validCuid });
    expect(result.success).toBe(true);
  });

  it("rejects non-cuid membershipId", () => {
    const result = deleteMembershipSchema.safeParse({ membershipId: "not-a-cuid" });
    expect(result.success).toBe(false);
  });

  it("rejects missing membershipId", () => {
    const result = deleteMembershipSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ─── sendMemberInviteSchema ───────────────────────────────────────────────────

describe("sendMemberInviteSchema", () => {
  it("accepts valid email with roleIds and workingDays", () => {
    const result = sendMemberInviteSchema.safeParse({
      email: "alice@example.com",
      roleIds: [validCuid],
      workingDays: ["mon", "wed", "fri"],
    });
    expect(result.success).toBe(true);
  });

  it("defaults roleIds to empty array when not provided", () => {
    const result = sendMemberInviteSchema.safeParse({
      email: "alice@example.com",
      workingDays: [],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.roleIds).toEqual([]);
  });

  it("accepts empty workingDays array", () => {
    const result = sendMemberInviteSchema.safeParse({
      email: "alice@example.com",
      workingDays: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = sendMemberInviteSchema.safeParse({
      email: "not-an-email",
      workingDays: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty email", () => {
    const result = sendMemberInviteSchema.safeParse({
      email: "",
      workingDays: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-cuid roleId values", () => {
    const result = sendMemberInviteSchema.safeParse({
      email: "alice@example.com",
      roleIds: ["not-a-cuid"],
      workingDays: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid working day key", () => {
    const result = sendMemberInviteSchema.safeParse({
      email: "alice@example.com",
      workingDays: ["monday"],
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid day keys", () => {
    const result = sendMemberInviteSchema.safeParse({
      email: "alice@example.com",
      workingDays: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing email field", () => {
    const result = sendMemberInviteSchema.safeParse({ workingDays: [] });
    expect(result.success).toBe(false);
  });
});
