export const DEMO_MAX_CONCURRENT = 200;
export const DEMO_TTL_MS = 24 * 60 * 60 * 1000;
export const DEMO_JWT_TTL_MS = 1 * 60 * 60 * 1000;
export const DEMO_GLOBAL_TASK_SOFT_CAP = 1480;
export const DEMO_GLOBAL_TASK_HARD_CAP = DEMO_MAX_CONCURRENT * 37;

/** Per-entity limits enforced inside active demo sessions. */
export const DEMO_LIMITS = {
  PER_ORG_TASKS: 200,
  PER_ORG_MEMBERS: 50,
  PER_USER_ORGS: 5,
} as const;

/** Returns true if the email belongs to a demo visitor account. */
export function isDemoEmail(email: string | null | undefined): boolean {
  return !!email && email.endsWith("@demo.friendchise.app");
}
