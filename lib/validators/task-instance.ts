/** Zod schemas and inferred types for task-instance create operations. */
import z from "zod";

export const createTaskInstanceSchema = z.object({
  taskId: z.string(),
});

export type CreateTaskInstanceInput = z.infer<typeof createTaskInstanceSchema>;
