"use server";

/**
 * Server actions for task comments.
 *
 * addCommentAction    — post a new top-level comment or reply (franchise member only).
 * editCommentAction   — edit own comment content.
 * deleteCommentAction — soft-delete own comment, or any comment with MANAGE_TASKS.
 * voteCommentAction   — upvote / downvote / remove vote (franchise member only).
 * pinCommentAction    — pin / unpin a top-level comment (MANAGE_TASKS required).
 */

import { PermissionAction, VoteType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOrgMemberAction } from "@/lib/authz";
import { memberHasPermission } from "@/lib/authz/_shared";
import {
  canUserCommentOnTask,
  createComment,
  editComment,
  softDeleteComment,
  voteOnComment,
  setPinComment,
} from "@/lib/services/task-comments";
import {
  addCommentSchema,
  editCommentSchema,
} from "@/lib/validators/task-comment";
import { revalidatePath } from "next/cache";

type CommentActionResult = { ok: true } | { ok: false; error: string };

// ─── Add comment ──────────────────────────────────────────────────────────────

export async function addCommentAction(
  orgId: string,
  taskId: string,
  input: { content: string; parentId?: string },
): Promise<CommentActionResult> {
  const authz = await requireOrgMemberAction(orgId);
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const parsed = addCommentSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const allowed = await canUserCommentOnTask(taskId, orgId);
  if (!allowed) return { ok: false, error: "You are not in this franchise" };

  const user = await prisma.user.findUnique({
    where: { id: authz.userId },
    select: { name: true, image: true },
  });

  const result = await createComment(
    taskId,
    orgId,
    authz.userId,
    user?.name ?? "Unknown",
    user?.image ?? null,
    parsed.data,
  );
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/orgs/${orgId}/tasks/${taskId}`);
  return { ok: true };
}

// ─── Edit comment ─────────────────────────────────────────────────────────────

export async function editCommentAction(
  orgId: string,
  taskId: string,
  commentId: string,
  input: { content: string },
): Promise<CommentActionResult> {
  const authz = await requireOrgMemberAction(orgId);
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const parsed = editCommentSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const result = await editComment(commentId, authz.userId, parsed.data);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/orgs/${orgId}/tasks/${taskId}`);
  return { ok: true };
}

// ─── Delete comment ───────────────────────────────────────────────────────────

export async function deleteCommentAction(
  orgId: string,
  taskId: string,
  commentId: string,
): Promise<CommentActionResult> {
  const authz = await requireOrgMemberAction(orgId);
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const canManage = await memberHasPermission(
    authz.membership.id,
    orgId,
    PermissionAction.MANAGE_TASKS,
  );

  const result = await softDeleteComment(commentId, authz.userId, canManage);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/orgs/${orgId}/tasks/${taskId}`);
  return { ok: true };
}

// ─── Vote ─────────────────────────────────────────────────────────────────────

export async function voteCommentAction(
  orgId: string,
  taskId: string,
  commentId: string,
  type: VoteType | null,
): Promise<CommentActionResult> {
  const authz = await requireOrgMemberAction(orgId);
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const allowed = await canUserCommentOnTask(taskId, orgId);
  if (!allowed) return { ok: false, error: "Unauthorized" };

  const result = await voteOnComment(commentId, authz.userId, type);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/orgs/${orgId}/tasks/${taskId}`);
  return { ok: true };
}

// ─── Pin ──────────────────────────────────────────────────────────────────────

export async function pinCommentAction(
  orgId: string,
  taskId: string,
  commentId: string,
  isPinned: boolean,
): Promise<CommentActionResult> {
  const authz = await requireOrgMemberAction(orgId);
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const canManage = await memberHasPermission(
    authz.membership.id,
    orgId,
    PermissionAction.MANAGE_TASKS,
  );
  if (!canManage) return { ok: false, error: "Insufficient permissions" };

  const result = await setPinComment(commentId, isPinned);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/orgs/${orgId}/tasks/${taskId}`);
  return { ok: true };
}
