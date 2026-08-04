import { z } from "zod";

/**
 * Shared Zod schemas for scan-to-task form payloads.
 * Keep these in a validator module so the server action stays focused on
 * orchestration and mutation rather than parsing rules.
 */
export const scanSourceSchema = z.object({
  storagePath: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  fileSize: z.number().int().nonnegative(),
});

/**
 * Validates the AI-generated or fallback draft shape before it reaches the
 * task creation flow. Keep this near the other scan-to-task schemas so all
 * data-shape rules live together.
 */
export const scanTaskDraftSchema = z.object({
  title: z.string().min(1).max(200),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color").optional(),
  description: z.string().max(5000),
  durationMin: z.number().int().positive().max(24 * 60),
  peopleRequired: z.number().int().min(1).max(50),
  minWaitDays: z.number().int().min(0).max(3650),
  maxWaitDays: z.number().int().min(0).max(3650),
  summary: z.string().max(500),
  sourceText: z.string().max(12000).default(""),
}).refine((value) => value.maxWaitDays >= value.minWaitDays, {
  message: "maxWaitDays must be greater than or equal to minWaitDays",
  path: ["maxWaitDays"],
});

/**
 * Validates a reviewed draft before task creation.
 * Numeric fields are coerced because the form submits raw string values.
 */
export const confirmScanToTaskSchema = z.object({
  resultId: z.string().min(1),
  fileName: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color").optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(5000),
  summary: z.string().max(500),
  sourceText: z.string().max(12000).optional().or(z.literal("")),
  durationMin: z.coerce.number().int().positive().max(24 * 60),
  peopleRequired: z.coerce.number().int().min(1).max(50),
  minWaitDays: z.coerce.number().int().min(0).max(3650),
  maxWaitDays: z.coerce.number().int().min(0).max(3650),
});

/**
 * Validates the AI merge payload used when a reviewed draft should add on to an
 * existing task instead of creating a duplicate.
 */
export const scanTaskMergeSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000),
  durationMin: z.number().int().positive().max(24 * 60),
  peopleRequired: z.number().int().min(1).max(50),
  minWaitDays: z.number().int().min(0).max(3650),
  maxWaitDays: z.number().int().min(0).max(3650),
}).refine((value) => value.maxWaitDays >= value.minWaitDays, {
  message: "maxWaitDays must be greater than or equal to minWaitDays",
  path: ["maxWaitDays"],
});

export type ScanTaskResultMetadata = {
  mergedFromResultIds?: string[];
  mergedFromResultSnapshots?: { id: string; fileName: string; title: string }[];
  mergedFromTaskIds?: string[];
  duplicateCandidateVerdicts?: Record<string, boolean>;
};

/**
 * Validates the metadata needed to request a signed upload URL.
 */
export const getUploadUrlSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
});

/**
 * Validates one or more temporary storage paths to delete.
 */
export const deleteUploadsSchema = z.object({
  storagePaths: z.array(z.string().min(1)).min(1),
});

export type ScanSourceInput = z.infer<typeof scanSourceSchema>;
export type ScanTaskDraftInput = z.infer<typeof scanTaskDraftSchema>;
export type ConfirmScanToTaskInput = z.infer<typeof confirmScanToTaskSchema>;
export type ScanTaskMergeInput = z.infer<typeof scanTaskMergeSchema>;
export type GetScanToTaskUploadUrlInput = z.infer<typeof getUploadUrlSchema>;
export type DeleteScanToTaskUploadsInput = z.infer<typeof deleteUploadsSchema>;