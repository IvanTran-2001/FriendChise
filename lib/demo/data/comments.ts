import { VoteType } from "@prisma/client";

export type CommentDef = {
  taskName: string;
  author: string;
  content: string;
  createdOffsetHours: number;
  parentIndex?: number;
  pinned?: boolean;
  pinnedOffsetDays?: number;
};

export type VoteDef = {
  commentIndex: number;
  user: "owner" | "jordan" | "casey" | "riley" | "morgan" | "alex" | "taylor" | "sam" | "quinn";
  type: VoteType;
};

export const comments: CommentDef[] = [
  {
    taskName: "Open Shop Checklist",
    author: "Jordan",
    content: "Make sure the fryer is fully up to temp before opening — takes extra time on cold mornings. Check the thermometer, not just the indicator light.",
    createdOffsetHours: -120,
  },
  {
    taskName: "Open Shop Checklist",
    author: "Casey",
    content: "Also double-check the float in the till. Had it short by $20 last Monday.",
    parentIndex: 0,
    createdOffsetHours: -119.3333333333,
  },
  {
    taskName: "Open Shop Checklist",
    author: "Riley",
    content: "POS needs a restart roughly once a week. Best to do it before opening rather than mid-rush.",
    createdOffsetHours: -72,
  },
  {
    taskName: "Fry Morning Batches",
    author: "Demo User",
    content: "⚠️ Never exceed 6 rings per side. Oil can overflow and become a fire hazard — this has happened before. Pinning this as a permanent reminder.",
    pinned: true,
    pinnedOffsetDays: -7,
    createdOffsetHours: -192,
  },
  {
    taskName: "Fry Morning Batches",
    author: "Casey",
    content: "If the dough is under-proofed it'll sink in the oil. Do the poke test — press gently and it should spring back slowly.",
    createdOffsetHours: -48,
  },
  {
    taskName: "Fry Morning Batches",
    author: "Jordan",
    content: "Good tip — especially in winter when the proofer runs cold.",
    parentIndex: 4,
    createdOffsetHours: -46,
  },
  {
    taskName: "Close Shop Checklist",
    author: "Riley",
    content: "Don't skip logging wastage in the shift register — management checks this every morning.",
    createdOffsetHours: -24,
  },
  {
    taskName: "Recipe: White Choc Biscoff Frappe",
    author: "Alex",
    content: "This one moves fastest on weekends. Get the Biscoff drizzle prepped in advance — you won't have time during the rush.",
    createdOffsetHours: -6,
  },
  {
    taskName: "Clean & Tidy Storeroom",
    author: "Riley",
    content: "The cleaning aisle gets crowded fast, so leave the mop bucket by the back wall and keep the walkway clear for deliveries.",
    createdOffsetHours: -36,
  },
  {
    taskName: "Clean & Tidy Storeroom",
    author: "Casey",
    content: "Can someone also check the labels on the storage tubs? A few of them were swapped after the last stocktake.",
    parentIndex: 8,
    createdOffsetHours: -35.5,
  },
  {
    taskName: "Clean & Tidy Storeroom",
    author: "Jordan",
    content: "The back shelf is still missing a bin for the spare cloths. I can add one after the lunch rush if nobody gets to it first.",
    createdOffsetHours: -28,
  },
  {
    taskName: "Fry Morning Batches",
    author: "Alex",
    content: "We get the best results if we fry the first trays in smaller batches and keep the oil at a steady temp. If it drops below target, the first few rings turn pale and slow down the whole open.",
    pinned: true,
    pinnedOffsetDays: -2,
    createdOffsetHours: -18,
  },
  {
    taskName: "Fry Morning Batches",
    author: "Riley",
    content: "Also rotate the oldest tray to the front. It cuts waste because staff stop reaching for the freshest rings first, and the display looks fuller for longer.",
    createdOffsetHours: -17.5,
  },
  {
    taskName: "Fry Morning Batches",
    author: "Casey",
    content: "If we know it's a heavy delivery morning, I prep an extra tray before opening and hold it back. That gives us a buffer without overfrying too early.",
    createdOffsetHours: -16.5,
  },
  {
    taskName: "Fry Morning Batches",
    author: "Jordan",
    content: "Don't forget to log the first oil check right after the initial batch. It catches temp drift before the rush starts.",
    createdOffsetHours: -15.5,
  },
  {
    taskName: "Fry Morning Batches",
    author: "Casey",
    content: "We keep the backup tray on the lowest rack so it warms a little before service. That helps the first refill stay consistent instead of dropping the oil temp too fast.",
    pinned: true,
    pinnedOffsetDays: -1,
    createdOffsetHours: -14,
  },
  {
    taskName: "Fry Morning Batches",
    author: "Alex",
    content: "I usually just load the trays as full as possible and fix the uneven ones later. It saves a bit of time at the start, even if the batch cooks less evenly.",
    createdOffsetHours: -13.5,
  },
];

export const commentVotes: VoteDef[] = [
  { commentIndex: 0, user: "owner", type: VoteType.UPVOTE },
  { commentIndex: 2, user: "owner", type: VoteType.UPVOTE },
  { commentIndex: 4, user: "owner", type: VoteType.UPVOTE },
  { commentIndex: 3, user: "owner", type: VoteType.UPVOTE },
  { commentIndex: 8, user: "owner", type: VoteType.UPVOTE },
  { commentIndex: 10, user: "owner", type: VoteType.DOWNVOTE },
  { commentIndex: 11, user: "owner", type: VoteType.UPVOTE },
  { commentIndex: 12, user: "owner", type: VoteType.UPVOTE },
  { commentIndex: 13, user: "owner", type: VoteType.UPVOTE },
  { commentIndex: 14, user: "owner", type: VoteType.DOWNVOTE },
  { commentIndex: 15, user: "owner", type: VoteType.UPVOTE },
  { commentIndex: 16, user: "owner", type: VoteType.DOWNVOTE },
];
