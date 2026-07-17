/**
 * Feedback service — thin data-access layer for the Feedback model.
 *
 * All functions are plain async utilities with no auth logic.
 * Auth is enforced by the server actions in app/actions/feedback.ts.
 */

import { FeedbackType } from "@prisma/client";
import { prisma } from "@/lib/platform/prisma";

export type FeedbackFilter = "all" | "unreviewed";

export type FeedbackRow = {
  id: string;
  createdAt: Date;
  type: FeedbackType;
  message: string;
  imageUrl: string | null;
  reviewed: boolean;
  user: { email: string | null; name: string | null };
  org: { id: string; name: string } | null;
};

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

function buildFeedbackWhere(filter: FeedbackFilter) {
  return filter === "unreviewed" ? { reviewed: false } : {};
}

/**
 * Returns a paginated slice of feedback ordered newest-first, including the
 * submitting user's email/name and the associated org name (if any).
 * Used by the admin inbox and other bounded admin views.
 */
export async function getFeedbackPage(
  page: number,
  pageSize: number,
  filter: FeedbackFilter = "all",
): Promise<{ feedback: FeedbackRow[]; totalCount: number; totalPages: number; page: number; pageSize: number; filter: FeedbackFilter }> {
  const where = buildFeedbackWhere(filter);
  const totalCount = await prisma.feedback.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(Math.max(1, Math.floor(page)), totalPages);

  const feedback = await prisma.feedback.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (currentPage - 1) * pageSize,
    take: pageSize,
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

  return { feedback, totalCount, totalPages, page: currentPage, pageSize, filter };
}

/**
 * Returns all feedback ordered newest-first by loading it in bounded pages.
 * Existing admin pages still consume the full list, but the underlying reads
 * are chunked so the query path stays bounded.
 */
export async function getAllFeedback() {
  const pageSize = 100;
  const firstPage = await getFeedbackPage(1, pageSize, "all");
  if (firstPage.totalPages === 1) return firstPage.feedback;

  const rows: FeedbackRow[] = [...firstPage.feedback];
  for (let page = 2; page <= firstPage.totalPages; page += 1) {
    const result = await getFeedbackPage(page, pageSize, "all");
    rows.push(...result.feedback);
  }

  return rows;
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
