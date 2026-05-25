/**
 * Zod schemas for task comment mutations.
 *
 * addCommentSchema  — validates content (1–2000 chars) and an optional parentId
 *                     (CUID) for threaded replies.
 * editCommentSchema — validates content only; parentId cannot be changed post-
 *                     creation.
 */
import { z } from "zod";

export const addCommentSchema = z.object({
  content: z.string().trim().min(1, "Comment cannot be empty").max(2000),
  parentId: z.string().cuid().optional(),
});

export const editCommentSchema = z.object({
  content: z.string().trim().min(1, "Comment cannot be empty").max(2000),
});

export type AddCommentInput = z.infer<typeof addCommentSchema>;
export type EditCommentInput = z.infer<typeof editCommentSchema>;
