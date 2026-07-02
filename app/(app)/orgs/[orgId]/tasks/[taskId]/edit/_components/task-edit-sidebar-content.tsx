"use client";

import { type ReactNode } from "react";
import { AlarmClock, Clock, RefreshCw, Users } from "lucide-react";

import { ColorPicker } from "@/components/ui/color-picker";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { Input } from "@/components/ui/input";

import { TaskToolsPicker, type TaskToolSelection } from "../../../_components/task-tools-picker";
import { TaskDurationPicker, TaskStartTimePicker } from "../../../_components/task-scheduling-pickers";
import { ImageUploadPanel } from "../../../task-panels";

const SIDEBAR_LABEL_CLASS =
  "text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5";
const SIDEBAR_INPUT_CLASS = "h-9 text-sm";

function TaskSidebarSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-background/60 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h4>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

export interface TaskEditSidebarContentProps {
  orgId: string;
  taskId: string;
  color: string;
  onColorChange: (value: string) => void;
  imageSignedUrl: string | null;
  fallbackInitial: string;
  durationMin: number;
  onDurationChange: (value: number) => void;
  startTimeMin: number | null;
  onStartTimeChange: (value: number | null) => void;
  peopleRequired: number;
  onPeopleChange: (value: number) => void;
  minWaitDays: string;
  onMinWaitDaysChange: (value: string) => void;
  maxWaitDays: string;
  onMaxWaitDaysChange: (value: string) => void;
  selectedTools: TaskToolSelection[];
  onSelectedToolsChange: (tools: TaskToolSelection[]) => void;
}

export function TaskEditSidebarContent({
  orgId,
  taskId,
  color,
  onColorChange,
  imageSignedUrl,
  fallbackInitial,
  durationMin,
  onDurationChange,
  startTimeMin,
  onStartTimeChange,
  peopleRequired,
  onPeopleChange,
  minWaitDays,
  onMinWaitDaysChange,
  maxWaitDays,
  onMaxWaitDaysChange,
  selectedTools,
  onSelectedToolsChange,
}: TaskEditSidebarContentProps) {
  const fieldClass = "flex flex-col gap-1.5";

  return (
    <div className="flex flex-col gap-5 p-4 pt-3">
      <div className={fieldClass}>
        <span className={SIDEBAR_LABEL_CLASS}>Photo</span>
        <ImageUploadPanel
          orgId={orgId}
          taskId={taskId}
          initialSignedUrl={imageSignedUrl}
          layout="sidebar"
          fallbackColor={color}
          fallbackInitial={fallbackInitial}
        />
      </div>

      <div className={fieldClass}>
        <span className={SIDEBAR_LABEL_CLASS}>Color</span>
        <div className="flex items-center gap-2">
          <ColorPicker value={color} onChange={onColorChange} />
          <span className="font-mono text-xs text-muted-foreground">
            {color.toUpperCase()}
          </span>
        </div>
      </div>

      <div className={fieldClass}>
        <span className={SIDEBAR_LABEL_CLASS}>Tools</span>
        <TaskToolsPicker
          orgId={orgId}
          selectedTools={selectedTools}
          onSelectedToolsChange={onSelectedToolsChange}
        />
      </div>

      <CollapsibleSection
        title="Scheduling"
        description="Duration, preferred start, staffing, and wait window"
        defaultOpen={false}
      >
        <div className="flex flex-col gap-4">
          <TaskSidebarSection title="Timing">
            <div className={fieldClass}>
              <span className={SIDEBAR_LABEL_CLASS}>
                <Clock className="h-3.5 w-3.5" />
                Duration
              </span>
              <TaskDurationPicker value={durationMin} onChange={onDurationChange} />
              <span className="text-xs text-muted-foreground">
                {durationMin} min total
              </span>
            </div>

            <div className={fieldClass}>
              <span className={SIDEBAR_LABEL_CLASS}>
                <AlarmClock className="h-3.5 w-3.5" />
                Preferred start
              </span>
              <TaskStartTimePicker value={startTimeMin} onChange={onStartTimeChange} />
              {startTimeMin != null && (
                <button
                  type="button"
                  className="text-left text-xs text-muted-foreground transition-colors hover:text-destructive"
                  onClick={() => onStartTimeChange(null)}
                >
                  Clear
                </button>
              )}
            </div>
          </TaskSidebarSection>

          <TaskSidebarSection title="Staffing & Window">
            <div className={fieldClass}>
              <span className={SIDEBAR_LABEL_CLASS}>
                <Users className="h-3.5 w-3.5" />
                People required
              </span>
              <Input
                type="number"
                min={1}
                max={50}
                value={peopleRequired}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "") return;
                  const num = Number(val);
                  if (isNaN(num)) return;
                  onPeopleChange(Math.max(1, Math.min(50, num)));
                }}
                className={SIDEBAR_INPUT_CLASS}
                aria-label="people required"
              />
            </div>

            <div className={fieldClass}>
              <span className={SIDEBAR_LABEL_CLASS}>
                <RefreshCw className="h-3.5 w-3.5" />
                Wait days
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Min</span>
                  <Input
                    type="number"
                    min={0}
                    max={3650}
                    placeholder="e.g. 7"
                    value={minWaitDays}
                    onChange={(e) => onMinWaitDaysChange(e.target.value)}
                    className={SIDEBAR_INPUT_CLASS}
                    aria-label="Min wait days"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Max</span>
                  <Input
                    type="number"
                    min={0}
                    max={3650}
                    placeholder="e.g. 14"
                    value={maxWaitDays}
                    onChange={(e) => onMaxWaitDaysChange(e.target.value)}
                    className={SIDEBAR_INPUT_CLASS}
                    aria-label="Max wait days"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                At least one of min or max is required.
              </p>
            </div>
          </TaskSidebarSection>
        </div>
      </CollapsibleSection>
    </div>
  );
}