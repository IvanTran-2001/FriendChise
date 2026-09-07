/**
 * Seeded user identifiers and emails for development and testing.
 * All non-owner emails are automatically namespaced via seedEmail() from seed-namespace.ts.
 * The MainDev owner account is a fixed test account so dev sign-in and seeding
 * always point at the same login.
 *
 * Usage in tests:
 *   import { SEEDED_USERS } from "@/lib/seeded-users";
 *   const email = SEEDED_USERS.owner.email;
 */

import { MAIN_DEV_EMAIL, seedEmail, seedDisplayName } from "./seed-namespace";

export const SEEDED_USERS = {
	owner: {
		id: "owner",
		email: MAIN_DEV_EMAIL,
		displayName: seedDisplayName("MainDev"),
	},
	jordan: {
		id: "jordan",
		email: seedEmail("jordan"),
		displayName: seedDisplayName("Jordan"),
	},
	casey: {
		id: "casey",
		email: seedEmail("casey"),
		displayName: seedDisplayName("Casey"),
	},
	riley: {
		id: "riley",
		email: seedEmail("riley"),
		displayName: seedDisplayName("Riley"),
	},
	morgan: {
		id: "morgan",
		email: seedEmail("morgan"),
		displayName: seedDisplayName("Morgan"),
	},
	alex: {
		id: "alex",
		email: seedEmail("alex"),
		displayName: seedDisplayName("Alex"),
	},
	taylor: {
		id: "taylor",
		email: seedEmail("taylor"),
		displayName: seedDisplayName("Taylor"),
	},
	sam: {
		id: "sam",
		email: seedEmail("sam"),
		displayName: seedDisplayName("Sam"),
	},
	quinn: {
		id: "quinn",
		email: seedEmail("quinn"),
		displayName: seedDisplayName("Quinn"),
	},
} as const;

export type SeededUserId = keyof typeof SEEDED_USERS;
