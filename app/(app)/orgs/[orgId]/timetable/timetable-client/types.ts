import type { SharedTask } from "../_shared/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ClientTask = SharedTask;

/** A membership with its associated roles, used to populate assignee dropdowns. */
export type ClientMembership = {
  id: string;
  user: { id: string; name: string | null };
  roles: { id: string; name: string; color: string | null }[];
};

/**
 * A timetable entry shaped for client rendering.
 * Times (`startTimeMin`) are in local wall-clock minutes after UTC→local
 * conversion by the server page. `date` is a local YYYY-MM-DD string.
 * `isProjected` marks entries synthesised from a template that haven't
 * been persisted as live entries yet (future feature placeholder).
 */
export type ClientTimetableInstance = {
  id: string;
  taskId: string;
  date: string;
  startTimeMin: number;
  taskColor?: string | null;
  isProjected?: boolean;
  status: "TODO" | "IN_PROGRESS" | "DONE" | "SKIPPED";
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  task: {
    id: string;
    title: string;
    durationMin: number;
    preferredStartTimeMin: number | null;
  };
  assignees: Array<{
    id: string;
    membership: { id: string; user: { id: string; name: string | null } };
  }>;
};
