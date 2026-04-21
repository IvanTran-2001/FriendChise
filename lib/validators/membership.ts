/** Zod schemas and inferred types for membership operations. */
import z from "zod";

export const createMembershipSchema = z.object({
  userId: z.string().cuid(),
  roleId: z.string().cuid(),
});

export type CreateMembershipInput = z.infer<typeof createMembershipSchema>;

export const deleteMembershipSchema = z.object({
  membershipId: z.string().cuid(),
});

export const sendMemberInviteSchema = z.object({
  email: z.string().email("Invalid email address").min(1, "Email is required"),
  roleIds: z.array(z.string().cuid()).default([]),
  workingDays: z.array(
    z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
  ),
});

export type SendMemberInviteInput = z.infer<typeof sendMemberInviteSchema>;
