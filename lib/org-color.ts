/**
 * Returns a deterministic accent color for an org based on its name.
 * Sums the UTF-16 character codes of the name and picks from a 9-color
 * palette via modulo — no extra DB field required.
 */
const PALETTE = [
  "#6366F1", // indigo
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#EF4444", // red
  "#F59E0B", // amber
  "#10B981", // emerald
  "#06B6D4", // cyan
  "#3B82F6", // blue
  "#14B8A6", // teal
] as const;

export function orgColor(name: string): string {
  const hash = name
    .split("")
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return PALETTE[hash % PALETTE.length];
}
