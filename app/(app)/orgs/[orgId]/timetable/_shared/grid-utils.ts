/**
 * Pure utility functions shared by the live timetable and template editor grids.
 */

export const HOUR_HEIGHT = 150; // px per hour
export const SNAP_MIN = 15;

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function minToHHMM(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

export function hhmmToMin(hhmm: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function snapMin(raw: number): number {
  return Math.max(0, Math.min(1439, Math.round(raw / SNAP_MIN) * SNAP_MIN));
}

export function calcDropTimeMin(
  clientY: number,
  colEl: Element,
  startHour = 0,
  offsetMin = 0,
): number {
  const rect = colEl.getBoundingClientRect();
  return snapMin(((clientY - rect.top) / HOUR_HEIGHT) * 60 + startHour * 60 - offsetMin);
}

/** Adds `n` calendar days to a YYYY-MM-DD date string (UTC arithmetic). */
export function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split("T")[0];
}

/** Returns true if `dateStr` is today in the browser's local timezone. */
export function isToday(dateStr: string): boolean {
  return new Date().toLocaleDateString("en-CA") === dateStr;
}

/** Formats a 7-day week as "Mon D – Mon D, YYYY". */
export function formatWeekRange(weekStart: string): string {
  const s = new Date(weekStart + "T00:00:00Z");
  const e = new Date(addDays(weekStart, 6) + "T00:00:00Z");
  return `${MONTH_NAMES[s.getUTCMonth()]} ${s.getUTCDate()} \u2013 ${MONTH_NAMES[e.getUTCMonth()]} ${e.getUTCDate()}, ${e.getUTCFullYear()}`;
}

/** Returns the short weekday name for a YYYY-MM-DD date string (UTC). */
export function getDayName(dateStr: string): string {
  return WEEKDAY_NAMES[new Date(dateStr + "T00:00:00Z").getUTCDay()];
}

export function getMonthName(monthIndex: number): string {
  return MONTH_NAMES[monthIndex];
}

/** Groups items by a string key derived from each item. */
export function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(item);
  }
  return map;
}

/**
 * Assigns non-overlapping column slots to items within a single column.
 * Items are sorted by startTimeMin; overlapping ones share width proportionally.
 */
export function assignColumns<T extends { startTimeMin: number; task: { durationMin: number } }>(
  items: T[],
): Array<{ instance: T; col: number; totalCols: number }> {
  const sorted = [...items].sort((a, b) => a.startTimeMin - b.startTimeMin);
  const colEnds: number[] = [];

  const positioned = sorted.map((inst) => {
    const endMin = inst.startTimeMin + inst.task.durationMin;
    let col = colEnds.findIndex((e) => e <= inst.startTimeMin);
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(endMin);
    } else {
      colEnds[col] = endMin;
    }
    return { instance: inst, col, totalCols: 0 };
  });

  const totalCols = Math.max(colEnds.length, 1);
  return positioned.map((p) => ({ ...p, totalCols }));
}
