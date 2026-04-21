/**
 * Shared types used by both the live timetable and the template editor.
 */

export type SharedTask = {
  id: string;
  name: string;
  durationMin: number;
  color?: string | null;
  roleColor?: string | null;
  roleName?: string | null;
};

export type SharedMembership = {
  id: string;
  botName?: string | null;
  user: { id: string; name: string | null } | null;
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
