/**
 * Well-known role keys seeded into every new org.
 *
 * These are stable string identifiers (stored in Role.key) used to look up
 * system-managed roles without relying on auto-generated IDs.
 *
 * - OWNER: created for the org creator; receives all permissions by default
 * - DEFAULT_MEMBER: baseline role assigned to newly invited members
 */
export const ROLE_KEYS = {
  OWNER: "owner",
  DEFAULT_MEMBER: "default_member",
} as const;
