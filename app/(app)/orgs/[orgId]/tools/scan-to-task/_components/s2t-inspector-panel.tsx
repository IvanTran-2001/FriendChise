"use client";

import { useEffect, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { ColorPicker } from "@/components/ui/pickers/color-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/ui/editors/rich-text-editor";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/dialogs/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatFileSize } from "@/lib/services/scan-to-task-shared";

export type InspectorFormValues = {
  color: string;
  title: string;
  description: string;
  durationMin: number;
  peopleRequired: number;
  minWaitDays: number | null;
  maxWaitDays: number | null;
};

type ScanToTaskInspectorPanelProps = {
  open: boolean;
  mode: "draft" | "conflict" | "task";
  color: string;
  title: string;
  description: string;
  durationMin: number;
  peopleRequired: number;
  minWaitDays: number | null;
  maxWaitDays: number | null;
  sourceFileName: string;
  sourceFileKind: string;
  sourceFileSize: number;
  taskDetailsLabel?: string | null;
  confirmPending: boolean;
  saveDisabled?: boolean;
  onDelete: (() => void) | null;
  onSave: ((values: InspectorFormValues) => void) | null;
  onOpenChange: (open: boolean) => void;
};

function InspectorBody({
  mode: _mode,
  color,
  title,
  description,
  durationMin,
  peopleRequired,
  minWaitDays = 0,
  maxWaitDays = 0,
  sourceFileName,
  sourceFileKind,
  sourceFileSize,
  taskDetailsLabel,
  confirmPending,
  saveDisabled = false,
  onDelete,
  onSave,
}: ScanToTaskInspectorPanelProps) {
  const [draftColor, setDraftColor] = useState(color);
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftDescription, setDraftDescription] = useState(description);
  const [draftDurationMin, setDraftDurationMin] = useState(durationMin);
  const [draftPeopleRequired, setDraftPeopleRequired] = useState(peopleRequired);
  const [draftMinWaitDays, setDraftMinWaitDays] = useState(minWaitDays?.toString() ?? "");
  const [draftMaxWaitDays, setDraftMaxWaitDays] = useState(maxWaitDays?.toString() ?? "");

  useEffect(() => {
    setDraftColor(color);
  }, [color]);

  useEffect(() => {
    setDraftTitle(title);
  }, [title]);

  useEffect(() => {
    setDraftDescription(description);
  }, [description]);

  useEffect(() => {
    setDraftDurationMin(durationMin);
  }, [durationMin]);

  useEffect(() => {
    setDraftPeopleRequired(peopleRequired);
  }, [peopleRequired]);

  useEffect(() => {
    setDraftMinWaitDays(minWaitDays == null ? "" : String(minWaitDays));
  }, [minWaitDays]);

  useEffect(() => {
    setDraftMaxWaitDays(maxWaitDays == null ? "" : String(maxWaitDays));
  }, [maxWaitDays]);

  const saveLabel = "Save";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-x-hidden p-4 sm:p-6">
      <InspectorHeader draftTitle={draftTitle} />

      <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-x-hidden">
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden pr-1">
          <div className="rounded-lg border border-border/40 bg-muted/20 px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Source</p>
            <p className="mt-1 text-sm font-medium text-foreground wrap-break-word">{sourceFileName}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {sourceFileKind} · {formatFileSize(sourceFileSize)}
            </p>
          </div>

          {taskDetailsLabel ? (
            <div className="rounded-xl border border-border/60 bg-background p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Task details</p>
              <p className="mt-2 text-sm text-muted-foreground">{taskDetailsLabel}</p>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FieldLabel>Color</FieldLabel>
              <ColorPicker value={draftColor} onChange={setDraftColor} disabled={confirmPending} />
            </div>

            <div className="sm:col-span-2">
              <FieldLabel>Title</FieldLabel>
              <Input value={draftTitle} onChange={(event) => setDraftTitle(event.currentTarget.value)} disabled={confirmPending} />
            </div>

            <div className="sm:col-span-2">
              <FieldLabel>Description</FieldLabel>
              <RichTextEditor
                key={taskDetailsLabel ?? sourceFileName}
                name="description"
                defaultValue={draftDescription}
                placeholder="Write the task description…"
                minHeightClass="min-h-44"
                className="bg-background"
                ariaLabel="Task description"
                onChange={setDraftDescription}
                disabled={confirmPending}
              />
            </div>

            <div>
              <FieldLabel>Duration</FieldLabel>
              <Input
                type="number"
                min={1}
                max={24 * 60}
                value={draftDurationMin}
                onChange={(event) => {
                  const nextDuration = event.currentTarget.valueAsNumber;
                  if (Number.isFinite(nextDuration) && nextDuration >= 1) {
                    setDraftDurationMin(nextDuration);
                  }
                }}
                disabled={confirmPending}
              />
            </div>

            <div>
              <FieldLabel>People</FieldLabel>
              <Input
                type="number"
                min={1}
                max={50}
                value={draftPeopleRequired}
                onChange={(event) => {
                  const nextPeopleRequired = event.currentTarget.valueAsNumber;
                  if (Number.isFinite(nextPeopleRequired) && nextPeopleRequired >= 1) {
                    setDraftPeopleRequired(nextPeopleRequired);
                  }
                }}
                disabled={confirmPending}
              />
            </div>

            <div>
              <FieldLabel>Wait min</FieldLabel>
              <Input
                type="number"
                min={0}
                max={3650}
                value={draftMinWaitDays}
                onChange={(event) => setDraftMinWaitDays(event.currentTarget.value)}
                disabled={confirmPending}
              />
            </div>

            <div>
              <FieldLabel>Wait max</FieldLabel>
              <Input
                type="number"
                min={0}
                max={3650}
                value={draftMaxWaitDays}
                onChange={(event) => setDraftMaxWaitDays(event.currentTarget.value)}
                disabled={confirmPending}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-border/60 pt-3">
            <div className="text-xs text-muted-foreground">Review the loaded values, then save or delete the current selection.</div>
            <div className="flex flex-col gap-2 sm:flex-row">
              {onSave ? (
                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  onClick={() =>
                    onSave({
                      color: draftColor,
                      title: draftTitle,
                      description: draftDescription,
                      durationMin: draftDurationMin,
                      peopleRequired: draftPeopleRequired,
                      minWaitDays: draftMinWaitDays.trim() === "" ? null : Number(draftMinWaitDays),
                      maxWaitDays: draftMaxWaitDays.trim() === "" ? null : Number(draftMaxWaitDays),
                    })
                  }
                  disabled={confirmPending || saveDisabled}
                >
                  {saveLabel}
                </Button>
              ) : null}
              {onDelete ? (
                <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onDelete} disabled={confirmPending}>
                  Delete
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Wraps the inspector body in a responsive sheet so it can render as a drawer on desktop
 * and a bottom sheet on mobile.
 */
export function ScanToTaskInspectorPanel(props: ScanToTaskInspectorPanelProps) {
  const isMobile = useIsMobile();

  if (isMobile === undefined) return null;

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className="p-0 data-[side=bottom]:h-[72dvh] data-[side=bottom]:rounded-t-2xl data-[side=bottom]:border-t data-[side=bottom]:border-border/70 data-[side=right]:bottom-3 data-[side=right]:top-auto data-[side=right]:right-3 data-[side=right]:h-[calc(100dvh-1.5rem)] data-[side=right]:w-[min(calc(100vw-1.5rem),44rem)] data-[side=right]:max-h-192 data-[side=right]:rounded-l-2xl data-[side=right]:border-l data-[side=right]:border-border/70"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Task inspector</SheetTitle>
        </SheetHeader>
        <InspectorBody {...props} />
      </SheetContent>
    </Sheet>
  );
}

function FieldLabel({ children }: { children: string }) {
  return <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{children}</p>;
}

type InspectorHeaderProps = {
  draftTitle: string;
};

/**
 * Renders the inspector title area and the current item title.
 */
function InspectorHeader({ draftTitle }: InspectorHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center justify-center gap-2 sm:justify-start">
          <ClipboardCheck className="h-3.5 w-3.5 text-muted-foreground" />
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Inspector</h2>
        </div>
        <p className="mt-1 truncate text-sm font-medium text-foreground wrap-break-word">{draftTitle}</p>
      </div>
    </div>
  );
}
