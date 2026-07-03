"use client";

import { useEffect, useState, useTransition, useActionState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Clock, Users, AlarmClock, RefreshCw, ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ColorPicker, randomColor } from "@/components/ui/color-picker";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { BackButton } from "@/components/layout/back-button";
import { createTaskAction } from "@/app/actions/tasks";
import type { CreateTaskFormState } from "@/app/actions/tasks";
import { TagPanel, EligibilityPanel } from "../task-form";
import type { Role, Tag } from "../task-form";
import { TaskEditorFrame } from "@/app/(app)/orgs/[orgId]/tasks/_components/task-editor-frame";
import { OrgImagePicker } from "@/components/ui/org-image-picker";

const SIDEBAR_LABEL_CLASS =
  "text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5";
const SIDEBAR_INPUT_CLASS = "h-9 text-sm";

function DurationPicker({
  defaultValueMin,
  name,
  error,
  onChange,
}: {
  defaultValueMin: number;
  name: string;
  error: string | null;
  onChange: (value: number) => void;
}) {
  const [hours, setHours] = useState(Math.floor(defaultValueMin / 60));
  const [minutes, setMinutes] = useState(() => {
    const rawMinutes = defaultValueMin % 60;
    const snapped = Math.round(rawMinutes / 5) * 5;
    return Math.max(0, Math.min(55, snapped));
  });
  const totalMin = hours * 60 + minutes;

  return (
    <div className="flex items-center gap-2">
      <select
        id={name}
        value={hours}
        onChange={(e) => {
          const nextHours = Number(e.target.value);
          setHours(nextHours);
          onChange(nextHours * 60 + minutes);
        }}
        className="h-9 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
        aria-label="Hours"
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
      >
        {Array.from({ length: 24 }, (_, i) => (
          <option key={i} value={i}>
            {i}h
          </option>
        ))}
      </select>
      <select
        value={minutes}
        onChange={(e) => {
          const nextMinutes = Number(e.target.value);
          setMinutes(nextMinutes);
          onChange(hours * 60 + nextMinutes);
        }}
        className="h-9 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
        aria-label="Minutes"
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
      >
        {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
          <option key={m} value={m}>
            {m}m
          </option>
        ))}
      </select>
      <span className="text-xs text-muted-foreground">{totalMin} min total</span>
    </div>
  );
}

function StartTimePicker({
  defaultValueMin,
  name,
  error,
  onChangeMinutes,
}: {
  defaultValueMin: number | null;
  name: string;
  error: string | null;
  onChangeMinutes: (min: number | null) => void;
}) {
  const toHHMM = (min: number) => {
    const hours = Math.floor(min / 60).toString().padStart(2, "0");
    const minutes = (min % 60).toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const [value, setValue] = useState(
    defaultValueMin != null ? toHHMM(defaultValueMin) : "",
  );
  const valueMin = value
    ? value
        .split(":")
        .reduce((hours, minutes, index) => hours + Number(minutes) * (index === 0 ? 60 : 1), 0)
    : "";

  useEffect(() => {
    onChangeMinutes(valueMin ? Number(valueMin) : null);
  }, [valueMin, onChangeMinutes]);

  return (
    <>
      <input type="hidden" name={name} value={valueMin} />
      <Input
        id={name}
        type="time"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
        className="w-40"
      />
    </>
  );
}

function SidebarFields({
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
}: {
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
}) {
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
          <p className="text-xs text-muted-foreground">
            Upload now and the image will be linked when you create the task.
          </p>
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
        <span className={SIDEBAR_LABEL_CLASS}>
          <Clock className="h-3.5 w-3.5" />
          Duration
        </span>
        <DurationPicker
          defaultValueMin={durationMin}
          name="durationMin"
          error={null}
          onChange={onDurationChange}
        />
        <span className="text-xs text-muted-foreground">
          {durationMin} min total
        </span>
      </div>

      <div className={fieldClass}>
        <span className={SIDEBAR_LABEL_CLASS}>
          <AlarmClock className="h-3.5 w-3.5" />
          Preferred start
        </span>
        <StartTimePicker
          defaultValueMin={startTimeMin}
          name="preferredStartTimeMin"
          error={null}
          onChangeMinutes={onStartTimeChange}
        />
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
    </div>
  );
}

export function TaskCreateClient({
  orgId,
  allRoles,
  allTags,
  initialSearch,
}: {
  orgId: string;
  allRoles: Role[];
  allTags: Tag[];
  initialSearch?:string;
}) {
  const router = useRouter();
  const [color, setColor] = useState(() => randomColor());
  // Keep markdown in React state so sidebar-driven rerenders can't drop it
  // before FormData is assembled on submit.
  const [description, setDescription] = useState("");
  const [selectedImage, setSelectedImage] = useState<{
    storagePath: string;
    signedUrl: string;
  } | null>(null);
  const [durationMin, setDurationMin] = useState(30);
  const [startTimeMin, setStartTimeMin] = useState<number | null>(null);
  const [peopleRequired, setPeopleRequired] = useState(1);
  const [minWaitDays, setMinWaitDays] = useState("1");
  const [maxWaitDays, setMaxWaitDays] = useState("1");
  const [state, dispatch, pending] = useActionState<
    CreateTaskFormState,
    FormData
  >(
    createTaskAction.bind(null, orgId),
    null,
  );
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!state || state.ok) return;
    const messages = Object.entries(state.errors)
      .flatMap(([field, errs]) =>
        field === "_" ? errs : errs.map((error) => `${field}: ${error}`),
      )
      .join("\n");
    toast.error(messages || "Something went wrong");
  }, [state]);

  const err = (field: string): string | null =>
    state && !state.ok ? state.errors[field]?.[0] ?? null : null;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    // Source the description from state instead of the editor's hidden input.
    formData.set("description", description);
    formData.set("durationMin", String(durationMin));
    formData.set("minWaitDays", normalizeWaitDays(minWaitDays));
    formData.set("maxWaitDays", normalizeWaitDays(maxWaitDays));
    formData.set(
      "preferredStartTimeMin",
      startTimeMin == null ? "" : String(startTimeMin),
    );
    startTransition(() => dispatch(formData));
  };

  const handleImageSelect = (storagePath: string, signedUrl: string) => {
    setSelectedImage({ storagePath, signedUrl });
  };

  const normalizeWaitDays = (value: string) => {
    const trimmed = value.trim();
    if (trimmed === "") return "1";
    return String(Number(trimmed));
  };

  return (
    <TaskEditorFrame
        sidebarContent={
          <SidebarFields
            orgId={orgId}
            color={color}
            onColorChange={setColor}
            selectedImage={selectedImage}
            onImageSelect={handleImageSelect}
            onImageClear={() => setSelectedImage(null)}
            durationMin={durationMin}
            onDurationChange={setDurationMin}
            startTimeMin={startTimeMin}
            onStartTimeChange={setStartTimeMin}
            peopleRequired={peopleRequired}
            onPeopleChange={setPeopleRequired}
            minWaitDays={minWaitDays}
            onMinWaitDaysChange={setMinWaitDays}
            maxWaitDays={maxWaitDays}
            onMaxWaitDaysChange={setMaxWaitDays}
          />
        }
        toolbarContent={
          <>
            <BackButton
              fallbackHref={`/orgs/${orgId}/tasks`}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              ← Tasks
            </BackButton>
            <div className="ml-auto flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => router.push(`/orgs/${orgId}/tasks`)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="task-create-form"
                size="sm"
                disabled={pending}
              >
                {pending ? "Creating…" : "Create Task"}
              </Button>
            </div>
          </>
        }
      >
        <form
          id="task-create-form"
          onSubmit={handleSubmit}
          className="flex flex-col gap-6"
        >
        <input
          type="hidden"
          name="imageStoragePath"
          value={selectedImage?.storagePath ?? ""}
        />
        <input type="hidden" name="color" value={color} />
        <input type="hidden" name="durationMin" value={durationMin} />
        <input type="hidden" name="preferredStartTimeMin" value={startTimeMin ?? ""} />
        <input type="hidden" name="peopleRequired" value={peopleRequired} />
        <input type="hidden" name="minWaitDays" value={normalizeWaitDays(minWaitDays)} />
        <input type="hidden" name="maxWaitDays" value={normalizeWaitDays(maxWaitDays)} />

        {err("_") && <p role="alert" className="text-sm text-destructive">{err("_")}</p>}

        <div className="flex flex-col gap-6 rounded-xl border bg-card p-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="title" className="text-sm font-medium">
              Title <span className="text-destructive">*</span>
            </label>
            <Input
              id="title"
              name="title"
              type="text"
              required
              defaultValue={initialSearch ?? ""}
              placeholder="e.g. Deep clean kitchen"
              aria-invalid={!!err("title")}
              aria-describedby={err("title") ? "title-error" : undefined}
            />
            {err("title") && (
              <p id="title-error" className="text-xs text-destructive">
                {err("title")}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="description" className="text-sm font-medium">
              Description
            </label>
            <RichTextEditor
              name="description"
              placeholder="Add details, steps, or notes…"
              minHeightClass="min-h-80"
              ariaLabel="Description"
              onChange={setDescription}
              ariaInvalid={!!err("description")}
              ariaDescribedBy={err("description") ? "description-error" : undefined}
            />
            {err("description") && (
              <p id="description-error" className="text-xs text-destructive">
                {err("description")}
              </p>
            )}
          </div>

          <div className="rounded-xl border bg-card p-5">
            <TagPanel mode="create" allTags={allTags} />
          </div>

          <div className="rounded-xl border bg-card p-5">
            <EligibilityPanel mode="create" allRoles={allRoles} />
          </div>
        </div>
        </form>
      </TaskEditorFrame>
  );
}
