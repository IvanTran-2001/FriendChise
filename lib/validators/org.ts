import z from "zod";

export const createOrgSchema = z.object({
  title: z.string().min(1).max(200),
  openTimeMin: z.number().int().min(0).max(1439).optional(),
  closeTimeMin: z.number().int().min(0).max(1439).optional(),
});

export type CreateOrgInput = z.infer<typeof createOrgSchema>;