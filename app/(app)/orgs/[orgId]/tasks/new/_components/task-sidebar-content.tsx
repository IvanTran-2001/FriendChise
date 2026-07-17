"use client";

/**
 * Create-task sidebar content.
 *
 * This is the create-mode counterpart to the edit sidebar: it owns local
 * selection state for image, color, tools, and scheduling fields, then leaves
 * persistence to the parent form submit.
 */

import type { ReactNode } from "react";
import { AlarmClock, Clock, ImagePlus, RefreshCw, Trash2, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/pickers/color-picker";
import { CollapsibleSection } from "@/components/ui/controls/collapsible-section";
import { Input } from "@/components/ui/input";
import { OrgImagePicker } from "@/components/ui/pickers/org-image-picker";

import {
  TaskToolsPicker,
  type TaskToolSelection,
} from "../../_components/task-tools-picker";
import {
  TaskDurationPicker,
  TaskStartTimePicker,
} from "../../_components/task-scheduling-pickers";

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

interface TaskSidebarContentProps {
  orgId: string;
  color: string;
  onColorChange: (value: string) => void;
  selectedImage: { storagePath: string; signedUrl: string } | null;
  onImageSelect: (storagePath: string, signedUrl: string) => void;
  onImageClear: () => void;
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

export function TaskSidebarContent({
  orgId,
  color,
  onColorChange,
  selectedImage,
  onImageSelect,
  onImageClear,
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
}: TaskSidebarContentProps) {
  const fieldClass = "flex flex-col gap-1.5";

  return (
    <div className="flex flex-col gap-5 p-4 pt-3">
      <div className={fieldClass}>
        <span className={SIDEBAR_LABEL_CLASS}>Photo</span>
        <div className="flex flex-col gap-3 rounded-md border bg-card p-3">
          <div className="overflow-hidden rounded-md border border-dashed border-border/70 bg-muted/20">
            {selectedImage?.signedUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selectedImage.signedUrl}
                alt="Selected task photo"
                className="aspect-square w-full object-cover"
              />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center text-muted-foreground">
                <div className="flex flex-col items-center gap-2 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-background">
                    <ImagePlus className="h-5 w-5" />
                  </div>
                  <p className="text-xs">No photo selected yet</p>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {selectedImage?.signedUrl ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onImageClear}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </Button>
            ) : null}
            <OrgImagePicker
              orgId={orgId}
              config={{ aspect: 1, outputWidth: 600, outputHeight: 600 }}
              onSelect={onImageSelect}
              trigger={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 px-3 text-xs"
                >
                  <ImagePlus className="h-3 w-3" />
                  {selectedImage?.signedUrl ? "Replace" : "Add photo"}
                </Button>
              }
            />
          </div>
        </div>
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
                onChange={(e) => onPeopleChange(Number(e.target.value))}
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