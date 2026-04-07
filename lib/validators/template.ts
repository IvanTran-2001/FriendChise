/** Zod schemas and inferred types for template create and mutation operations. */
import z from "zod";

export const createTemplateSchema = z.object({
  name: z.string().trim().min(1, "Title is required").max(200),
  cycleLengthDays: z.coerce.number().int().min(1, "Must be between 1 and 365").max(365, "Must be between 1 and 365"),
});

export const addTemplateInstanceSchema = z.object({
  taskId: z.string(),
  dayIndex: z.number().int().min(0),
  startTimeMin: z.number().int().min(0).max(1439),
});

export const updateTemplateInstanceSchema = z.object({
  dayIndex: z.number().int().min(0).optional(),
  startTimeMin: z.number().int().min(0).max(1439).optional(),
});

export const updateTemplateDaysSchema = z.object({
  cycleLengthDays: z.number().int().min(1).max(365),
});

export const applyTemplateSchema = z.object({
  startDateStr: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  cycleRepeats: z.number().int().min(1).max(52),
});

export const countTimetableEntriesInRangeSchema = z.object({
  startDateStr: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  totalDays: z.number().int().min(1),
});

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type AddTemplateInstanceInput = z.infer<typeof addTemplateInstanceSchema>;
export type UpdateTemplateInstanceInput = z.infer<typeof updateTemplateInstanceSchema>;
export type UpdateTemplateDaysInput = z.infer<typeof updateTemplateDaysSchema>;
export type ApplyTemplateInput = z.infer<typeof applyTemplateSchema>;
export type CountTimetableEntriesInRangeInput = z.infer<typeof countTimetableEntriesInRangeSchema>;
