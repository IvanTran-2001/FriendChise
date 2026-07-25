export type Task = {
  id: string;
  name: string;
  color: string;
  description: string | null;
  createdAt: Date | string;
  durationMin: number;
  minPeople: number;
  orgId: string;
  _available: boolean;
  _count: { inheritedBy: number };
  eligibility: { role: { id: string; name: string; color: string | null } }[];
  tags: { tag: { id: string; name: string; color: string } }[];
  imageSignedUrl?: string | null;
  comments?: {
    id: string;
    content: string;
    authorName: string;
    authorImage: string | null;
    createdAt: Date | string;
    pinnedAt: Date | string | null;
  }[];
};
