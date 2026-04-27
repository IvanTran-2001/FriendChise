/** Zod schemas and inferred types for bot operations. */
import z from "zod";

const workingDays = z.array(
  z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
);

export const createBotSchema = z.object({
  botName: z.string().min(1, "Bot name is required").max(100),
  roleIds: z.array(z.string().cuid("Invalid role")).default([]),
  workingDays: workingDays.default([]),
});

export type CreateBotInput = z.infer<typeof createBotSchema>;

export const memberToBotSchema = z.object({
  membershipId: z.string().cuid("Invalid membership"),
  overrideName: z.string().min(1).max(100).optional(),
});

export type MemberToBotInput = z.infer<typeof memberToBotSchema>;

export const botToMemberSchema = z.object({
  membershipId: z.string().cuid("Invalid membership"),
  userId: z.string().cuid("Invalid user"),
});

export type BotToMemberInput = z.infer<typeof botToMemberSchema>;

export const updateBotSchema = z.object({
  botName: z.string().min(1, "Bot name is required").max(100),
  workingDays: workingDays.default([]),
  roleIds: z
    .array(z.string().cuid("Invalid role"))
    .min(1, "At least one role is required"),
});

export type UpdateBotInput = z.infer<typeof updateBotSchema>;

export const inviteBotSlotSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export type InviteBotSlotInput = z.infer<typeof inviteBotSlotSchema>;
