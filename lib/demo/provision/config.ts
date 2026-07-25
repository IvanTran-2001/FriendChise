export const DEMO_MAX_CONCURRENT = 200; // Maximum number of demo sessions allowed at once.
export const DEMO_TTL_MS = 24 * 60 * 60 * 1000; // How long a demo session stays active before expiring.
export const DEMO_JWT_TTL_MS = 1 * 60 * 60 * 1000; // How long the demo JWT stays valid.
export const DEMO_GLOBAL_TASK_SOFT_CAP = 1480; // Soft warning threshold for total demo-owned tasks.
export const DEMO_GLOBAL_TASK_HARD_CAP = DEMO_MAX_CONCURRENT * 37; // Hard stop for total demo-owned tasks.

/** Per-entity limits enforced inside active demo sessions. */
export const DEMO_LIMITS = {
  PER_ORG_TASKS: 200, // Max tasks a demo org can have.
  PER_ORG_MEMBERS: 50, // Max members a demo org can have.
  PER_USER_ORGS: 5, // Max orgs a demo account can own.
} as const;

/** Returns true if the email belongs to a demo visitor account. */
export function isDemoEmail(email: string | null | undefined): boolean {
  return !!email && email.endsWith("@demo.friendchise.app"); // Demo accounts use this email domain.
}
