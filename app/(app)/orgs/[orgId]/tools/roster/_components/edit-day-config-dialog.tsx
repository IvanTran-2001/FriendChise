"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { upsertRosterDayConfigAction } from "@/app/actions/roster";
import { useActionSidebar } from "@/components/layout/action-sidebar-context";
import type { DayConfigRow } from "./roster-board";

function minToTime(min: number | null): string {
  if (min === null) return "";
  const h = Math.floor(min / 60).toString().padStart(2, "0");
  const m = (min % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function timeToMin(time: string): number | null {
  if (!time) return null;
  const parts = time.split(":");
  if (parts.length !== 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (isNaN(h) || isNaN(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

interface EditDayConfigPanelProps {
  orgId: string;
  dayIndex: number;
  config: DayConfigRow | null;
  orgOpenTimeMin: number | null;
  orgCloseTimeMin: number | null;
}

export function EditDayConfigPanel({
  orgId,
  dayIndex,
  config,
  orgOpenTimeMin,
  orgCloseTimeMin,
}: EditDayConfigPanelProps) {
  const { close } = useActionSidebar();
  const [recommendedSize, setRecommendedSize] = useState(
    config?.recommendedSize ?? 1,
  );
  const [openTime, setOpenTime] = useState(
    minToTime(config?.openTimeMin ?? orgOpenTimeMin),
  );
  const [closeTime, setCloseTime] = useState(
    minToTime(config?.closeTimeMin ?? orgCloseTimeMin),
  );
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const result = await upsertRosterDayConfigAction(orgId, dayIndex, {
        recommendedSize,
        openTimeMin: timeToMin(openTime),
        closeTimeMin: timeToMin(closeTime),
      });
      if (result.ok) {
        close();
      } else {
        toast.error(result.error ?? "Failed to save");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium">Recommended Size</label>
        <Input
          type="number"
          min={0}
          max={100}
          value={recommendedSize}
          onChange={(e) =>
            setRecommendedSize(Math.max(0, Number(e.target.value)))
          }
          className="h-8 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium">Open Time</label>
        <Input
          type="time"
          value={openTime}
          onChange={(e) => setOpenTime(e.target.value)}
          className="h-8 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium">Close Time</label>
        <Input
          type="time"
          value={closeTime}
          onChange={(e) => setCloseTime(e.target.value)}
          className="h-8 text-sm"
        />
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={close}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave} disabled={isPending}>
          {isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
