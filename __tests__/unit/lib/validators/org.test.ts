import { describe, it, expect } from "vitest";
import {
  createOrgSchema,
  joinFranchiseSchema,
  DAY_VALUES,
} from "@/lib/validators/org";

// ─── DAY_VALUES ───────────────────────────────────────────────────────────────

describe("DAY_VALUES", () => {
  it("contains all seven days in order", () => {
    expect(DAY_VALUES).toEqual(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
  });
});

// ─── createOrgSchema ──────────────────────────────────────────────────────────

describe("createOrgSchema", () => {
  it("accepts a minimal valid title", () => {
    const result = createOrgSchema.safeParse({ title: "Acme Café" });
    expect(result.success).toBe(true);
  });

  it("accepts all optional schedule fields", () => {
    const result = createOrgSchema.safeParse({
      title: "Acme",
      timezone: "Australia/Sydney",
      address: "123 Main St",
      operatingDays: ["mon", "tue", "wed"],
      openTimeMin: 480,
      closeTimeMin: 1020,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty title", () => {
    const result = createOrgSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects title that is just whitespace", () => {
    const result = createOrgSchema.safeParse({ title: "   " });
    expect(result.success).toBe(false);
  });

  it("rejects title longer than 200 characters", () => {
    const result = createOrgSchema.safeParse({ title: "A".repeat(201) });
    expect(result.success).toBe(false);
  });

  it("accepts title of exactly 200 characters", () => {
    const result = createOrgSchema.safeParse({ title: "A".repeat(200) });
    expect(result.success).toBe(true);
  });

  it("trims whitespace from title", () => {
    const result = createOrgSchema.safeParse({ title: "  Acme  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.title).toBe("Acme");
  });

  it("rejects invalid day keys in operatingDays", () => {
    const result = createOrgSchema.safeParse({
      title: "Acme",
      operatingDays: ["mon", "invalid"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects openTimeMin greater than or equal to closeTimeMin", () => {
    const result = createOrgSchema.safeParse({
      title: "Acme",
      openTimeMin: 1020,
      closeTimeMin: 480,
    });
    expect(result.success).toBe(false);
  });

  it("rejects equal openTimeMin and closeTimeMin", () => {
    const result = createOrgSchema.safeParse({
      title: "Acme",
      openTimeMin: 480,
      closeTimeMin: 480,
    });
    expect(result.success).toBe(false);
  });

  it("allows only openTimeMin without closeTimeMin (no comparison possible)", () => {
    const result = createOrgSchema.safeParse({
      title: "Acme",
      openTimeMin: 480,
    });
    expect(result.success).toBe(true);
  });

  it("rejects openTimeMin out of range (>1439)", () => {
    const result = createOrgSchema.safeParse({
      title: "Acme",
      openTimeMin: 1440,
    });
    expect(result.success).toBe(false);
  });

  it("rejects closeTimeMin out of range (>1439)", () => {
    const result = createOrgSchema.safeParse({
      title: "Acme",
      closeTimeMin: 1440,
    });
    expect(result.success).toBe(false);
  });
});

// ─── joinFranchiseSchema ──────────────────────────────────────────────────────

describe("joinFranchiseSchema", () => {
  it("accepts a valid token with no schedule", () => {
    const result = joinFranchiseSchema.safeParse({ token: "abc123" });
    expect(result.success).toBe(true);
  });

  it("accepts a token with full schedule fields", () => {
    const result = joinFranchiseSchema.safeParse({
      token: "tok-xyz",
      timezone: "America/New_York",
      operatingDays: ["mon", "wed", "fri"],
      openTimeMin: 540,
      closeTimeMin: 1080,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty token", () => {
    const result = joinFranchiseSchema.safeParse({ token: "" });
    expect(result.success).toBe(false);
  });

  it("rejects whitespace-only token", () => {
    const result = joinFranchiseSchema.safeParse({ token: "   " });
    expect(result.success).toBe(false);
  });

  it("rejects missing token", () => {
    const result = joinFranchiseSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects invalid schedule (openTime >= closeTime)", () => {
    const result = joinFranchiseSchema.safeParse({
      token: "tok",
      openTimeMin: 900,
      closeTimeMin: 480,
    });
    expect(result.success).toBe(false);
  });

  it("applies schedule refinement error to closeTimeMin path", () => {
    const result = joinFranchiseSchema.safeParse({
      token: "tok",
      openTimeMin: 900,
      closeTimeMin: 480,
    });
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("closeTimeMin");
    }
  });
});
