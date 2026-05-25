/**
 * TaskComments — async server component that gates and hydrates the comment section.
 *
 * Fetches in parallel:
 *  - all top-level comments + one level of replies for the task
 *  - whether the current user's org is in the same franchise (canComment)
 *  - the current user's membership (to derive canManage)
 *
 * Converts DB rows to `CommentFE` (ISO string dates, aggregated vote counts)
 * then passes them to the `CommentSection` client component as initial data.
 * A Suspense boundary around `<TaskComments>` in the parent page provides the
 * loading fallback.
 */
import { PermissionAction } from "@prisma/client";
import { getAuthUserId } from "@/lib/authz/_shared";
import { getOrgMembership, memberHasPermission } from "@/lib/authz/_shared";
import { getTaskComments, canUserCommentOnTask } from "@/lib/services/task-comments";
import type { CommentRow } from "@/lib/services/task-comments";
import type { CommentFE } from "./types";
import { CommentSection } from "./comment-section";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toCommentFE(
  row: CommentRow,
  currentUserId: string | null,
): CommentFE {
  const votes = row.votes ?? [];
  const upvotes = votes.filter((v) => v.type === "UPVOTE").length;
  const downvotes = votes.filter((v) => v.type === "DOWNVOTE").length;
  const userVote = currentUserId
    ? (votes.find((v) => v.userId === currentUserId)?.type ?? null)
    : null;

  return {
    id: row.id,
    authorId: row.authorId,
    authorName: row.authorName,
    authorImage: row.authorImage,
    content: row.content,
    parentId: row.parentId,
    isDeleted: row.isDeleted,
    isPinned: row.isPinned,
    pinnedAt: row.pinnedAt?.toISOString() ?? null,
    editedAt: row.editedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    upvotes,
    downvotes,
    userVote,
    replies: (row.replies ?? []).map(
      (r) => toCommentFE(r, currentUserId) as Omit<CommentFE, "replies">,
    ),
  };
}

// ─── Server component ─────────────────────────────────────────────────────────

interface TaskCommentsProps {
  orgId: string;
  taskId: string;
}

export async function TaskComments({ orgId, taskId }: TaskCommentsProps) {
  const userId = await getAuthUserId();

  const [commentRows, canComment, membership] = await Promise.all([
    getTaskComments(taskId),
    userId ? canUserCommentOnTask(taskId, orgId) : Promise.resolve(false),
    userId ? getOrgMembership(orgId, userId) : Promise.resolve(null),
  ]);

  const canManage = membership
    ? await memberHasPermission(
        membership.id,
        orgId,
        PermissionAction.MANAGE_TASKS,
      )
    : false;

  const comments = commentRows.map((row) => toCommentFE(row, userId));

  return (
    <CommentSection
      orgId={orgId}
      taskId={taskId}
      currentUserId={userId}
      canComment={canComment}
      canManage={canManage}
      initialComments={comments}
    />
  );
}
