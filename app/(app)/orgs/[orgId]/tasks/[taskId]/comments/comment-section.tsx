"use client";

/**
 * CommentSection — stateful client shell for the task comment thread.
 *
 * Owns:
 *  - `replyOpenId`  — which top-level comment has its reply input expanded
 *  - `editingId`    — which comment is in inline-edit mode
 *  - `sortBy`       — the active ordering for the top-level comment list
 *
 * After any mutation (add / edit / delete / vote / pin) it calls
 * `router.refresh()` inside `startTransition` so the server re-fetches updated
 * data without a hard navigation.
 *
 * Renders a flat list of `CommentItem` components (each handles its own
 * replies and vote/pin/edit/delete actions), followed by the top-level
 * `CommentInput` for adding new comments.
 */
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { CommentFE } from "./types";
import { CommentItem } from "./comment-item";
import { CommentInput } from "./comment-input";

type CommentSort = "newest" | "oldest" | "top" | "bottom";

const SORT_OPTIONS: Array<{ value: CommentSort; label: string }> = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "top", label: "Highest upvotes" },
  { value: "bottom", label: "Most downvotes" },
];

interface CommentSectionProps {
  orgId: string;
  taskId: string;
  currentUserId: string | null;
  canComment: boolean;
  canManage: boolean;
  initialComments: CommentFE[];
}

function getSortValue(comment: CommentFE): number {
  return new Date(comment.createdAt).getTime();
}

function compareComments(a: CommentFE, b: CommentFE, sortBy: CommentSort) {
  if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;

  switch (sortBy) {
    case "newest":
      return getSortValue(b) - getSortValue(a);
    case "oldest":
      return getSortValue(a) - getSortValue(b);
    case "top":
      return (
        b.upvotes - a.upvotes ||
        getSortValue(b) - getSortValue(a) ||
        a.downvotes - b.downvotes
      );
    case "bottom":
      return (
        b.downvotes - a.downvotes ||
        getSortValue(b) - getSortValue(a) ||
        b.upvotes - a.upvotes
      );
  }
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
  const [sortBy, setSortBy] = useState<CommentSort>("newest");

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

  const sortedComments = useMemo(
    () => [...initialComments].sort((a, b) => compareComments(a, b, sortBy)),
    [initialComments, sortBy],
  );

  return (
    <div className="rounded-lg border bg-card scroll-mt-24" data-tour-target="task-comments-panel">
      {/* Header */}
      <div className="px-5 py-3 border-b border-border flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium">
          Comments{total > 0 ? ` (${total})` : ""}
        </h2>

        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <select
            aria-label="Sort comments"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as CommentSort)}
            className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Comment list */}
      <div className="divide-y divide-border">
        {sortedComments.length === 0 && (
          <p className="px-5 py-6 text-sm text-muted-foreground text-center">
            No comments yet.{" "}
            {canComment ? "Be the first to comment below." : ""}
          </p>
        )}
        {sortedComments.map((comment) => (
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
          <CommentInput orgId={orgId} taskId={taskId} onSuccess={refresh} />
        </div>
      )}
    </div>
  );
}
