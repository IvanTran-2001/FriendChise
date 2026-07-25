/**
 * Mirrors Prisma enums that need to be used in client components.
 * Importing directly from @prisma/client is server-only and will fail
 * in "use client" files with Turbopack / edge bundlers.
 */

export const PERMISSION_ACTIONS = [
	"MANAGE_MEMBERS",
	"MANAGE_ROLES",
	"MANAGE_TIMETABLE",
	"MANAGE_TASKS",
	"MANAGE_SETTINGS",
	"VIEW_TIMETABLE",
] as const;

export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];
