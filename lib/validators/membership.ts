/** Zod schemas and inferred types for membership create / delete operations. */
import z from "zod";

export const createMembershipSchema = z.object({
  userId: z.string(),
  roleId: z.string(), // must be a real Role.id
});

export const deleteMembershipSchema = z.object({
  userId: z.string(),
});

export type CreateMembershipInput = z.infer<typeof createMembershipSchema>;
export type DeleteMembershipInput = z.infer<typeof deleteMembershipSchema>;
