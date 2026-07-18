"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

const PRESETS = [
  { label: "Today", value: "today" },
  { label: "7 days", value: "week" },
  { label: "30 days", value: "month" },
  { label: "Year", value: "year" },
  { label: "All time", value: "lifetime" },
] as const;

function getPresetRange(preset: string): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().split("T")[0];

  switch (preset) {
    case "today":
      return { from: to, to };
    case "week": {
      const from = new Date(now);
      from.setDate(from.getDate() - 7);
      return { from: from.toISOString().split("T")[0], to };
    }
    case "month": {
      const from = new Date(now);
      from.setDate(from.getDate() - 30);
      return { from: from.toISOString().split("T")[0], to };
    }
    case "year": {
      const from = new Date(now);
      from.setFullYear(from.getFullYear() - 1);
      return { from: from.toISOString().split("T")[0], to };
    }
    case "lifetime":
      return { from: "", to: "" };
    default:
      return { from: "", to: "" };
  }
}

interface LogsDateFilterProps {
  date?: string;
  dateFrom?: string;
  dateTo?: string;
}

export function LogsDateFilter({ date, dateFrom, dateTo }: LogsDateFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function applyPreset(preset: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("date");
    params.delete("page");

    if (preset === "lifetime") {
      params.delete("dateFrom");
      params.delete("dateTo");
    } else {
      const { from, to } = getPresetRange(preset);
      params.set("dateFrom", from);
      params.set("dateTo", to);
    }

    router.push(`?${params.toString()}`);
  }

  function applyCustomRange() {
    const form = new FormData(document.querySelector("form")!);
    const from = form.get("dateFrom") as string;
    const to = form.get("dateTo") as string;

    const params = new URLSearchParams(searchParams.toString());
    params.delete("date");
    params.delete("page");

    if (from) params.set("dateFrom", from);
    else params.delete("dateFrom");
    if (to) params.set("dateTo", to);
    else params.delete("dateTo");

    router.push(`?${params.toString()}`);
  }

  const hasActiveRange = !!(dateFrom || dateTo || date);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((preset) => {
          const range = getPresetRange(preset.value);
          const isActive =
            preset.value === "lifetime"
              ? !hasActiveRange
              : dateFrom === range.from && dateTo === range.to;

          return (
            <Button
              key={preset.value}
              type="button"
              variant={isActive ? "default" : "outline"}
              size="sm"
              onClick={() => applyPreset(preset.value)}
              className="h-7 text-xs"
            >
              {preset.label}
            </Button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">or</span>
        <input
          name="dateFrom"
          type="date"
          defaultValue={dateFrom}
          className="rounded-lg border border-border/70 bg-background/80 px-2 py-1 text-base shadow-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
        />
        <span className="text-xs text-muted-foreground">to</span>
        <input
          name="dateTo"
          type="date"
          defaultValue={dateTo}
          className="rounded-lg border border-border/70 bg-background/80 px-2 py-1 text-base shadow-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={applyCustomRange}
        >
          Apply
        </Button>
      </div>
    </div>
  );
}
