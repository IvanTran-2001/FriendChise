"use client";

import { useMemo } from "react";
import { CalendarRange, LineChart, Users, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { AdminGrowthChart, type GrowthPoint, type RangeKey } from "./admin-growth-chart";

export type UserGrowthRecord = {
  createdAt: string;
  isDemo: boolean;
};

export type GrowthRecord = UserGrowthRecord;

type Granularity = "hour" | "day" | "month" | "year";

const DAY_MS = 24 * 60 * 60 * 1000;

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

function startOfYear(date: Date) {
  const next = new Date(date);
  next.setMonth(0, 1);
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

function addYears(date: Date, years: number) {
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + years);
  return next;
}

function bucketKey(date: Date, granularity: Granularity) {
  if (granularity === "hour") {
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
  }
  if (granularity === "day") {
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  }
  if (granularity === "month") {
    return `${date.getFullYear()}-${date.getMonth()}`;
  }
  return `${date.getFullYear()}`;
}

function createPoint(key: string, label: string): GrowthPoint {
  return {
    key,
    label,
    total: 0,
    demo: 0,
  };
}

function formatDayLabel(date: Date) {
  return date.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
  });
}

function formatMonthLabel(date: Date) {
  return date.toLocaleDateString("en-AU", {
    month: "short",
  });
}

function formatYearLabel(date: Date) {
  return date.toLocaleDateString("en-AU", {
    year: "numeric",
  });
}

function buildGrowthPoints(records: GrowthRecord[], range: RangeKey): GrowthPoint[] {
  const now = new Date();

  if (range === "day") {
    // Day view is hourly: 24 buckets, one per hour in the last 24 hours.
    const start = startOfHour(addHours(now, -23));
    const points = Array.from({ length: 24 }, (_, index) => {
      const bucketStart = addHours(start, index);
      return createPoint(bucketKey(bucketStart, "hour"), String(index + 1));
    });
    const bucketIndex = new Map<string, number>();
    points.forEach((point, index) => bucketIndex.set(point.key, index));

    for (const record of records) {
      const createdAt = new Date(record.createdAt);
      const index = bucketIndex.get(bucketKey(createdAt, "hour"));
      if (index === undefined) continue;
      if (record.isDemo) points[index].demo += 1;
      else points[index].total += 1;
    }

    return points;
  }

  if (range === "7d") {
    // Week view is daily: seven buckets covering the last seven days.
    const start = startOfDay(addDays(now, -6));
    const points = Array.from({ length: 7 }, (_, index) => {
      const bucketStart = addDays(start, index);
      return createPoint(bucketKey(bucketStart, "day"), formatDayLabel(bucketStart));
    });
    const bucketIndex = new Map<string, number>();
    points.forEach((point, index) => bucketIndex.set(point.key, index));

    for (const record of records) {
      const createdAt = new Date(record.createdAt);
      const index = bucketIndex.get(bucketKey(createdAt, "day"));
      if (index === undefined) continue;
      if (record.isDemo) points[index].demo += 1;
      else points[index].total += 1;
    }

    return points;
  }

  if (range === "month") {
    // Month view is intentionally compressed into four weekly buckets.
    const start = startOfDay(addDays(now, -27));
    const points = Array.from({ length: 4 }, (_, index) =>
      createPoint(`week-${index + 1}`, `W${index + 1}`),
    );

    for (const record of records) {
      const createdAt = new Date(record.createdAt);
      const diffDays = Math.floor((startOfDay(createdAt).getTime() - start.getTime()) / DAY_MS);
      if (diffDays < 0 || diffDays >= 28) continue;
      const index = Math.min(3, Math.floor(diffDays / 7));
      if (record.isDemo) points[index].demo += 1;
      else points[index].total += 1;
    }

    return points;
  }

  if (range === "6m") {
    // Six-month view uses one bucket per month.
    const start = startOfMonth(addMonths(now, -5));
    const points = Array.from({ length: 6 }, (_, index) => {
      const bucketStart = addMonths(start, index);
      return createPoint(bucketKey(bucketStart, "month"), String(index + 1));
    });
    const bucketIndex = new Map<string, number>();
    points.forEach((point, index) => bucketIndex.set(point.key, index));

    for (const record of records) {
      const createdAt = new Date(record.createdAt);
      const index = bucketIndex.get(bucketKey(createdAt, "month"));
      if (index === undefined) continue;
      if (record.isDemo) points[index].demo += 1;
      else points[index].total += 1;
    }

    return points;
  }

  if (range === "year") {
    // Year view also uses month buckets, but it stretches across all 12 months.
    const start = startOfMonth(addMonths(now, -11));
    const points = Array.from({ length: 12 }, (_, index) => {
      const bucketStart = addMonths(start, index);
      return createPoint(bucketKey(bucketStart, "month"), formatMonthLabel(bucketStart));
    });
    const bucketIndex = new Map<string, number>();
    points.forEach((point, index) => bucketIndex.set(point.key, index));

    for (const record of records) {
      const createdAt = new Date(record.createdAt);
      const index = bucketIndex.get(bucketKey(createdAt, "month"));
      if (index === undefined) continue;
      if (record.isDemo) points[index].demo += 1;
      else points[index].total += 1;
    }

    return points;
  }

  // Lifetime view groups by year so the chart stays readable over a long history.
  const firstRecord = records[0];
  const start = firstRecord ? startOfYear(new Date(firstRecord.createdAt)) : startOfYear(now);
  const current = startOfYear(now);
  const points: GrowthPoint[] = [];
  const bucketIndex = new Map<string, number>();
  let cursor = new Date(start);

  while (cursor <= current) {
    const point = createPoint(bucketKey(cursor, "year"), formatYearLabel(cursor));
    bucketIndex.set(point.key, points.length);
    points.push(point);
    cursor = addYears(cursor, 1);
  }

  for (const record of records) {
    const createdAt = new Date(record.createdAt);
    const index = bucketIndex.get(bucketKey(createdAt, "year"));
    if (index === undefined) continue;
    if (record.isDemo) points[index].demo += 1;
    else points[index].total += 1;
  }

  return points;
}

export function AdminUserGrowthCard({ records }: { records: GrowthRecord[] }) {
  const [range, setRange, hydrated] = usePersistedState<RangeKey>("admin-growth-range", "month");

  const points = useMemo(() => buildGrowthPoints(records, range), [records, range]);
  // Lifetime summary stays aligned with the chart: demo launches are excluded.
  const nonDemoTotal = useMemo(() => records.filter((record) => !record.isDemo).length, [records]);
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

  // This is the count of active non-demo buckets, used for a quick chart summary.
  const activeBuckets = points.filter((point) => point.total > 0);
  const peakBucket = activeBuckets.reduce<GrowthPoint | null>((peak, point) => {
    if (!peak) return point;
    return point.total > peak.total ? point : peak;
  }, null);
  const totalSeries = points.map((point) => point.total);
  const lastTotal = totalSeries[totalSeries.length - 1] ?? 0;
  const previousTotal = totalSeries.length > 1 ? totalSeries[totalSeries.length - 2] ?? 0 : 0;
  const delta = lastTotal - previousTotal;
  const deltaLabel = delta === 0 ? "Flat" : delta > 0 ? `+${delta}` : `${delta}`;

  if (!hydrated) {
    return (
      <Card className="overflow-hidden border-border/70 bg-card/90 shadow-sm backdrop-blur-xl">
        <CardHeader className="gap-3 border-b border-border/60 bg-muted/30">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            <LineChart className="h-3.5 w-3.5" />
            User growth
          </div>
          <CardTitle className="text-2xl sm:text-3xl">New users and demo launches</CardTitle>
          <CardDescription className="max-w-3xl text-sm sm:text-base">
            Restoring your saved chart range...
          </CardDescription>
        </CardHeader>

        <CardContent className="p-4 sm:p-5">
          <div className="flex min-h-56 items-center justify-center rounded-2xl border border-dashed border-border/70 text-sm text-muted-foreground">
            Loading saved range
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-border/70 bg-card/90 shadow-sm backdrop-blur-xl">
      <CardHeader className="gap-3 border-b border-border/60 bg-muted/30">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          <LineChart className="h-3.5 w-3.5" />
          User growth
        </div>
        <CardTitle className="text-2xl sm:text-3xl">New users and demo launches</CardTitle>
        <CardDescription className="max-w-3xl text-sm sm:text-base">
          Based on account creation dates and demo-session launch times. Demo launches are tracked separately from user accounts.
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
            <p className="mt-1 text-sm text-muted-foreground">Joined in the selected range, excluding demo launches.</p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              <UserRound className="h-3.5 w-3.5" />
              Demo launches
            </div>
            <p className="mt-3 text-3xl font-semibold tracking-tight">{selectedTotals.demo}</p>
            <p className="mt-1 text-sm text-muted-foreground">Demo launches in the selected range.</p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              <CalendarRange className="h-3.5 w-3.5" />
              Lifetime non-demo users
            </div>
            <p className="mt-3 text-3xl font-semibold tracking-tight">{nonDemoTotal}</p>
            <p className="mt-1 text-sm text-muted-foreground">All non-demo user accounts.</p>
          </div>
        </div>

        <div className="rounded-3xl border border-border/70 bg-background/90 p-4 shadow-sm">
          {points.length === 0 ? (
            <div className="flex min-h-56 items-center justify-center rounded-2xl border border-dashed border-border/70 text-sm text-muted-foreground">
              No growth data yet.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <p className="text-sm font-medium text-foreground">Growth trend</p>
                  <p className="text-xs text-muted-foreground">
                    Left to right is the selected date range. Blue is non-demo signups, amber is demo launches.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                    New users
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                    Demo launches
                  </span>
                </div>
              </div>

              <AdminGrowthChart range={range} points={points} />

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
                  <p className="mt-1">{selectedTotals.total > 0 ? `${Math.round((selectedTotals.demo / (selectedTotals.total + selectedTotals.demo)) * 100)}%` : "0%"}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}