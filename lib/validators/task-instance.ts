/** Zod schemas and inferred types for timetable entry create operations. */
import z from "zod";

export const createTaskInstanceSchema = z.object({
  taskId: z.string(),
  /** ISO date string for the local date the entry falls on (e.g. "2026-03-25"). */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  /** Start time in minutes from local midnight (0–1439). */
  startTimeMin: z.number().int().min(0).max(1439),
  /** End time in minutes from local midnight (0–1439). Defaults to startTimeMin + task.durationMin. */
  endTimeMin: z.number().int().min(0).max(1440).optional(),
});

export type CreateTaskInstanceInput = z.infer<typeof createTaskInstanceSchema>;
