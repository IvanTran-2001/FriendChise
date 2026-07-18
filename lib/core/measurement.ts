/**
 * Client-side measurement categorization.
 *
 * `ToolItem.unit` is a free-text string in the schema (no structured
 * MeasurementType exists yet) — this util groups common unit strings into a
 * display-only category so the UI can color-code/teach measurement families
 * (weight vs volume vs count vs percent) without any schema change.
 *
 * This is intentionally non-authoritative: unrecognized strings fall back to
 * "other" rather than failing, since managers can type anything here.
 */

export type MeasurementCategory = "weight" | "volume" | "count" | "percent" | "other";

const WEIGHT_UNITS = new Set([
  "g", "gram", "grams", "kg", "kilogram", "kilograms", "mg", "milligram", "milligrams",
  "oz", "ounce", "ounces", "lb", "lbs", "pound", "pounds",
]);

const VOLUME_UNITS = new Set([
  "ml", "milliliter", "milliliters", "millilitre", "millilitres",
  "l", "liter", "liters", "litre", "litres",
  "gal", "gallon", "gallons", "fl oz", "floz", "cup", "cups",
  "tbsp", "tablespoon", "tablespoons", "tsp", "teaspoon", "teaspoons",
  "pint", "pints", "quart", "quarts",
]);

const COUNT_UNITS = new Set([
  "each", "ea", "pc", "pcs", "piece", "pieces", "unit", "units",
  "pack", "packs", "box", "boxes", "case", "cases", "dozen",
  "tray", "trays", "bag", "bags", "bottle", "bottles", "can", "cans",
]);

const PERCENT_UNITS = new Set(["%", "percent", "pct"]);

/** Categorizes a free-text unit string for display purposes only. */
export function categorizeUnit(unit: string | null | undefined): MeasurementCategory {
  const key = (unit ?? "").trim().toLowerCase();
  if (!key) return "other";
  if (PERCENT_UNITS.has(key) || key.endsWith("%")) return "percent";
  if (WEIGHT_UNITS.has(key)) return "weight";
  if (VOLUME_UNITS.has(key)) return "volume";
  if (COUNT_UNITS.has(key)) return "count";
  return "other";
}

/** Tailwind classes for a colored unit pill, keyed by measurement category. */
export const MEASUREMENT_PILL_CLASSES: Record<MeasurementCategory, string> = {
  weight: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  volume: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  count: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  percent: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  other: "bg-muted text-muted-foreground",
};

/** Convenience helper: resolves the pill classes directly from a unit string. */
export function unitPillClasses(unit: string | null | undefined): string {
  return MEASUREMENT_PILL_CLASSES[categorizeUnit(unit)];
}
