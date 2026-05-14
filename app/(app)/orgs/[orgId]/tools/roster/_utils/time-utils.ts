/**
 * Formats an integer minute offset (0–1440) as a zero-padded "HH:MM" string.
 * e.g. 90 → "01:30", 1440 → "24:00"
 */
export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60).toString().padStart(2, "0");
  const m = (min % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Returns a human-readable duration string (e.g. "7h 30m" or "8h") given start/end
 * minute offsets. Returns "" when either value is null or the duration is ≤ 0.
 */
export function hoursWorked(startMin: number | null, endMin: number | null): string {
  if (startMin === null || endMin === null) return "";
  const diff = endMin - startMin;
  if (diff <= 0) return "";
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Parses a "HH:MM" time string into a minute offset. Returns null for empty
 * strings, malformed input, or non-numeric segments.
 */
export function timeToMinutes(time: string): number | null {
  if (!time) return null;
  const parts = time.split(":");
  if (parts.length !== 2) return null;
  const [h, m] = parts.map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}
