/**
 * Feedback service — thin data-access layer for the Feedback model.
 *
 * All functions are plain async utilities with no auth logic.
 * Auth is enforced by the server actions in app/actions/feedback.ts.
 */

import { FeedbackType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Creates a new feedback submission and returns its id. */
export async function createFeedback(
  userId: string,
  type: FeedbackType,
  message: string,
  orgId?: string | null,
  imageUrl?: string | null,
) {
  return prisma.feedback.create({
    data: {
      userId,
      type,
      message,
      orgId: orgId ?? null,
      imageUrl: imageUrl ?? null,
    },
    select: { id: true },
  });
}

/**
 * Returns all feedback ordered newest-first, including the submitting user's
 * email/name and the associated org name (if any).
 * Used exclusively by the admin panel — requires super-admin auth at the call site.
 */
export async function getAllFeedback() {
  return prisma.feedback.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      type: true,
      message: true,
      imageUrl: true,
      reviewed: true,
      user: { select: { email: true, name: true } },
      org: { select: { id: true, name: true } },
    },
  });
}

/**
 * Flips the `reviewed` flag on a single feedback item.
 * Returns { ok: true, id, reviewed } on success, or { ok: false } if the record doesn't exist.
 */
export async function toggleFeedbackReviewed(
  id: string,
  reviewed: boolean,
): Promise<{ ok: true; id: string; reviewed: boolean } | { ok: false }> {
  const result = await prisma.feedback.updateMany({
    where: { id },
    data: { reviewed },
  });

  if (result.count === 0) {
    return { ok: false };
  }

  return { ok: true, id, reviewed };
}
