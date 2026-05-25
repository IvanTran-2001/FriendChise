"use client";

/**
 * CommentSection — stateful client shell for the task comment thread.
 *
 * Owns:
 *  - `replyOpenId`  — which top-level comment has its reply input expanded
 *  - `editingId`    — which comment is in inline-edit mode
 *
 * After any mutation (add / edit / delete / vote / pin) it calls
 * `router.refresh()` inside `startTransition` so the server re-fetches updated
 * data without a hard navigation.
 *
 * Renders a flat list of `CommentItem` components (each handles its own
 * replies and vote/pin/edit/delete actions), followed by the top-level
 * `CommentInput` for adding new comments.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { CommentFE } from "./types";
import { CommentItem } from "./comment-item";
import { CommentInput } from "./comment-input";

interface CommentSectionProps {
  orgId: string;
  taskId: string;
  currentUserId: string | null;
  canComment: boolean;
  canManage: boolean;
  initialComments: CommentFE[];
}

export function CommentSection({
  orgId,
  taskId,
  currentUserId,
  canComment,
  canManage,
  initialComments,
}: CommentSectionProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [replyOpenId, setReplyOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  function refresh() {
    startTransition(() => router.refresh());
  }

  function handleToggleReply(id: string) {
    setReplyOpenId((prev) => (prev === id ? null : id));
    setEditingId(null);
  }

  function handleToggleEdit(id: string) {
    setEditingId((prev) => (prev === id ? null : id));
    setReplyOpenId(null);
  }

  const total = initialComments.reduce(
    (n, c) => n + 1 + (c.replies?.length ?? 0),
    0,
  );

  return (
    <div className="rounded-lg border bg-card">
      {/* Header */}
      <div className="px-5 py-3 border-b border-border">
        <h2 className="text-sm font-medium">
          Comments{total > 0 ? ` (${total})` : ""}
        </h2>
      </div>

      {/* Comment list */}
      <div className="divide-y divide-border">
        {initialComments.length === 0 && (
          <p className="px-5 py-6 text-sm text-muted-foreground text-center">
            No comments yet.{" "}
            {canComment ? "Be the first to comment below." : ""}
          </p>
        )}
        {initialComments.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            orgId={orgId}
            taskId={taskId}
            currentUserId={currentUserId}
            canComment={canComment}
            canManage={canManage}
            replyOpenId={replyOpenId}
            editingId={editingId}
            onToggleReply={handleToggleReply}
            onToggleEdit={handleToggleEdit}
            onRefresh={refresh}
            onError={(msg: string) => toast.error(msg)}
            className="px-5 py-4"
          />
        ))}
      </div>

      {/* New comment input */}
      {canComment && (
        <div className="px-5 py-4 border-t border-border">
          <CommentInput
            orgId={orgId}
            taskId={taskId}
            onSuccess={refresh}
          />
        </div>
      )}
    </div>
  );
}
