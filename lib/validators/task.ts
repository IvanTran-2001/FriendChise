import { z } from "zod";

export const createTaskSchema = z
  .object({
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
        code: z.ZodIssueCode.custom,
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
        code: z.ZodIssueCode.custom,
        path: ["minWaitDays"],
        message: "minWaitDays cannot be greater than maxWaitDays",
      });
    }
  });

const status = ["TODO", "IN_PROGRESS", "DONE", "SKIPPED"] as const;

export const statusSchema = z.object({
  status: z.enum(status),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskStatusInput = z.infer<typeof statusSchema>;
