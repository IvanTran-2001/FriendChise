/**
 * Client-facing comment shape used throughout the comments UI.
 *
 * Dates are serialized to ISO strings (vs Date objects) so this type can cross
 * the server→client boundary safely. `votes` are aggregated into `upvotes`,
 * `downvotes`, and `userVote` by the `toCommentFE` helper in `index.tsx`.
 */
import type { VoteType } from "@prisma/client";

export type CommentFE = {
  id: string;
  authorId: string | null;
  authorName: string;
  authorImage: string | null;
  content: string;
  parentId: string | null;
  isDeleted: boolean;
  isPinned: boolean;
  pinnedAt: string | null;
  editedAt: string | null;
  createdAt: string;
  upvotes: number;
  downvotes: number;
  userVote: VoteType | null;
  replies: Omit<CommentFE, "replies">[];
};
