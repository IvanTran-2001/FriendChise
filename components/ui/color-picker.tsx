"use client";

/**
 * Shared color picker used across tag, role, and task forms.
 *
 * Renders a native <input type="color"> swatch + hex label.
 * Use `randomColor()` to generate a random color from the curated palette.
 */

// ── Curated palette ───────────────────────────────────────────────────────────

export const COLOR_PALETTE = [
  "#EF4444", // Red
  "#F97316", // Orange
  "#F59E0B", // Amber
  "#22C55E", // Green
  "#14B8A6", // Teal
  "#3B82F6", // Blue
  "#6366F1", // Indigo
  "#8B5CF6", // Violet
  "#EC4899", // Pink
  "#6B7280", // Gray
  "#0F172A", // Slate dark
  "#92400E", // Brown
];

export function randomColor(): string {
  return COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)];
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
  id?: string;
}

export function ColorPicker({ value, onChange, disabled, id }: ColorPickerProps) {
  return (
    <div className="flex items-center gap-3">
      <input
        id={id}
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="h-9 w-14 cursor-pointer rounded-md border border-input p-0.5 bg-background"
      />
      <span className="text-sm text-muted-foreground font-mono">{value}</span>
    </div>
  );
}
