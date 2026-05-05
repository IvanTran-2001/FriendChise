import { rawTimeZones } from "@vvo/tzdb";

function fmtOffset(minutes: number): string {
  const sign = minutes >= 0 ? "+" : "-";
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60)
    .toString()
    .padStart(2, "0");
  const m = (abs % 60).toString().padStart(2, "0");
  return `UTC${sign}${h}:${m}`;
}

/**
 * Pre-built timezone option list derived from @vvo/tzdb.
 * Imported here (server-only) so the 600KB dataset never enters the client bundle.
 * Pass this as a prop to <TimezoneSelect timezones={TIMEZONES} />.
 */
export const TIMEZONES = rawTimeZones.map((tz) => ({
  value: tz.name,
  label: `(${fmtOffset(tz.rawOffsetInMinutes)}) ${tz.alternativeName} — ${tz.mainCities[0] ?? tz.name}`,
  search:
    `${tz.name} ${tz.alternativeName} ${tz.mainCities.join(" ")} ${tz.countryName}`.toLowerCase(),
}));

export type TimezoneOption = (typeof TIMEZONES)[number];
