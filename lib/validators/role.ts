/**
 * Zod schemas and inferred types for role create / update operations.
 *
 * `taskIds` lists the IDs of tasks this role is eligible to perform
 * (stored in `TaskEligibility`). An empty array means no task restrictions.
 */
import z from "zod";
import { PermissionAction } from "@prisma/client";

export const roleFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(50, "Name is too long"),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Invalid color format")
    .optional(),
  permissions: z.array(
    z.enum(
      Object.values(PermissionAction) as [
        PermissionAction,
        ...PermissionAction[],
      ],
    ),
  ),
  taskIds: z.array(z.string()),
});

export type RoleFormInput = z.infer<typeof roleFormSchema>;
