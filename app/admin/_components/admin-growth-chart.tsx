"use client";

type GrowthPoint = {
  key: string;
  label: string;
  total: number;
  demo: number;
};

type AdminGrowthChartProps = {
  points: GrowthPoint[];
  maxValue: number;
  totalPath: string;
  demoPath: string;
  yTicks: number[];
  xLabelIndexes: number[];
  xAxisLabel: string;
};

export function AdminGrowthChart({
  points,
  maxValue,
  totalPath,
  demoPath,
  yTicks,
  xLabelIndexes,
  xAxisLabel,
}: AdminGrowthChartProps) {
  const hasData = points.length > 0;

  return (
    <div className="rounded-2xl border border-border/70 bg-linear-to-b from-primary/6 via-background to-background p-3 sm:p-4">
      <div className="grid grid-cols-[3rem_minmax(0,1fr)] gap-3 sm:grid-cols-[3.5rem_minmax(0,1fr)]">
        <div className="relative h-64 text-[10px] font-medium text-muted-foreground">
          {yTicks.map((tick, index) => {
            const top = yTicks.length === 1 ? 50 : (index / (yTicks.length - 1)) * 100;
            return (
              <span
                key={tick}
                className="absolute right-0 -translate-y-1/2 pr-1 text-right tabular-nums"
                style={{ top: `${100 - top}%` }}
              >
                {tick}
              </span>
            );
          })}
          <span className="absolute bottom-0 right-0 pr-1 text-right uppercase tracking-[0.16em] text-[9px] text-muted-foreground/80">
            Signups
          </span>
        </div>

        <div className="relative h-64 overflow-hidden rounded-xl border border-border/60 bg-background/80">
          <svg viewBox="0 0 100 40" className="h-full w-full overflow-visible">
            <defs>
              <linearGradient id="admin-growth-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="rgb(59 130 246)" stopOpacity="0.30" />
                <stop offset="100%" stopColor="rgb(59 130 246)" stopOpacity="0.03" />
              </linearGradient>
              <linearGradient id="admin-growth-demo-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="rgb(245 158 11)" stopOpacity="0.18" />
                <stop offset="100%" stopColor="rgb(245 158 11)" stopOpacity="0.01" />
              </linearGradient>
            </defs>
            {yTicks.map((tick) => {
              const y = 34 - (tick / maxValue) * 28;
              return (
                <line
                  key={tick}
                  x1="0"
                  x2="100"
                  y1={y}
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity="0.08"
                  strokeDasharray="1.5 2.5"
                />
              );
            })}
            {totalPath && <path d={`${totalPath} L 100 34 L 0 34 Z`} fill="url(#admin-growth-fill)" />}
            {demoPath && <path d={`${demoPath} L 100 34 L 0 34 Z`} fill="url(#admin-growth-demo-fill)" />}
            {totalPath && (
              <path
                d={totalPath}
                fill="none"
                stroke="rgb(59 130 246)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {demoPath && (
              <path
                d={demoPath}
                fill="none"
                stroke="rgb(245 158 11)"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="3 2"
              />
            )}
            {hasData &&
              points.map((point, index) => {
                const x = points.length === 1 ? 50 : (index / (points.length - 1)) * 100;
                const totalY = 34 - (point.total / maxValue) * 28;
                const demoY = 34 - (point.demo / maxValue) * 28;
                return (
                  <g key={point.key}>
                    <circle
                      cx={x}
                      cy={totalY}
                      r="1.6"
                      fill="rgb(59 130 246)"
                      stroke="white"
                      strokeWidth="0.6"
                      opacity={point.total > 0 ? 1 : 0.15}
                    />
                    {point.demo > 0 && (
                      <circle
                        cx={x}
                        cy={demoY}
                        r="1.3"
                        fill="rgb(245 158 11)"
                        stroke="white"
                        strokeWidth="0.6"
                        opacity={1}
                      />
                    )}
                  </g>
                );
              })}
          </svg>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-[3rem_minmax(0,1fr)] gap-3 sm:grid-cols-[3.5rem_minmax(0,1fr)]">
        <div />
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-muted-foreground/80 sm:text-[11px]">
            <span>{xAxisLabel}</span>
            <span className="hidden sm:inline">Selected range</span>
          </div>
          <div className="flex gap-2 text-[10px] leading-tight text-muted-foreground sm:text-xs">
          {points.map((point, index) => (
            <div key={point.key} className="min-w-0 flex-1 text-center">
              {xLabelIndexes.includes(index) ? (
                <span className="block truncate">{point.label}</span>
              ) : (
                <span className="block opacity-0">.</span>
              )}
            </div>
          ))}
          </div>
        </div>
      </div>
    </div>
  );
}