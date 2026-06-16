"use client";

import { useMemo, useState } from "react";
import { CalendarRange, LineChart, Users, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminGrowthChart } from "./admin-growth-chart";

export type UserGrowthRecord = {
  createdAt: string;
  isDemo: boolean;
};

type RangeKey = "day" | "7d" | "month" | "6m" | "year" | "lifetime";
type Granularity = "hour" | "day" | "month";

type Bucket = {
  key: string;
  label: string;
  total: number;
  demo: number;
};

const RANGE_OPTIONS: Array<{ key: RangeKey; label: string }> = [
  { key: "day", label: "Last day" },
  { key: "7d", label: "7 days" },
  { key: "month", label: "Month" },
  { key: "6m", label: "6 months" },
  { key: "year", label: "Year" },
  { key: "lifetime", label: "Lifetime" },
];

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfHour(date: Date) {
  const next = new Date(date);
  next.setMinutes(0, 0, 0);
  return next;
}

function startOfMonth(date: Date) {
  const next = new Date(date);
  next.setDate(1);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addHours(date: Date, hours: number) {
  const next = new Date(date);
  next.setHours(next.getHours() + hours);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function bucketKey(date: Date, granularity: Granularity) {
  if (granularity === "hour") {
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
  }
  if (granularity === "day") {
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  }
  return `${date.getFullYear()}-${date.getMonth()}`;
}

function formatHourLabel(date: Date) {
  return date.toLocaleTimeString("en-AU", { hour: "numeric" }).replace(/^0/, "");
}

function formatDayLabel(date: Date) {
  return date.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
  });
}

function formatMonthLabel(date: Date, long = false) {
  return date.toLocaleDateString("en-AU", {
    month: "short",
    year: long ? "numeric" : undefined,
  });
}

function getRangeConfig(records: UserGrowthRecord[], range: RangeKey) {
  const now = new Date();
  let granularity: Granularity;
  let buckets: Bucket[] = [];

  if (range === "day") {
    granularity = "hour";
    const start = startOfHour(addHours(now, -23));
    buckets = Array.from({ length: 24 }, (_, index) => {
      const bucketStart = addHours(start, index);
      return {
        key: bucketKey(bucketStart, granularity),
        label: formatHourLabel(bucketStart),
        total: 0,
        demo: 0,
      };
    });
  } else if (range === "7d") {
    granularity = "day";
    const start = startOfDay(addDays(now, -6));
    buckets = Array.from({ length: 7 }, (_, index) => {
      const bucketStart = addDays(start, index);
      return {
        key: bucketKey(bucketStart, granularity),
        label: formatDayLabel(bucketStart),
        total: 0,
        demo: 0,
      };
    });
  } else if (range === "month") {
    granularity = "day";
    const start = startOfDay(addDays(now, -29));
    buckets = Array.from({ length: 30 }, (_, index) => {
      const bucketStart = addDays(start, index);
      return {
        key: bucketKey(bucketStart, granularity),
        label: formatDayLabel(bucketStart),
        total: 0,
        demo: 0,
      };
    });
  } else if (range === "6m") {
    granularity = "month";
    const start = startOfMonth(addMonths(now, -5));
    buckets = Array.from({ length: 6 }, (_, index) => {
      const bucketStart = addMonths(start, index);
      return {
        key: bucketKey(bucketStart, granularity),
        label: formatMonthLabel(bucketStart),
        total: 0,
        demo: 0,
      };
    });
  } else if (range === "year") {
    granularity = "month";
    const start = startOfMonth(addMonths(now, -11));
    buckets = Array.from({ length: 12 }, (_, index) => {
      const bucketStart = addMonths(start, index);
      return {
        key: bucketKey(bucketStart, granularity),
        label: formatMonthLabel(bucketStart),
        total: 0,
        demo: 0,
      };
    });
  } else {
    granularity = "month";
    const firstRecord = records[0];
    const start = firstRecord ? startOfMonth(new Date(firstRecord.createdAt)) : startOfMonth(now);
    const current = startOfMonth(now);
    const cursor = new Date(start);

    while (cursor <= current) {
      buckets.push({
        key: bucketKey(cursor, granularity),
        label: formatMonthLabel(cursor, false),
        total: 0,
        demo: 0,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  const bucketIndex = new Map<string, number>();
  buckets.forEach((bucket, index) => bucketIndex.set(bucket.key, index));

  for (const record of records) {
    const createdAt = new Date(record.createdAt);
    const key = bucketKey(createdAt, granularity);
    const bucket = bucketIndex.get(key);
    if (bucket === undefined) continue;
    buckets[bucket].total += 1;
    if (record.isDemo) buckets[bucket].demo += 1;
  }

  return buckets;
}

// Computes a nice y-axis ceiling and evenly-spaced tick values.
function computeYScale(dataMax: number): { scale: number; ticks: number[] } {
  if (dataMax === 0) return { scale: 5, ticks: [0, 1, 2, 3, 4, 5] };
  if (dataMax <= 5) {
    return { scale: dataMax, ticks: Array.from({ length: dataMax + 1 }, (_, i) => i) };
  }
  const rawStep = dataMax / 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  let step = magnitude;
  const norm = rawStep / magnitude;
  if (norm > 5) step = 10 * magnitude;
  else if (norm > 2) step = 5 * magnitude;
  else if (norm > 1) step = 2 * magnitude;
  const scale = Math.ceil(dataMax / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= scale; v += step) ticks.push(v);
  return { scale, ticks };
}

// Returns which bucket indexes should show an x-axis label, tuned per range.
function getXLabelIndexes(range: RangeKey, pointCount: number): number[] {
  if (pointCount === 0) return [];
  const all = Array.from({ length: pointCount }, (_, i) => i);
  switch (range) {
    case "day":
      // 24 hour buckets — label every 4 hours
      return all.filter((i) => i % 4 === 0 || i === pointCount - 1);
    case "7d":
      // 7 day buckets — label all
      return all;
    case "month":
      // 30 day buckets — label every 7 days
      return all.filter((i) => i % 7 === 0 || i === pointCount - 1);
    case "6m":
    case "year":
      // 6 or 12 month buckets — label all
      return all;
    default: {
      // lifetime — cap at ~8 labels
      if (pointCount <= 8) return all;
      const step = Math.ceil(pointCount / 7);
      return all.filter((i) => i % step === 0 || i === pointCount - 1);
    }
  }
}

// Uses the shared chart scale so lines, grid lines, and dots all align.
function linePath(points: Bucket[], selector: "total" | "demo", scale: number) {
  if (points.length === 0) return "";
  const step = points.length > 1 ? 100 / (points.length - 1) : 0;
  return points
    .map((point, index) => {
      const x = points.length === 1 ? 50 : index * step;
      const y = 34 - (point[selector] / scale) * 28;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

export function AdminUserGrowthCard({ records }: { records: UserGrowthRecord[] }) {
  const [range, setRange] = useState<RangeKey>("month");

  const points = useMemo(() => getRangeConfig(records, range), [records, range]);
  const selectedTotals = useMemo(
    () =>
      points.reduce(
        (acc, point) => {
          acc.total += point.total;
          acc.demo += point.demo;
          return acc;
        },
        { total: 0, demo: 0 },
      ),
    [points],
  );

  const dataMax = Math.max(0, ...points.map((point) => Math.max(point.total, point.demo)));
  const { scale: chartScale, ticks: yTicks } = useMemo(() => computeYScale(dataMax), [dataMax]);
  const totalPath = useMemo(() => linePath(points, "total", chartScale), [points, chartScale]);
  const demoPath = useMemo(() => linePath(points, "demo", chartScale), [points, chartScale]);
  const activeBuckets = points.filter((point) => point.total > 0);
  const peakBucket = activeBuckets.reduce<Bucket | null>((peak, point) => {
    if (!peak) return point;
    return point.total > peak.total ? point : peak;
  }, null);
  const totalSeries = points.map((point) => point.total);
  const lastTotal = totalSeries[totalSeries.length - 1] ?? 0;
  const previousTotal = totalSeries.length > 1 ? totalSeries[totalSeries.length - 2] ?? 0 : 0;
  const delta = lastTotal - previousTotal;
  const deltaLabel = delta === 0 ? "Flat" : delta > 0 ? `+${delta}` : `${delta}`;
  const xAxisLabel = range === "day" ? "Hours" : range === "7d" || range === "month" ? "Days" : "Months";
  const xLabelIndexes = useMemo(() => getXLabelIndexes(range, points.length), [range, points.length]);

  return (
    <Card className="overflow-hidden border-border/70 bg-card/90 shadow-sm backdrop-blur-xl">
      <CardHeader className="gap-3 border-b border-border/60 bg-muted/30">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          <LineChart className="h-3.5 w-3.5" />
          User growth
        </div>
        <CardTitle className="text-2xl sm:text-3xl">New users over time</CardTitle>
        <CardDescription className="max-w-3xl text-sm sm:text-base">
          Based on account creation dates. Demo accounts are counted separately using the demo email suffix because IP addresses are not stored in the schema.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {RANGE_OPTIONS.map((option) => (
              <Button
                key={option.key}
                size="sm"
                variant={range === option.key ? "default" : "outline"}
                onClick={() => setRange(option.key)}
                className="rounded-full"
              >
                {option.label}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/80 px-2.5 py-1">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Peak {peakBucket?.total ?? 0}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/80 px-2.5 py-1">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Latest {deltaLabel}
            </span>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              New users
            </div>
            <p className="mt-3 text-3xl font-semibold tracking-tight">{selectedTotals.total}</p>
            <p className="mt-1 text-sm text-muted-foreground">Joined in the selected range.</p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              <UserRound className="h-3.5 w-3.5" />
              Demo users
            </div>
            <p className="mt-3 text-3xl font-semibold tracking-tight">{selectedTotals.demo}</p>
            <p className="mt-1 text-sm text-muted-foreground">Demo signups in the selected range.</p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              <CalendarRange className="h-3.5 w-3.5" />
              Lifetime total
            </div>
            <p className="mt-3 text-3xl font-semibold tracking-tight">{records.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">All created user accounts.</p>
          </div>
        </div>

        <div className="rounded-3xl border border-border/70 bg-background/90 p-4 shadow-sm">
          {points.length === 0 ? (
            <div className="flex min-h-56 items-center justify-center rounded-2xl border border-dashed border-border/70 text-sm text-muted-foreground">
              No user signups yet.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <p className="text-sm font-medium text-foreground">Signup trend</p>
                  <p className="text-xs text-muted-foreground">
                    Left to right is the selected date range. Blue is total signups, amber is demo signups.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                    New users
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                    Demo users
                  </span>
                </div>
              </div>

              <AdminGrowthChart
                points={points}
                maxValue={chartScale}
                totalPath={totalPath}
                demoPath={demoPath}
                yTicks={yTicks}
                xLabelIndexes={xLabelIndexes}
                xAxisLabel={xAxisLabel}
              />

              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-2xl border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">Active buckets</p>
                  <p className="mt-1">{activeBuckets.length} with at least one signup.</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">Highest bucket</p>
                  <p className="mt-1">{peakBucket ? `${peakBucket.label} · ${peakBucket.total}` : "No signups"}</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">Demo share</p>
                  <p className="mt-1">{selectedTotals.total > 0 ? `${Math.round((selectedTotals.demo / selectedTotals.total) * 100)}%` : "0%"}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}