import z from "zod";

export const createOrgSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    openTimeMin: z.number().int().min(0).max(1439).optional(),
    closeTimeMin: z.number().int().min(0).max(1439).optional(),
  })
  .refine(
    ({ openTimeMin, closeTimeMin }) =>
      openTimeMin == null || closeTimeMin == null || openTimeMin < closeTimeMin,
    {
      message: "openTimeMin must be less than closeTimeMin",
      path: ["closeTimeMin"],
    },
  );

export type CreateOrgInput = z.infer<typeof createOrgSchema>;
