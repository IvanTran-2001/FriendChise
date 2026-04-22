import { describe, it, expect } from "vitest";
import {
  createTaskSchema,
  updateTaskSchema,
  updateTaskInstanceStatusSchema,
} from "@/lib/validators/task";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const validCreate = {
  color: "#F59E0B",
  title: "Open shop checklist",
  durationMin: 30,
  minWaitDays: 0,
  maxWaitDays: 1,
};

function issueMessages(result: ReturnType<typeof createTaskSchema.safeParse>) {
  if (result.success) return [];
  return result.error.issues.map((i) => i.message);
}

// ─── createTaskSchema ────────────────────────────────────────────────────────

describe("createTaskSchema", () => {
  describe("valid inputs", () => {
    it("accepts minimal valid input", () => {
      const result = createTaskSchema.safeParse(validCreate);
      expect(result.success).toBe(true);
    });

    it("accepts full valid input with all optional fields", () => {
      const result = createTaskSchema.safeParse({
        ...validCreate,
        description: "Turn on lights, start fryer, prep counter.",
        preferredStartTimeMin: 360,
        peopleRequired: 2,
      });
      expect(result.success).toBe(true);
    });

    it("accepts only minWaitDays without maxWaitDays", () => {
      const result = createTaskSchema.safeParse({
        ...validCreate,
        minWaitDays: 0,
        maxWaitDays: undefined,
      });
      expect(result.success).toBe(true);
    });

    it("accepts only maxWaitDays without minWaitDays", () => {
      const result = createTaskSchema.safeParse({
        ...validCreate,
        minWaitDays: undefined,
        maxWaitDays: 7,
      });
      expect(result.success).toBe(true);
    });

    it("accepts durationMin at max boundary (24h = 1440 min)", () => {
      const result = createTaskSchema.safeParse({
        ...validCreate,
        durationMin: 1440,
      });
      expect(result.success).toBe(true);
    });

    it("accepts preferredStartTimeMin at max boundary (1439)", () => {
      const result = createTaskSchema.safeParse({
        ...validCreate,
        preferredStartTimeMin: 1439,
      });
      expect(result.success).toBe(true);
    });

    it("accepts peopleRequired up to 50", () => {
      const result = createTaskSchema.safeParse({
        ...validCreate,
        peopleRequired: 50,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("color validation", () => {
    it("rejects an invalid hex color", () => {
      const result = createTaskSchema.safeParse({ ...validCreate, color: "red" });
      expect(result.success).toBe(false);
      expect(issueMessages(result)).toContain("Must be a valid hex color");
    });

    it("rejects a 3-digit hex shorthand", () => {
      const result = createTaskSchema.safeParse({ ...validCreate, color: "#FFF" });
      expect(result.success).toBe(false);
    });

    it("rejects a hex without leading #", () => {
      const result = createTaskSchema.safeParse({ ...validCreate, color: "F59E0B" });
      expect(result.success).toBe(false);
    });

    it("accepts uppercase hex letters", () => {
      const result = createTaskSchema.safeParse({ ...validCreate, color: "#AABBCC" });
      expect(result.success).toBe(true);
    });

    it("accepts lowercase hex letters", () => {
      const result = createTaskSchema.safeParse({ ...validCreate, color: "#aabbcc" });
      expect(result.success).toBe(true);
    });
  });

  describe("title validation", () => {
    it("rejects an empty title", () => {
      const result = createTaskSchema.safeParse({ ...validCreate, title: "" });
      expect(result.success).toBe(false);
    });

    it("rejects a title over 200 characters", () => {
      const result = createTaskSchema.safeParse({
        ...validCreate,
        title: "a".repeat(201),
      });
      expect(result.success).toBe(false);
    });

    it("accepts a title at exactly 200 characters", () => {
      const result = createTaskSchema.safeParse({
        ...validCreate,
        title: "a".repeat(200),
      });
      expect(result.success).toBe(true);
    });
  });

  describe("durationMin validation", () => {
    it("rejects durationMin of 0", () => {
      const result = createTaskSchema.safeParse({ ...validCreate, durationMin: 0 });
      expect(result.success).toBe(false);
    });

    it("rejects negative durationMin", () => {
      const result = createTaskSchema.safeParse({ ...validCreate, durationMin: -1 });
      expect(result.success).toBe(false);
    });

    it("rejects durationMin over 1440 (24h)", () => {
      const result = createTaskSchema.safeParse({ ...validCreate, durationMin: 1441 });
      expect(result.success).toBe(false);
    });

    it("rejects non-integer durationMin", () => {
      const result = createTaskSchema.safeParse({ ...validCreate, durationMin: 30.5 });
      expect(result.success).toBe(false);
    });
  });

  describe("wait-day cross-field validation", () => {
    it("rejects when both minWaitDays and maxWaitDays are missing", () => {
      const { minWaitDays, maxWaitDays, ...rest } = validCreate;
      const result = createTaskSchema.safeParse(rest);
      expect(result.success).toBe(false);
      expect(issueMessages(result)).toContain(
        "Provide minWaitDays and/or maxWaitDays",
      );
    });

    it("rejects when minWaitDays > maxWaitDays", () => {
      const result = createTaskSchema.safeParse({
        ...validCreate,
        minWaitDays: 5,
        maxWaitDays: 2,
      });
      expect(result.success).toBe(false);
      expect(issueMessages(result)).toContain(
        "minWaitDays cannot be greater than maxWaitDays",
      );
    });

    it("accepts when minWaitDays === maxWaitDays", () => {
      const result = createTaskSchema.safeParse({
        ...validCreate,
        minWaitDays: 3,
        maxWaitDays: 3,
      });
      expect(result.success).toBe(true);
    });

    it("accepts minWaitDays: 0 (boundary)", () => {
      const result = createTaskSchema.safeParse({
        ...validCreate,
        minWaitDays: 0,
        maxWaitDays: 1,
      });
      expect(result.success).toBe(true);
    });

    it("rejects maxWaitDays: 0 (must be >= 1)", () => {
      const result = createTaskSchema.safeParse({
        ...validCreate,
        minWaitDays: 0,
        maxWaitDays: 0,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("description validation", () => {
    it("rejects a description over 5000 characters", () => {
      const result = createTaskSchema.safeParse({
        ...validCreate,
        description: "x".repeat(5001),
      });
      expect(result.success).toBe(false);
    });

    it("accepts a description at exactly 5000 characters", () => {
      const result = createTaskSchema.safeParse({
        ...validCreate,
        description: "x".repeat(5000),
      });
      expect(result.success).toBe(true);
    });
  });

  describe("peopleRequired validation", () => {
    it("rejects peopleRequired of 0", () => {
      const result = createTaskSchema.safeParse({ ...validCreate, peopleRequired: 0 });
      expect(result.success).toBe(false);
    });

    it("rejects peopleRequired over 50", () => {
      const result = createTaskSchema.safeParse({ ...validCreate, peopleRequired: 51 });
      expect(result.success).toBe(false);
    });
  });
});

// ─── updateTaskSchema ─────────────────────────────────────────────────────────

describe("updateTaskSchema", () => {
  const validUpdate = { ...validCreate };

  it("accepts valid update input", () => {
    expect(updateTaskSchema.safeParse(validUpdate).success).toBe(true);
  });

  it("rejects missing required color", () => {
    const { color, ...rest } = validUpdate;
    expect(updateTaskSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects when minWaitDays > maxWaitDays", () => {
    const result = updateTaskSchema.safeParse({
      ...validUpdate,
      minWaitDays: 10,
      maxWaitDays: 2,
    });
    expect(result.success).toBe(false);
  });

  it("applies same wait-day cross-field rule as create", () => {
    const { minWaitDays, maxWaitDays, ...rest } = validUpdate;
    const result = updateTaskSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});

// ─── updateTaskInstanceStatusSchema ──────────────────────────────────────────

describe("updateTaskInstanceStatusSchema", () => {
  it("accepts TODO", () => {
    expect(
      updateTaskInstanceStatusSchema.safeParse({ status: "TODO" }).success,
    ).toBe(true);
  });

  it("accepts IN_PROGRESS", () => {
    expect(
      updateTaskInstanceStatusSchema.safeParse({ status: "IN_PROGRESS" }).success,
    ).toBe(true);
  });

  it("accepts DONE", () => {
    expect(
      updateTaskInstanceStatusSchema.safeParse({ status: "DONE" }).success,
    ).toBe(true);
  });

  it("accepts SKIPPED", () => {
    expect(
      updateTaskInstanceStatusSchema.safeParse({ status: "SKIPPED" }).success,
    ).toBe(true);
  });

  it("rejects an invalid status string", () => {
    expect(
      updateTaskInstanceStatusSchema.safeParse({ status: "PENDING" }).success,
    ).toBe(false);
  });

  it("rejects a missing status field", () => {
    expect(updateTaskInstanceStatusSchema.safeParse({}).success).toBe(false);
  });
});
