"use client";

/**
 * CommentItem — renders one comment (top-level or reply) with all its actions.
 *
 * Features:
 *  - Soft-deleted comments show a "[deleted]" tombstone instead of content.
 *  - Inline edit mode replaces the content with a `CommentInput` pre-filled
 *    with the current text.
 *  - Pinned indicator and Pin / Unpin toggle for MANAGE_TASKS holders.
 *  - Up/down vote buttons with optimistic UI (useOptimistic); actual vote is
 *    persisted via `voteCommentAction`.
 *  - Reply expansion — clicking "Reply" opens a nested `CommentInput`.
 *  - ··· dropdown menu for Edit, Delete (own comments) or Delete (canManage).
 *
 * Sub-component `Avatar` renders a profile image or a two-letter initial
 * fallback at two sizes (sm / md).
 */
import { useState, useTransition, useOptimistic } from "react";
import { useRouter } from "next/navigation";
import { ThumbsUp, ThumbsDown, Pin, PinOff, Pencil, Trash2, CornerDownRight, MoreHorizontal } from "lucide-react";
import { VoteType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/core/utils";
import {
  voteCommentAction,
  deleteCommentAction,
  editCommentAction,
  pinCommentAction,
} from "@/app/actions/task-comments";
import { CommentInput } from "./comment-input";
import type { CommentFE } from "./types";

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({
  name,
  image,
  size = "sm",
}: {
  name: string;
  image: string | null;
  size?: "sm" | "xs";
}) {
  const dim = size === "xs" ? "w-6 h-6 text-[10px]" : "w-8 h-8 text-xs";
  // Derive a hue from the name for a consistent color
  const hue = name
    .split("")
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 360;

  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt={name}
        className={cn("rounded-full object-cover shrink-0", dim)}
      />
    );
  }
  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-medium text-white shrink-0",
        dim,
      )}
      style={{ backgroundColor: `hsl(${hue}, 55%, 52%)` }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// ─── Relative time ────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

// ─── Inline edit form ─────────────────────────────────────────────────────────

function InlineEdit({
  orgId,
  taskId,
  commentId,
  defaultContent,
  onSuccess,
  onCancel,
}: {
  orgId: string;
  taskId: string;
  commentId: string;
  defaultContent: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [content, setContent] = useState(defaultContent);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || trimmed === defaultContent) { onCancel(); return; }
    startTransition(async () => {
      const result = await editCommentAction(orgId, taskId, commentId, { content: trimmed });
      if (result.ok) onSuccess();
      else setError(result.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 mt-2">
      <textarea
        className="w-full min-h-18 resize-none rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        disabled={isPending}
        autoFocus
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={!content.trim() || isPending}>
          {isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}

// ─── CommentItem ──────────────────────────────────────────────────────────────

interface CommentItemProps {
  comment: CommentFE | Omit<CommentFE, "replies">;
  orgId: string;
  taskId: string;
  currentUserId: string | null;
  canComment: boolean;
  canManage: boolean;
  isReply?: boolean;
  /** id of the comment whose reply input is currently open (top-level orchestration) */
  replyOpenId: string | null;
  editingId: string | null;
  onToggleReply: (id: string) => void;
  onToggleEdit: (id: string) => void;
  onRefresh: () => void;
  onError: (msg: string) => void;
  className?: string;
}

export function CommentItem({
  comment,
  orgId,
  taskId,
  currentUserId,
  canComment,
  canManage,
  isReply = false,
  replyOpenId,
  editingId,
  onToggleReply,
  onToggleEdit,
  onRefresh,
  onError,
  className,
}: CommentItemProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const isEditing = editingId === comment.id;
  const isReplyOpen = replyOpenId === comment.id;
  const isOwn = currentUserId != null && comment.authorId === currentUserId;

  // ── Optimistic vote state ────────────────────────────────────────────────
  const [optimistic, dispatchVote] = useOptimistic(
    { userVote: comment.userVote, upvotes: comment.upvotes, downvotes: comment.downvotes },
    (
      _,
      newVote: VoteType | null,
    ) => {
      const prev = comment.userVote;
      let up = comment.upvotes;
      let down = comment.downvotes;
      if (prev === "UPVOTE") up--;
      if (prev === "DOWNVOTE") down--;
      if (newVote === "UPVOTE") up++;
      if (newVote === "DOWNVOTE") down++;
      return { userVote: newVote, upvotes: up, downvotes: down };
    },
  );

  function handleVote(type: VoteType) {
    // Bail out if not logged in or doesn't have comment permission
    if (!currentUserId || !canComment) return;
    // Toggle: clicking same vote removes it
    const newType = optimistic.userVote === type ? null : type;
    startTransition(async () => {
      dispatchVote(newType);
      const result = await voteCommentAction(orgId, taskId, comment.id, newType);
      if (result.ok) router.refresh();
      else onError(result.error);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteCommentAction(orgId, taskId, comment.id);
      if (result.ok) onRefresh();
      else onError(result.error);
    });
  }

  function handlePin(pin: boolean) {
    startTransition(async () => {
      const result = await pinCommentAction(orgId, taskId, comment.id, pin);
      if (result.ok) onRefresh();
      else onError(result.error);
    });
  }

  const replies = "replies" in comment ? comment.replies : [];

  return (
    <div className={className}>
      {/* Main comment row */}
      <div className="flex gap-3">
        <Avatar
          name={comment.authorName}
          image={comment.authorImage}
          size={isReply ? "xs" : "sm"}
        />

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-medium">{comment.authorName}</span>
            <span className="text-xs text-muted-foreground">
              {timeAgo(comment.createdAt)}
            </span>
            {comment.editedAt && (
              <span className="text-xs text-muted-foreground">(edited)</span>
            )}
            {"isPinned" in comment && comment.isPinned && (
              <span className="inline-flex items-center gap-0.5 text-xs font-medium text-amber-600">
                <Pin className="w-3 h-3" />
                Pinned
              </span>
            )}
          </div>

          {/* Content or edit form */}
          {isEditing ? (
            <InlineEdit
              orgId={orgId}
              taskId={taskId}
              commentId={comment.id}
              defaultContent={comment.content}
              onSuccess={() => { onToggleEdit(comment.id); onRefresh(); }}
              onCancel={() => onToggleEdit(comment.id)}
            />
          ) : comment.isDeleted ? (
            <p className="text-sm text-muted-foreground italic mt-1">
              This comment was deleted.
            </p>
          ) : (
            <p className="text-sm mt-1 whitespace-pre-wrap wrap-break-word">
              {comment.content}
            </p>
          )}

          {/* Actions row */}
          {!isEditing && (
            <div className="flex items-center gap-1 mt-2 -ml-1">
              {/* Upvote */}
              <button
                onClick={() => handleVote("UPVOTE")}
                disabled={!currentUserId || !canComment}
                className={cn(
                  "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors",
                  optimistic.userVote === "UPVOTE"
                    ? "text-blue-600 bg-blue-50 dark:bg-blue-950"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  (!currentUserId || !canComment) && "cursor-default",
                )}
              >
                <ThumbsUp className="w-3.5 h-3.5" />
                {optimistic.upvotes > 0 && optimistic.upvotes}
              </button>

              {/* Downvote */}
              <button
                onClick={() => handleVote("DOWNVOTE")}
                disabled={!currentUserId || !canComment}
                className={cn(
                  "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors",
                  optimistic.userVote === "DOWNVOTE"
                    ? "text-red-600 bg-red-50 dark:bg-red-950"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  (!currentUserId || !canComment) && "cursor-default",
                )}
              >
                <ThumbsDown className="w-3.5 h-3.5" />
                {optimistic.downvotes > 0 && optimistic.downvotes}
              </button>

              {/* Reply button — only on top-level, not deleted, canComment */}
              {!isReply && !comment.isDeleted && canComment && (
                <button
                  onClick={() => onToggleReply(comment.id)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors",
                    isReplyOpen
                      ? "text-foreground bg-muted"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                >
                  <CornerDownRight className="w-3.5 h-3.5" />
                  Reply
                </button>
              )}

              {/* Edit / Delete / Pin — own comment or manager */}
              {!comment.isDeleted && (isOwn || canManage) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="inline-flex items-center rounded px-1 py-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      aria-label="Comment actions"
                    >
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-36">
                    {isOwn && (
                      <DropdownMenuItem onClick={() => onToggleEdit(comment.id)}>
                        <Pencil className="w-3.5 h-3.5 mr-2" />
                        Edit
                      </DropdownMenuItem>
                    )}
                    {canManage && !isReply && (
                      <DropdownMenuItem
                        onClick={() =>
                          handlePin(!("isPinned" in comment && comment.isPinned))
                        }
                      >
                        {"isPinned" in comment && comment.isPinned ? (
                          <>
                            <PinOff className="w-3.5 h-3.5 mr-2" />
                            Unpin
                          </>
                        ) : (
                          <>
                            <Pin className="w-3.5 h-3.5 mr-2" />
                            Pin
                          </>
                        )}
                      </DropdownMenuItem>
                    )}
                    {(isOwn || canManage) && (
                      <DropdownMenuItem
                        onClick={handleDelete}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}

          {/* Inline reply input */}
          {isReplyOpen && !isReply && (
            <div className="mt-3">
              <CommentInput
                orgId={orgId}
                taskId={taskId}
                parentId={comment.id}
                placeholder="Write a reply…"
                onSuccess={() => { onToggleReply(comment.id); onRefresh(); }}
                onCancel={() => onToggleReply(comment.id)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Replies */}
      {replies.length > 0 && (
        <div className="ml-11 mt-3 flex flex-col gap-3">
          {replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              orgId={orgId}
              taskId={taskId}
              currentUserId={currentUserId}
              canComment={canComment}
              canManage={canManage}
              isReply
              replyOpenId={replyOpenId}
              editingId={editingId}
              onToggleReply={onToggleReply}
              onToggleEdit={onToggleEdit}
              onRefresh={onRefresh}
              onError={onError}
            />
          ))}
        </div>
      )}
    </div>
  );
}
