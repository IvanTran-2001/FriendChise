import { describe, it, expect } from "vitest";
import {
  createTemplateSchema,
  addTemplateInstanceSchema,
  updateTemplateInstanceSchema,
  updateTemplateDaysSchema,
  applyTemplateSchema,
  countTimetableEntriesInRangeSchema,
} from "@/lib/validators/template";

// ─── createTemplateSchema ─────────────────────────────────────────────────────

describe("createTemplateSchema", () => {
  it("accepts a valid name and cycleLengthDays", () => {
    const result = createTemplateSchema.safeParse({
      name: "Week Plan",
      cycleLengthDays: 7,
    });
    expect(result.success).toBe(true);
  });

  it("coerces string cycleLengthDays to number", () => {
    const result = createTemplateSchema.safeParse({
      name: "Week Plan",
      cycleLengthDays: "14",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.cycleLengthDays).toBe(14);
  });

  it("accepts cycleLengthDays of 1 (minimum)", () => {
    const result = createTemplateSchema.safeParse({
      name: "Daily",
      cycleLengthDays: 1,
    });
    expect(result.success).toBe(true);
  });

  it("accepts cycleLengthDays of 365 (maximum)", () => {
    const result = createTemplateSchema.safeParse({
      name: "Annual",
      cycleLengthDays: 365,
    });
    expect(result.success).toBe(true);
  });

  it("rejects cycleLengthDays of 0", () => {
    const result = createTemplateSchema.safeParse({
      name: "Plan",
      cycleLengthDays: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects cycleLengthDays of 366", () => {
    const result = createTemplateSchema.safeParse({
      name: "Plan",
      cycleLengthDays: 366,
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = createTemplateSchema.safeParse({
      name: "",
      cycleLengthDays: 7,
    });
    expect(result.success).toBe(false);
  });

  it("rejects whitespace-only name", () => {
    const result = createTemplateSchema.safeParse({
      name: "   ",
      cycleLengthDays: 7,
    });
    expect(result.success).toBe(false);
  });

  it("rejects name longer than 200 characters", () => {
    const result = createTemplateSchema.safeParse({
      name: "A".repeat(201),
      cycleLengthDays: 7,
    });
    expect(result.success).toBe(false);
  });

  it("trims whitespace from name", () => {
    const result = createTemplateSchema.safeParse({
      name: "  My Plan  ",
      cycleLengthDays: 7,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("My Plan");
  });
});

// ─── addTemplateInstanceSchema ────────────────────────────────────────────────

describe("addTemplateInstanceSchema", () => {
  const valid = { taskId: "task-1", dayIndex: 0, startTimeMin: 480 };

  it("accepts valid input", () => {
    expect(addTemplateInstanceSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts dayIndex of 0 (first day of cycle)", () => {
    expect(
      addTemplateInstanceSchema.safeParse({ ...valid, dayIndex: 0 }).success,
    ).toBe(true);
  });

  it("accepts large dayIndex values", () => {
    expect(
      addTemplateInstanceSchema.safeParse({ ...valid, dayIndex: 364 }).success,
    ).toBe(true);
  });

  it("rejects negative dayIndex", () => {
    expect(
      addTemplateInstanceSchema.safeParse({ ...valid, dayIndex: -1 }).success,
    ).toBe(false);
  });

  it("rejects startTimeMin > 1439", () => {
    expect(
      addTemplateInstanceSchema.safeParse({ ...valid, startTimeMin: 1440 })
        .success,
    ).toBe(false);
  });

  it("accepts startTimeMin of 0", () => {
    expect(
      addTemplateInstanceSchema.safeParse({ ...valid, startTimeMin: 0 })
        .success,
    ).toBe(true);
  });

  it("rejects missing taskId", () => {
    const { taskId: _, ...rest } = valid;
    expect(addTemplateInstanceSchema.safeParse(rest).success).toBe(false);
  });
});

// ─── updateTemplateInstanceSchema ─────────────────────────────────────────────

describe("updateTemplateInstanceSchema", () => {
  it("accepts an empty object (all fields optional)", () => {
    expect(updateTemplateInstanceSchema.safeParse({}).success).toBe(true);
  });

  it("accepts partial update with only dayIndex", () => {
    expect(
      updateTemplateInstanceSchema.safeParse({ dayIndex: 2 }).success,
    ).toBe(true);
  });

  it("accepts partial update with only startTimeMin", () => {
    expect(
      updateTemplateInstanceSchema.safeParse({ startTimeMin: 600 }).success,
    ).toBe(true);
  });

  it("rejects negative dayIndex", () => {
    expect(
      updateTemplateInstanceSchema.safeParse({ dayIndex: -1 }).success,
    ).toBe(false);
  });

  it("rejects startTimeMin > 1439", () => {
    expect(
      updateTemplateInstanceSchema.safeParse({ startTimeMin: 1440 }).success,
    ).toBe(false);
  });
});

// ─── updateTemplateDaysSchema ─────────────────────────────────────────────────

describe("updateTemplateDaysSchema", () => {
  it("accepts a valid cycleLengthDays", () => {
    expect(
      updateTemplateDaysSchema.safeParse({ cycleLengthDays: 7 }).success,
    ).toBe(true);
  });

  it("rejects 0", () => {
    expect(
      updateTemplateDaysSchema.safeParse({ cycleLengthDays: 0 }).success,
    ).toBe(false);
  });

  it("rejects 366", () => {
    expect(
      updateTemplateDaysSchema.safeParse({ cycleLengthDays: 366 }).success,
    ).toBe(false);
  });
});

// ─── applyTemplateSchema ──────────────────────────────────────────────────────

describe("applyTemplateSchema", () => {
  const valid = { startDateStr: "2026-04-20", cycleRepeats: 2 };

  it("accepts a valid payload", () => {
    expect(applyTemplateSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects invalid date format", () => {
    expect(
      applyTemplateSchema.safeParse({ ...valid, startDateStr: "20-04-2026" })
        .success,
    ).toBe(false);
  });

  it("rejects date with letters", () => {
    expect(
      applyTemplateSchema.safeParse({ ...valid, startDateStr: "2026-04-xx" })
        .success,
    ).toBe(false);
  });

  it("accepts cycleRepeats of 1 (minimum)", () => {
    expect(
      applyTemplateSchema.safeParse({ ...valid, cycleRepeats: 1 }).success,
    ).toBe(true);
  });

  it("accepts cycleRepeats of 52 (maximum)", () => {
    expect(
      applyTemplateSchema.safeParse({ ...valid, cycleRepeats: 52 }).success,
    ).toBe(true);
  });

  it("rejects cycleRepeats of 0", () => {
    expect(
      applyTemplateSchema.safeParse({ ...valid, cycleRepeats: 0 }).success,
    ).toBe(false);
  });

  it("rejects cycleRepeats of 53", () => {
    expect(
      applyTemplateSchema.safeParse({ ...valid, cycleRepeats: 53 }).success,
    ).toBe(false);
  });

  it("rejects non-integer cycleRepeats", () => {
    expect(
      applyTemplateSchema.safeParse({ ...valid, cycleRepeats: 1.5 }).success,
    ).toBe(false);
  });
});

// ─── countTimetableEntriesInRangeSchema ───────────────────────────────────────

describe("countTimetableEntriesInRangeSchema", () => {
  const valid = { startDateStr: "2026-04-20", totalDays: 7 };

  it("accepts a valid payload", () => {
    expect(countTimetableEntriesInRangeSchema.safeParse(valid).success).toBe(
      true,
    );
  });

  it("rejects invalid date format", () => {
    expect(
      countTimetableEntriesInRangeSchema.safeParse({
        ...valid,
        startDateStr: "04/20/2026",
      }).success,
    ).toBe(false);
  });

  it("accepts totalDays of 1 (minimum)", () => {
    expect(
      countTimetableEntriesInRangeSchema.safeParse({ ...valid, totalDays: 1 })
        .success,
    ).toBe(true);
  });

  it("rejects totalDays of 0", () => {
    expect(
      countTimetableEntriesInRangeSchema.safeParse({ ...valid, totalDays: 0 })
        .success,
    ).toBe(false);
  });

  it("rejects non-integer totalDays", () => {
    expect(
      countTimetableEntriesInRangeSchema.safeParse({ ...valid, totalDays: 3.5 })
        .success,
    ).toBe(false);
  });
});
