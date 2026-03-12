import z from "zod";

export const createTaskInstanceSchema = z.object({
  taskId: z.string(),
});

export type CreateTaskInstanceInput = z.infer<typeof createTaskInstanceSchema>;