"use client";

import type { GrowthPoint, RangeKey } from "./admin-growth-chart";
import { Table2 } from "lucide-react";

function formatDelta(current: number, previous: number): { label: string; className: string } {
  const diff = current - previous;
  if (diff === 0) return { label: "Flat", className: "text-muted-foreground" };
  if (diff > 0) return { label: `+${diff}`, className: "text-emerald-600" };
  return { label: `${diff}`, className: "text-red-600" };
}

type AdminGrowthTableProps = {
  points: GrowthPoint[];
  range: RangeKey;
};

export function AdminGrowthTable({ points }: AdminGrowthTableProps) {
  const displayPoints = points;

  if (displayPoints.length === 0) {
    return (
      <div className="flex min-h-56 items-center justify-center rounded-2xl border border-dashed border-border/70 text-sm text-muted-foreground">
        No growth data yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border/70 bg-background/80 shadow-sm">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border/60 bg-muted/40">
            <th className="whitespace-nowrap px-4 py-3 font-semibold text-foreground sm:px-5">
              Bucket
            </th>
            <th className="whitespace-nowrap px-4 py-3 font-semibold text-foreground sm:px-5">
              New users
            </th>
            <th className="whitespace-nowrap px-4 py-3 font-semibold text-foreground sm:px-5">
              Demo launches
            </th>
            <th className="whitespace-nowrap px-4 py-3 font-semibold text-foreground sm:px-5">
              Prev users
            </th>
            <th className="whitespace-nowrap px-4 py-3 font-semibold text-foreground sm:px-5">
              Prev demo
            </th>
            <th className="whitespace-nowrap px-4 py-3 font-semibold text-foreground sm:px-5">
              Users Δ
            </th>
            <th className="whitespace-nowrap px-4 py-3 font-semibold text-foreground sm:px-5">
              Demo Δ
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {displayPoints.map((point, index) => {
            const prev = index > 0 ? displayPoints[index - 1] : null;
            const userDelta = prev ? formatDelta(point.total, prev.total) : null;
            const demoDelta = prev ? formatDelta(point.demo, prev.demo) : null;

            return (
              <tr
                key={point.key}
                className="transition-colors hover:bg-muted/20"
              >
                <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground sm:px-5">
                  <span className="inline-flex items-center gap-2">
                    <Table2 className="h-3.5 w-3.5 text-muted-foreground" />
                    {point.label}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums sm:px-5">
                  {point.total}
                </td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums sm:px-5">
                  {point.demo}
                </td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted-foreground sm:px-5">
                  {prev ? prev.total : "–"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted-foreground sm:px-5">
                  {prev ? prev.demo : "–"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums sm:px-5">
                  {userDelta ? (
                    <span className={`font-medium ${userDelta.className}`}>
                      {userDelta.label}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">–</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums sm:px-5">
                  {demoDelta ? (
                    <span className={`font-medium ${demoDelta.className}`}>
                      {demoDelta.label}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">–</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
