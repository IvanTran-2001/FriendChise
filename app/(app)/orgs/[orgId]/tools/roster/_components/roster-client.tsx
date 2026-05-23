"use client";

import { useEffect, useRef, useState } from "react";
import { RosterBoard, type RosterBoardProps } from "./roster-board";
import {
  ROSTER_CELL_WIDTH,
  ROSTER_DAY_LABEL_WIDTH,
} from "./roster-board-constants";

// Minimum px width per week column before we drop it from view.
const MIN_CELL_WIDTH = ROSTER_CELL_WIDTH;

type Props = Omit<RosterBoardProps, "onFilterChange"> & {
  filterMembershipId: string | null;
};

export function RosterClient({ filterMembershipId, ...boardProps }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(
    boardProps.weekStarts.length,
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      const count = Math.max(
        1,
        Math.floor((width - ROSTER_DAY_LABEL_WIDTH) / MIN_CELL_WIDTH),
      );
      setVisibleCount(count);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const visibleWeeks = boardProps.weekStarts.slice(0, visibleCount);

  return (
    <div ref={containerRef} className="flex-1 overflow-auto">
      <div className="rounded-lg border border-border overflow-hidden">
        <RosterBoard
          {...boardProps}
          weekStarts={visibleWeeks}
          filterMembershipId={filterMembershipId}
          onFilterChange={() => {}}
        />
      </div>
    </div>
  );
}
