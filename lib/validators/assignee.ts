/** Zod schemas and inferred types for task-instance assignee operations. */
import z from "zod";

export const CreateAssigneeSchema = z.object({
  membershipId: z.string(),
});

export const DeleteAssigneeSchema = z.object({
  membershipId: z.string(),
});

export type CreateAssigneeInput = z.infer<typeof CreateAssigneeSchema>;
export type DeleteAssigneeInput = z.infer<typeof DeleteAssigneeSchema>;
