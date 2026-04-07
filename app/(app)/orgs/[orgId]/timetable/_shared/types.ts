/**
 * Shared types used by both the live timetable and the template editor.
 */

export type SharedTask = { id: string; name: string; durationMin: number };

export type SharedMembership = {
  id: string;
  user: { id: string; name: string | null };
};

/**
 * A positioned instance after column-overlap layout has been computed.
 * Generic over the instance shape so both timetable and template can use it.
 */
export type PositionedInstance<T> = {
  instance: T;
  col: number;
  totalCols: number;
};
