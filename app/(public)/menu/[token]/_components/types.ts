export type ResolvedMenuItem = {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  calories: number | null;
  notes: string | null;
  /** Fully resolved URL (signed or public). Null when no image. */
  imageUrl: string | null;
  unit: string;
};

export type ResolvedMenuTab = {
  id: string;
  name: string;
  description: string | null;
  items: ResolvedMenuItem[];
};

export type ResolvedMenuData = {
  name: string;
  description: string | null;
  orgName: string;
  orgLogoUrl: string | null;
  tabs: ResolvedMenuTab[];
  /** Items that don't belong to any tab. */
  unassignedItems: ResolvedMenuItem[];
};
