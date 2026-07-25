/**
 * Task comment service — CRUD, voting, pinning, and franchise permission checks.
 *
 * Permission model (as requested):
 *   franchiseRoot(org) = org.parentId ?? org.id
 *   canComment = franchiseRoot(taskOrg) === franchiseRoot(userOrg)
 *
 * This means any org in the same franchise network (parent or sibling) can
 * comment on a task, regardless of which specific org owns it.
 */
import { VoteType } from "@prisma/client";
import { prisma } from "@/lib/platform/prisma";
import { isSameFranchise } from "@/lib/services/franchise-root";
import type { ServiceResult } from "./types";
import type { AddCommentInput, EditCommentInput } from "@/lib/validators/task-comment";

// ─── Types ────────────────────────────────────────────────────────────────────

type VoteRow = { userId: string; type: VoteType };

export type CommentRow = {
  id: string;
  taskId: string;
  orgId: string;
  authorId: string | null;
  authorName: string;
  authorImage: string | null;
  content: string;
  parentId: string | null;
  isDeleted: boolean;
  isPinned: boolean;
  pinnedAt: Date | null;
  editedAt: Date | null;
  createdAt: Date;
  votes: VoteRow[];
  replies?: CommentRow[];
};

// ─── Prisma include shape ─────────────────────────────────────────────────────

const replyInclude = {
  votes: { select: { userId: true, type: true } },
} as const;

const commentInclude = {
  votes: { select: { userId: true, type: true } },
  replies: {
    orderBy: { createdAt: "asc" as const },
    include: replyInclude,
  },
} as const;

// ─── Permission check ─────────────────────────────────────────────────────────

/**
 * Returns true if the user's org is in the same franchise as the task's org.
 *
 * Rule: compare franchise roots (parentId ?? own id).
 * If parentId is null (org IS the root), use the org's own id as the root.
 */
export async function canUserCommentOnTask(
  taskId: string,
  userOrgId: string,
): Promise<boolean> {
  const [task, userOrg] = await Promise.all([
    prisma.task.findUnique({
      where: { id: taskId },
      select: { organization: { select: { id: true, parentId: true } } },
    }),
    prisma.organization.findUnique({
      where: { id: userOrgId },
      select: { id: true, parentId: true },
    }),
  ]);
  if (!task || !userOrg) return false;

  return isSameFranchise(task.organization, userOrg);
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/** Fetch all top-level comments for a task with replies and votes. Pinned first, then oldest. */
export async function getTaskComments(taskId: string): Promise<CommentRow[]> {
  const rows = await prisma.taskComment.findMany({
    where: { taskId, parentId: null },
    orderBy: [{ isPinned: "desc" }, { createdAt: "asc" }],
    include: commentInclude,
  });
  return rows as unknown as CommentRow[];
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createComment(
  taskId: string,
  orgId: string,
  authorId: string,
  authorName: string,
  authorImage: string | null,
  data: AddCommentInput,
): Promise<ServiceResult<CommentRow>> {
  // Validate parent exists, is top-level, and belongs to this task
  if (data.parentId) {
    const parent = await prisma.taskComment.findFirst({
      where: { id: data.parentId, taskId, parentId: null },
      select: { id: true },
    });
    if (!parent)
      return { ok: false, error: "Parent comment not found", code: "NOT_FOUND" };
  }

  const comment = await prisma.taskComment.create({
    data: {
      taskId,
      orgId,
      authorId,
      authorName,
      authorImage,
      content: data.content,
      parentId: data.parentId ?? null,
    },
    include: commentInclude,
  });
  return { ok: true, data: comment as unknown as CommentRow };
}

export async function editComment(
  taskId: string,
  commentId: string,
  authorId: string,
  data: EditCommentInput,
): Promise<ServiceResult<CommentRow>> {
  const existing = await prisma.taskComment.findFirst({
    where: { id: commentId, taskId },
    select: { authorId: true, isDeleted: true },
  });
  if (!existing)
    return { ok: false, error: "Comment not found", code: "NOT_FOUND" };
  if (existing.isDeleted)
    return { ok: false, error: "Cannot edit a deleted comment", code: "INVALID" };
  if (existing.authorId !== authorId)
    return { ok: false, error: "Not the author", code: "FORBIDDEN" };

  const updated = await prisma.taskComment.update({
    where: { id: commentId, taskId },
    data: { content: data.content, editedAt: new Date() },
    include: commentInclude,
  });
  return { ok: true, data: updated as unknown as CommentRow };
}

export async function softDeleteComment(
  taskId: string,
  commentId: string,
  userId: string,
  canManage: boolean,
): Promise<ServiceResult<null>> {
  const existing = await prisma.taskComment.findFirst({
    where: { id: commentId, taskId },
    select: { authorId: true, isDeleted: true },
  });
  if (!existing)
    return { ok: false, error: "Comment not found", code: "NOT_FOUND" };
  if (existing.isDeleted) return { ok: true, data: null };
  if (!canManage && existing.authorId !== userId)
    return { ok: false, error: "Not the author", code: "FORBIDDEN" };

  await prisma.taskComment.update({
    where: { id: commentId, taskId },
    data: { isDeleted: true, content: "" },
  });
  return { ok: true, data: null };
}

export async function voteOnComment(
  taskId: string,
  commentId: string,
  userId: string,
  type: VoteType | null,
): Promise<ServiceResult<null>> {
  const comment = await prisma.taskComment.findFirst({
    where: { id: commentId, taskId },
    select: { id: true },
  });
  if (!comment)
    return { ok: false, error: "Comment not found", code: "NOT_FOUND" };

  if (type === null) {
    await prisma.taskCommentVote.deleteMany({ where: { commentId, userId } });
  } else {
    await prisma.taskCommentVote.upsert({
      where: { commentId_userId: { commentId, userId } },
      create: { commentId, userId, type },
      update: { type },
    });
  }
  return { ok: true, data: null };
}

export async function setPinComment(
  taskId: string,
  commentId: string,
  isPinned: boolean,
): Promise<ServiceResult<null>> {
  const existing = await prisma.taskComment.findFirst({
    where: { id: commentId, taskId },
    select: { parentId: true },
  });
  if (!existing)
    return { ok: false, error: "Comment not found", code: "NOT_FOUND" };
  if (existing.parentId !== null)
    return { ok: false, error: "Cannot pin a reply", code: "INVALID" };

  await prisma.taskComment.update({
    where: { id: commentId, taskId },
    data: { isPinned, pinnedAt: isPinned ? new Date() : null },
  });
  return { ok: true, data: null };
}
