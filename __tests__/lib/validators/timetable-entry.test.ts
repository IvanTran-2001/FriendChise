import { describe, it, expect } from "vitest";
import { createTimetableEntrySchema } from "@/lib/validators/timetable-entry";

describe("createTimetableEntrySchema", () => {
  const validInput = {
    taskId: "task-abc",
    date: "2026-04-20",
    startTimeMin: 480,
  };

  it("accepts a minimal valid input (no endTimeMin)", () => {
    const result = createTimetableEntrySchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("accepts input with an explicit endTimeMin", () => {
    const result = createTimetableEntrySchema.safeParse({
      ...validInput,
      endTimeMin: 540,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing taskId", () => {
    const { date, startTimeMin } = validInput;
    const result = createTimetableEntrySchema.safeParse({ date, startTimeMin });
    expect(result.success).toBe(false);
  });

  it("rejects invalid date format (not YYYY-MM-DD)", () => {
    const result = createTimetableEntrySchema.safeParse({
      ...validInput,
      date: "20-04-2026",
    });
    expect(result.success).toBe(false);
  });

  it("rejects date with letters", () => {
    const result = createTimetableEntrySchema.safeParse({
      ...validInput,
      date: "2026-04-xx",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing date", () => {
    const { taskId, startTimeMin } = validInput;
    const result = createTimetableEntrySchema.safeParse({ taskId, startTimeMin });
    expect(result.success).toBe(false);
  });

  it("accepts startTimeMin of 0 (midnight)", () => {
    const result = createTimetableEntrySchema.safeParse({
      ...validInput,
      startTimeMin: 0,
    });
    expect(result.success).toBe(true);
  });

  it("accepts startTimeMin of 1439 (last minute)", () => {
    const result = createTimetableEntrySchema.safeParse({
      ...validInput,
      startTimeMin: 1439,
    });
    expect(result.success).toBe(true);
  });

  it("rejects startTimeMin of 1440 (out of range)", () => {
    const result = createTimetableEntrySchema.safeParse({
      ...validInput,
      startTimeMin: 1440,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative startTimeMin", () => {
    const result = createTimetableEntrySchema.safeParse({
      ...validInput,
      startTimeMin: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer startTimeMin", () => {
    const result = createTimetableEntrySchema.safeParse({
      ...validInput,
      startTimeMin: 480.5,
    });
    expect(result.success).toBe(false);
  });

  it("accepts endTimeMin of 1440 (midnight end-of-day)", () => {
    const result = createTimetableEntrySchema.safeParse({
      ...validInput,
      endTimeMin: 1440,
    });
    expect(result.success).toBe(true);
  });

  it("rejects endTimeMin greater than 1440", () => {
    const result = createTimetableEntrySchema.safeParse({
      ...validInput,
      endTimeMin: 1441,
    });
    expect(result.success).toBe(false);
  });

  it("rejects endTimeMin of 0 is valid (midnight)", () => {
    const result = createTimetableEntrySchema.safeParse({
      ...validInput,
      endTimeMin: 0,
    });
    expect(result.success).toBe(true);
  });
});
