"use client";

/**
 * Shared scheduling pickers for task duration and preferred start time.
 *
 * These controls are used by both create and edit flows so the sidebar stays
 * visually and behaviorally aligned between the two forms.
 */

import { Input } from "@/components/ui/input";

export function TaskDurationPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (min: number) => void;
}) {
  // Duration is kept as a single number of minutes and split into hour/minute
  // selects here so both task forms can share the same derived display.
  const hours = Math.floor(value / 60);
  const rawMinutes = value % 60;
  const minutes = Math.max(0, Math.min(55, Math.round(rawMinutes / 5) * 5));
  const totalMin = hours * 60 + minutes;

  return (
    <div className="flex items-center gap-2">
      <select
        value={hours}
        onChange={(e) => {
          const nextHours = Number(e.target.value);
          onChange(nextHours * 60 + minutes);
        }}
        className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
        aria-label="Hours"
      >
        {Array.from({ length: 24 }, (_, i) => (
          <option key={i} value={i}>
            {i}h
          </option>
        ))}
      </select>
      <select
        value={minutes}
        onChange={(e) => {
          const nextMinutes = Number(e.target.value);
          onChange(hours * 60 + nextMinutes);
        }}
        className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
        aria-label="Minutes"
      >
        {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
          <option key={m} value={m}>
            {m}m
          </option>
        ))}
      </select>
      <span className="text-xs text-muted-foreground">
        {totalMin} min total
      </span>
    </div>
  );
}

export function TaskStartTimePicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (min: number | null) => void;
}) {
  // Store start time in minutes from midnight, but render it as a native time
  // input so the browser handles the accessibility and parsing details.
  const toHHMM = (min: number) => {
    const hours = Math.floor(min / 60).toString().padStart(2, "0");
    const minutes = (min % 60).toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  return (
    <Input
      type="time"
      value={value != null ? toHHMM(value) : ""}
      onChange={(e) => {
        const raw = e.target.value;
        if (!raw) {
          onChange(null);
          return;
        }
        const [hours, minutes] = raw.split(":").map(Number);
        onChange(hours * 60 + minutes);
      }}
      className="w-40"
    />
  );
}