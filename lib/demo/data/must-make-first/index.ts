export const MUST_MAKE_FIRST_STEPS = ["organization", "roles", "memberships", "roster"] as const;

export type MustMakeFirstStep = (typeof MUST_MAKE_FIRST_STEPS)[number];