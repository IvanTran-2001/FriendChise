/**
 * @file date-utils.ts
 * Pure, timezone-aware date helpers used across the timetable feature.
 *
 * ## Storage model for live TimetableEntry records
 * All times are stored in **UTC** (world clock), not local wall-clock:
 *   - `date`         — UTC midnight of the UTC day containing the event.
 *   - `startTimeMin` — UTC minutes from that UTC midnight (0–1439).
 *
 * This means that if an org changes their timezone setting, zero data
 * migration is needed — entries are just re-displayed with the new offset.
 *
 * Template entries (which are timezone-agnostic schedules) stay as
 * local wall-clock minutes; they are converted to UTC when applied.
 *
 * Use `localToUTC` to convert user input → storage values.
 * Use `utcToLocal` to convert storage values → display values.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Returns the YYYY-MM-DD local date string for `d` in the given IANA timezone. */
export function toLocalDateStr(d: Date, tz: string): string {
  return d.toLocaleDateString("en-CA", { timeZone: tz });
}

/**
 * Returns the UTC ms timestamp for local midnight of `dateStr` (YYYY-MM-DD) in `tz`.
 * Probes at noon UTC to derive the offset robustly across DST transitions.
 */
export function localMidnightUTC(dateStr: string, tz: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  let utcMs = Date.UTC(y, m - 1, d, 0, 0, 0);
  for (let i = 0; i < 3; i += 1) {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(utcMs)).map((p) => [p.type, p.value]),
    );
    const localAsUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    const desiredAsUtc = Date.UTC(y, m - 1, d, 0, 0, 0);
    const delta = localAsUtc - desiredAsUtc;
    if (delta === 0) break;
    utcMs -= delta;
  }
  return utcMs;
}

/**
 * Counts the number of calendar days from date string `a` to `b` (b − a).
 * Uses UTC noon arithmetic so the result is independent of DST in any timezone.
 */
export function calendarDaysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round(
    (Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / MS_PER_DAY,
  );
}

/** Returns the YYYY-MM-DD that is `n` calendar days after `dateStr`. */
export function addCalendarDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().split("T")[0];
}

/** Returns the YYYY-MM-DD of Monday of the week containing `dateStr`, computed in `tz`. */
export function getMondayDateStr(dateStr: string, tz: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const probe = new Date(localMidnightUTC(dateStr, tz));
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
  }).format(probe);
  const DOW_OFFSET: Record<string, number> = {
    Sun: -6,
    Mon: 0,
    Tue: -1,
    Wed: -2,
    Thu: -3,
    Fri: -4,
    Sat: -5,
  };
  const offset = DOW_OFFSET[wd] ?? 0;
  return new Date(Date.UTC(y, m - 1, d + offset)).toISOString().split("T")[0];
}

// ---------------------------------------------------------------------------
// UTC ↔ local conversion helpers for TimetableEntry storage
// ---------------------------------------------------------------------------

const MS_PER_MIN = 60_000;

/**
 * Converts a user-supplied local date + local start minute into UTC storage values.
 *
 * @param localDateStr    - YYYY-MM-DD in the org's timezone (what the user sees)
 * @param localStartMin   - minutes from local midnight (0–1439)
 * @param tz              - IANA timezone string (e.g. "Australia/Sydney")
 * @returns `utcDate` — UTC midnight of the UTC day containing the event,
 *          `utcStartTimeMin` — minutes from that UTC midnight (0–1439)
 */
export function localToUTC(
  localDateStr: string,
  localStartMin: number,
  tz: string,
): { utcDate: Date; utcStartTimeMin: number } {
  const utcMs = localMidnightUTC(localDateStr, tz) + localStartMin * MS_PER_MIN;
  const utcDayStart = Math.floor(utcMs / MS_PER_DAY) * MS_PER_DAY;
  return {
    utcDate: new Date(utcDayStart),
    utcStartTimeMin: Math.round((utcMs - utcDayStart) / MS_PER_MIN),
  };
}

/**
 * Converts UTC storage values back to a local date string and local start minute
 * for display in the given org timezone.
 *
 * @param utcDate         - UTC midnight Date of the stored UTC day
 * @param utcStartTimeMin - minutes from UTC midnight (0–1439)
 * @param tz              - IANA timezone string
 * @returns `localDateStr` — YYYY-MM-DD as seen in the org's timezone,
 *          `localStartTimeMin` — minutes from local midnight (0–1439)
 */
export function utcToLocal(
  utcDate: Date,
  utcStartTimeMin: number,
  tz: string,
): { localDateStr: string; localStartTimeMin: number } {
  const utcMs = utcDate.getTime() + utcStartTimeMin * MS_PER_MIN;
  const d = new Date(utcMs);
  const localDateStr = d.toLocaleDateString("en-CA", { timeZone: tz });
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return { localDateStr, localStartTimeMin: hour * 60 + minute };
}
