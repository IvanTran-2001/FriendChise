"use client";

/**
 * CommentInput — controlled textarea + submit button for posting comments.
 *
 * Used for both top-level comments and replies. Pass `parentId` to create a
 * threaded reply. `onSuccess` is called after a successful post (e.g. to close
 * the reply input). `onCancel` is called when the user dismisses the input
 * without submitting.
 *
 * Calls `addCommentAction` — a server action that validates the content,
 * checks franchise membership, and writes to the DB.
 */
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { addCommentAction } from "@/app/actions/task-comments";

interface CommentInputProps {
  orgId: string;
  taskId: string;
  parentId?: string;
  placeholder?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function CommentInput({
  orgId,
  taskId,
  parentId,
  placeholder = "Write a comment…",
  onSuccess,
  onCancel,
}: CommentInputProps) {
  const [content, setContent] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;
    setError(null);

    startTransition(async () => {
      const result = await addCommentAction(orgId, taskId, {
        content: trimmed,
        parentId,
      });
      if (result.ok) {
        setContent("");
        onSuccess?.();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <textarea
        className="w-full min-h-18 resize-none rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        placeholder={placeholder}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        disabled={isPending}
        onKeyDown={(e) => {
          // Cmd/Ctrl+Enter submits
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            handleSubmit(e as unknown as React.FormEvent);
          }
        }}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isPending}
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          size="sm"
          disabled={!content.trim() || isPending}
        >
          {isPending ? "Posting…" : parentId ? "Reply" : "Comment"}
        </Button>
      </div>
    </form>
  );
}
