/**
 * Zod schemas and inferred types for task create / status-update operations.
 * Times (preferredStartTimeMin) and durations (durationMin) are in minutes.
 * Wait-day bounds are validated cross-field: at least one must be provided,
 * and minWaitDays must not exceed maxWaitDays when both are set.
 */
import { z } from "zod";
import { EntryStatus } from "@prisma/client";

export const createTaskSchema = z
  .object({
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color"),
    title: z.string().min(1).max(200),
    description: z.string().max(5000).optional(),
    durationMin: z
      .number()
      .int()
      .positive()
      .max(24 * 60),

    preferredStartTimeMin: z.number().int().min(0).max(1439).optional(),
    peopleRequired: z.number().int().min(1).max(50).optional(),

    minWaitDays: z.number().int().min(0).max(3650).optional(),
    maxWaitDays: z.number().int().min(1).max(3650).optional(),
  })
  .superRefine((data, ctx) => {
    // Your rule: must set at least one of minWaitDays/maxWaitDays
    if (data.minWaitDays == null && data.maxWaitDays == null) {
      ctx.addIssue({
        code: "custom",
        path: ["minWaitDays"],
        message: "Provide minWaitDays and/or maxWaitDays",
      });
    }

    // Optional: if both provided, min should not exceed max
    if (
      data.minWaitDays != null &&
      data.maxWaitDays != null &&
      data.minWaitDays > data.maxWaitDays
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["minWaitDays"],
        message: "minWaitDays cannot be greater than maxWaitDays",
      });
    }
  });

export const updateTaskInstanceStatusSchema = z.object({
  status: z.nativeEnum(EntryStatus),
});

export type UpdateTaskStatusInput = z.infer<
  typeof updateTaskInstanceStatusSchema
>;

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z
  .object({
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color"),
    title: z.string().min(1).max(200),
    description: z.string().max(5000).optional(),
    durationMin: z
      .number()
      .int()
      .positive()
      .max(24 * 60),
    preferredStartTimeMin: z.number().int().min(0).max(1439).optional(),
    peopleRequired: z.number().int().min(1).max(50).optional(),
    minWaitDays: z.number().int().min(0).max(3650).optional(),
    maxWaitDays: z.number().int().min(1).max(3650).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.minWaitDays == null && data.maxWaitDays == null) {
      ctx.addIssue({
        code: "custom",
        path: ["minWaitDays"],
        message: "Provide minWaitDays and/or maxWaitDays",
      });
    }
    if (
      data.minWaitDays != null &&
      data.maxWaitDays != null &&
      data.minWaitDays > data.maxWaitDays
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["minWaitDays"],
        message: "minWaitDays cannot be greater than maxWaitDays",
      });
    }
  });

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
