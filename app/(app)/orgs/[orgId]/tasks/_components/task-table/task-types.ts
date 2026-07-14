export type Task = {
  id: string;
  name: string;
  color: string;
  description: string | null;
  durationMin: number;
  minPeople: number;
  orgId: string;
  _available: boolean;
  _count: { inheritedBy: number };
  eligibility: { role: { id: string; name: string; color: string | null } }[];
  tags: { tag: { id: string; name: string; color: string } }[];
  imageSignedUrl?: string | null;
};
