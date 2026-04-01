import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges Tailwind CSS class names, resolving conflicts via tailwind-merge
 * and supporting conditional classes via clsx.
 *
 * @param inputs - Any mix of strings, arrays, or objects accepted by clsx.
 * @returns A single deduplicated, conflict-resolved class string.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a Date as a short localised date string.
 *
 * Centralised so the locale can be updated in one place if i18n is
 * introduced. Defaults to `"en-AU"` (dd/mm/yyyy) and UTC to keep
 * server-rendered output stable regardless of the host's system timezone.
 *
 * @param date     - The Date to format.
 * @param timeZone - IANA timezone string (default `"UTC"`).
 * @param locale   - BCP 47 locale tag (default `"en-AU"`).
 */
export function formatDate(
  date: Date,
  timeZone = "UTC",
  locale = "en-AU",
): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new TypeError("formatDate: expected a valid Date");
  }
  return date.toLocaleDateString(locale, { timeZone });
}
