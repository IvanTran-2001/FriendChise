import { data as FRANCHISEE_TASKS } from "./franchisee-tasks";
import type { FranchiseeTaskDef } from "./franchisee-tasks";

export { data as TASKS, model as TASKS_MODEL, seed as TASKS_SEED } from "./tasks";
export { data as FRANCHISEE_TASKS } from "./franchisee-tasks";
export { data as ROSTER_MEMBERS } from "./roster-members";
export { data as TIMETABLE_TEMPLATES } from "./timetable-templates";
export { data as TIMETABLE_TEMPLATE_ENTRIES } from "./timetable-template-entries";
export { data as TASK_TAG_GROUPS } from "./task-tags";
export { data as FRANCHISE_TOKENS } from "./franchise-tokens";
export { DEMO_ENTRY_PLAN } from "./entry-plan";
export { MUST_MAKE_FIRST_STEPS } from "./must-make-first";
export {
	DAY_INDEX_BY_KEY,
	FRANCHISEE_OPERATING_DAYS,
	GLOBAL_TASK_SCOPE_TASK_NAMES,
	ORGANIZATION_OPERATING_DAYS,
	WORKING_DAYS_WEEKDAY,
} from "./demo-constants";
export { comments, commentVotes } from "./comments";
export {
	conversionItems,
	conversionRates,
	conversionTemplateEntries,
	conversionTemplates,
} from "./conversions";
export { memberRoleAssignments } from "./member-role-assignments";
export { franchiseePermissions, franchiseeRoles, parentPermissions, parentRoles } from "./roles";
export type {
	TaskDef,
} from "./types";
export type { DayKey } from "./roster-members";
export type { FranchiseeTaskDef } from "./franchisee-tasks";

type FranchiseeTaskSeed = {
	model: "franchiseeTask";
	data: FranchiseeTaskDef[];
};

export const FRANCHISEE_TASKS_SEED = {
	model: "franchiseeTask",
	data: FRANCHISEE_TASKS,
} satisfies FranchiseeTaskSeed;