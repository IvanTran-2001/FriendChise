/**
 * Zod schemas and inferred types for organization create/join operations.
 *
 * Times are stored as minutes since midnight (0–1439) so they are
 * timezone-agnostic and easy to compare arithmetically.
 *
 * Operating days are stored as a string array of 3-letter day keys
 * ("mon"–"sun") so they are readable and easy to display/filter.
 */
import z from "zod";

/** Canonical ordered day keys used throughout the app. */
export const DAY_VALUES = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
] as const;
export type DayKey = (typeof DAY_VALUES)[number];

/**
 * Shared schedule refinement — ensures openTimeMin is always before closeTimeMin
 * when both are provided.
 */
function refineSchedule<
  T extends { openTimeMin?: number; closeTimeMin?: number },
>(data: T) {
  return (
    data.openTimeMin == null ||
    data.closeTimeMin == null ||
    data.openTimeMin < data.closeTimeMin
  );
}
const scheduleRefinementOpts = {
  message: "Open time must be before close time",
  path: ["closeTimeMin"],
};

/**
 * Fields common to both Create and Join flows.
 * All schedule fields are optional — an org can be created without hours.
 */
const scheduleFields = {
  timezone: z.string().trim().min(1).optional(),
  address: z.string().trim().optional(),
  operatingDays: z.array(z.enum(DAY_VALUES)).optional(),
  openTimeMin: z.number().int().min(0).max(1439).optional(),
  closeTimeMin: z.number().int().min(0).max(1439).optional(),
};

/**
 * Schema for creating a standalone or parent org.
 * `title` becomes the org's display name.
 */
export const createOrgSchema = z
  .object({ title: z.string().trim().min(1).max(200), ...scheduleFields })
  .refine(refineSchedule, scheduleRefinementOpts);

export type CreateOrgInput = z.infer<typeof createOrgSchema>;

/**
 * Schema for joining an existing franchise as a child org.
 *
 * - `token`  — the one-time invite token issued by the parent org owner.
 * - The child org's name is taken directly from the parent org — no separate
 *   input needed. Each franchisee location is identified by its own org record.
 * - Schedule fields — the child's own operating hours/days; they are independent
 *   from the parent and must be set by the franchisee.
 */
export const joinFranchiseSchema = z
  .object({
    token: z.string().trim().min(1),
    ...scheduleFields,
  })
  .refine(refineSchedule, scheduleRefinementOpts);

export type JoinFranchiseInput = z.infer<typeof joinFranchiseSchema>;

/** Schema for updating an existing org's schedule/location settings. */
export const updateOrgSettingsSchema = z
  .object(scheduleFields)
  .refine(refineSchedule, scheduleRefinementOpts);

export type UpdateOrgSettingsInput = z.infer<typeof updateOrgSettingsSchema>;

/** Schema for transferring org ownership to another member. */
export const transferOrgSchema = z.object({
  /** The user ID of the new owner (must already be a member). */
  newOwnerId: z.string().cuid(),
});

export type TransferOrgInput = z.infer<typeof transferOrgSchema>;

/** Schema for deleting an org — caller must type the org name to confirm. */
export const deleteOrgSchema = z.object({
  confirmName: z.string().min(1),
});

export type DeleteOrgInput = z.infer<typeof deleteOrgSchema>;
