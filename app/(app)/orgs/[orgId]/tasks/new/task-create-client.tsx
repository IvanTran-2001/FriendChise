"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Clock,
  Users,
  AlarmClock,
  RefreshCw,
  ImagePlus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ColorPicker, randomColor } from "@/components/ui/color-picker";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { createTaskAction } from "@/app/actions/tasks";
import type { CreateTaskFormState } from "@/app/actions/tasks";
import { TagPanel, EligibilityPanel } from "../task-form";
import type { Role, Tag } from "../task-form";
import { TaskEditorFrame } from "@/app/(app)/orgs/[orgId]/tasks/_components/task-editor-frame";
import { OrgImagePicker } from "@/components/ui/org-image-picker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const SIDEBAR_LABEL_CLASS =
  "text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5";
const SIDEBAR_INPUT_CLASS = "h-9 text-sm";

type TaskCreateDraft = {
  title: string;
  description: string;
  color: string;
  imageStoragePath: string;
  imageSignedUrl: string;
  durationMin: number;
  preferredStartTimeMin: number | null;
  peopleRequired: number;
  minWaitDays: string;
  maxWaitDays: string;
  tagIds: string[];
  roleIds: string[];
};

function normalizeWaitDays(value: string) {
  const trimmed = value.trim();
  if (trimmed === "") return "1";
  return String(Number(trimmed));
}

function draftStorageKey(orgId: string) {
  return `task-create-draft:${orgId}`;
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function readStoredDraft(orgId: string): Partial<TaskCreateDraft> | null {
  try {
    const raw = window.localStorage.getItem(draftStorageKey(orgId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return null;

    const draft = parsed as Record<string, unknown>;
    const color = typeof draft.color === "string" ? draft.color : undefined;
    const title = typeof draft.title === "string" ? draft.title : undefined;
    const description =
      typeof draft.description === "string" ? draft.description : undefined;
    const imageStoragePath =
      typeof draft.imageStoragePath === "string"
        ? draft.imageStoragePath
        : undefined;
    const imageSignedUrl =
      typeof draft.imageSignedUrl === "string"
        ? draft.imageSignedUrl
        : undefined;
    const durationMin =
      typeof draft.durationMin === "number" &&
      Number.isFinite(draft.durationMin)
        ? draft.durationMin
        : undefined;
    const preferredStartTimeMin =
      typeof draft.preferredStartTimeMin === "number" &&
      Number.isFinite(draft.preferredStartTimeMin)
        ? draft.preferredStartTimeMin
        : draft.preferredStartTimeMin === null
          ? null
          : undefined;
    const peopleRequired =
      typeof draft.peopleRequired === "number" &&
      Number.isFinite(draft.peopleRequired)
        ? draft.peopleRequired
        : undefined;
    const minWaitDays =
      typeof draft.minWaitDays === "string" ? draft.minWaitDays : undefined;
    const maxWaitDays =
      typeof draft.maxWaitDays === "string" ? draft.maxWaitDays : undefined;
    const tagIds = isStringArray(draft.tagIds) ? draft.tagIds : [];
    const roleIds = isStringArray(draft.roleIds) ? draft.roleIds : [];

    return {
      ...(color !== undefined ? { color } : {}),
      ...(title !== undefined ? { title } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(imageStoragePath !== undefined ? { imageStoragePath } : {}),
      ...(imageSignedUrl !== undefined ? { imageSignedUrl } : {}),
      ...(durationMin !== undefined ? { durationMin } : {}),
      ...(preferredStartTimeMin !== undefined ? { preferredStartTimeMin } : {}),
      ...(peopleRequired !== undefined ? { peopleRequired } : {}),
      ...(minWaitDays !== undefined ? { minWaitDays } : {}),
      ...(maxWaitDays !== undefined ? { maxWaitDays } : {}),
      tagIds,
      roleIds,
    };
  } catch {
    return null;
  }
}

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
      <span className="text-xs text-muted-foreground">
        {totalMin} min total
      </span>
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
    const hours = Math.floor(min / 60)
      .toString()
      .padStart(2, "0");
    const minutes = (min % 60).toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const [value, setValue] = useState(
    defaultValueMin != null ? toHHMM(defaultValueMin) : "",
  );
  const valueMin = value
    ? value
        .split(":")
        .reduce(
          (hours, minutes, index) =>
            hours + Number(minutes) * (index === 0 ? 60 : 1),
          0,
        )
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
}: {
  orgId: string;
  allRoles: Role[];
  allTags: Tag[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [initialColor] = useState(() => randomColor());
  const storedDraft = useMemo(() => readStoredDraft(orgId), [orgId]);
  const [title, setTitle] = useState(() => storedDraft?.title ?? "");
  const [color, setColor] = useState(() => storedDraft?.color ?? initialColor);
  const [description, setDescription] = useState(
    () => storedDraft?.description ?? "",
  );
  const [selectedImage, setSelectedImage] = useState<{
    storagePath: string;
    signedUrl: string;
  } | null>(() => {
    const storagePath = storedDraft?.imageStoragePath ?? "";
    if (!storagePath) return null;
    return {
      storagePath,
      signedUrl: storedDraft?.imageSignedUrl ?? "",
    };
  });
  const [durationMin, setDurationMin] = useState(
    () => storedDraft?.durationMin ?? 30,
  );
  const [startTimeMin, setStartTimeMin] = useState<number | null>(
    () => storedDraft?.preferredStartTimeMin ?? null,
  );
  const [peopleRequired, setPeopleRequired] = useState(
    () => storedDraft?.peopleRequired ?? 1,
  );
  const [minWaitDays, setMinWaitDays] = useState(
    () => storedDraft?.minWaitDays ?? "1",
  );
  const [maxWaitDays, setMaxWaitDays] = useState(
    () => storedDraft?.maxWaitDays ?? "1",
  );
  const [selectedTags, setSelectedTags] = useState<Tag[]>(() => {
    const tagIds = new Set(storedDraft?.tagIds ?? []);
    return allTags.filter((tag) => tagIds.has(tag.id));
  });
  const [selectedRoles, setSelectedRoles] = useState<Role[]>(() => {
    const roleIds = new Set(storedDraft?.roleIds ?? []);
    return allRoles.filter((role) => roleIds.has(role.id));
  });
  const [discardOpen, setDiscardOpen] = useState(false);
  const [navTarget, setNavTarget] = useState(`/orgs/${orgId}/tasks`);
  const [state, dispatch, pending] = useActionState<
    CreateTaskFormState,
    FormData
  >(createTaskAction.bind(null, orgId), null);
  const [, startTransition] = useTransition();

  const clearDraft = useCallback(() => {
    try {
      window.localStorage.removeItem(draftStorageKey(orgId));
    } catch {
      // Ignore storage failures.
    }
  }, [orgId]);

  const resetForm = useCallback(() => {
    setTitle("");
    setColor(initialColor);
    setDescription("");
    setSelectedImage(null);
    setDurationMin(30);
    setStartTimeMin(null);
    setPeopleRequired(1);
    setMinWaitDays("1");
    setMaxWaitDays("1");
    setSelectedTags([]);
    setSelectedRoles([]);
  }, [initialColor]);

  const draftSnapshot = useMemo<TaskCreateDraft>(
    () => ({
      title,
      description,
      color,
      imageStoragePath: selectedImage?.storagePath ?? "",
      imageSignedUrl: selectedImage?.signedUrl ?? "",
      durationMin,
      preferredStartTimeMin: startTimeMin,
      peopleRequired,
      minWaitDays: normalizeWaitDays(minWaitDays),
      maxWaitDays: normalizeWaitDays(maxWaitDays),
      tagIds: selectedTags.map((tag) => tag.id),
      roleIds: selectedRoles.map((role) => role.id),
    }),
    [
      color,
      description,
      durationMin,
      maxWaitDays,
      minWaitDays,
      peopleRequired,
      selectedImage,
      selectedRoles,
      selectedTags,
      startTimeMin,
      title,
    ],
  );

  const isDraftPristine =
    title === "" &&
    description === "" &&
    color === initialColor &&
    selectedImage === null &&
    durationMin === 30 &&
    startTimeMin === null &&
    peopleRequired === 1 &&
    normalizeWaitDays(minWaitDays) === "1" &&
    normalizeWaitDays(maxWaitDays) === "1" &&
    selectedTags.length === 0 &&
    selectedRoles.length === 0;
  const isDirty = !isDraftPristine;

  useEffect(() => {
    try {
      if (isDraftPristine) {
        window.localStorage.removeItem(draftStorageKey(orgId));
      } else {
        window.localStorage.setItem(
          draftStorageKey(orgId),
          JSON.stringify(draftSnapshot),
        );
      }
    } catch {
      // Ignore storage failures.
    }
  }, [draftSnapshot, isDraftPristine, orgId]);

  useEffect(() => {
    if (!state || state.ok) return;
    const messages = Object.entries(state.errors)
      .flatMap(([field, errs]) =>
        field === "_" ? errs : errs.map((error) => `${field}: ${error}`),
      )
      .join("\n");
    toast.error(messages || "Something went wrong");
  }, [state]);

  useEffect(() => {
    if (!state || !state.ok) return;
    clearDraft();
    toast.success("Task created.");
    router.push(`/orgs/${orgId}/tasks`);
  }, [state, clearDraft, orgId, router]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (isDirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const err = (field: string): string | null =>
    state && !state.ok ? (state.errors[field]?.[0] ?? null) : null;

  const attemptLeave = useCallback(
    (href: string) => {
      if (isDirty) {
        setNavTarget(href);
        setDiscardOpen(true);
      } else {
        router.push(href);
      }
    },
    [isDirty, router],
  );

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("title", title);
    formData.set("description", description);
    formData.set("durationMin", String(durationMin));
    formData.set("minWaitDays", normalizeWaitDays(minWaitDays));
    formData.set("maxWaitDays", normalizeWaitDays(maxWaitDays));
    formData.set(
      "preferredStartTimeMin",
      startTimeMin == null ? "" : String(startTimeMin),
    );
    formData.set("peopleRequired", String(peopleRequired));
    startTransition(() => dispatch(formData));
  };

  const confirmPost = () => {
    setDiscardOpen(false);
    formRef.current?.requestSubmit();
  };

  const confirmEditLater = () => {
    setDiscardOpen(false);
    router.push(navTarget);
  };

  const confirmClearEverything = () => {
    clearDraft();
    resetForm();
    setDiscardOpen(false);
    router.push(navTarget);
  };

  return (
    <>
      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved task draft</AlertDialogTitle>
            <AlertDialogDescription>
              You have a task draft that has not been posted yet. Choose how to
              leave this page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={confirmEditLater}>
              Edit later
            </AlertDialogAction>
            <AlertDialogAction
              className="border-transparent bg-destructive/10 text-destructive hover:bg-destructive/20"
              onClick={confirmClearEverything}
            >
              Clear everything
            </AlertDialogAction>
            <AlertDialogAction onClick={confirmPost}>
              Post task
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TaskEditorFrame
        sidebarContent={
          <SidebarFields
            orgId={orgId}
            color={color}
            onColorChange={setColor}
            selectedImage={selectedImage}
            onImageSelect={(storagePath, signedUrl) =>
              setSelectedImage({ storagePath, signedUrl })
            }
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
            <button
              type="button"
              onClick={() => attemptLeave(`/orgs/${orgId}/tasks`)}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              ← Tasks
            </button>
            <div className="ml-auto flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => attemptLeave(`/orgs/${orgId}/tasks`)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="task-create-form"
                size="sm"
                disabled={pending}
              >
                {pending ? "Posting…" : "Post task"}
              </Button>
            </div>
          </>
        }
      >
        <form
          ref={formRef}
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
          <input
            type="hidden"
            name="preferredStartTimeMin"
            value={startTimeMin ?? ""}
          />
          <input type="hidden" name="peopleRequired" value={peopleRequired} />
          <input
            type="hidden"
            name="minWaitDays"
            value={normalizeWaitDays(minWaitDays)}
          />
          <input
            type="hidden"
            name="maxWaitDays"
            value={normalizeWaitDays(maxWaitDays)}
          />

          {err("_") && (
            <p role="alert" className="text-sm text-destructive">
              {err("_")}
            </p>
          )}

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
                value={title}
                onChange={(event) => setTitle(event.target.value)}
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
                key={orgId}
                name="description"
                defaultValue={description}
                placeholder="Add details, steps, or notes…"
                minHeightClass="min-h-80"
                ariaLabel="Description"
                onChange={setDescription}
                ariaInvalid={!!err("description")}
                ariaDescribedBy={
                  err("description") ? "description-error" : undefined
                }
              />
              {err("description") && (
                <p id="description-error" className="text-xs text-destructive">
                  {err("description")}
                </p>
              )}
            </div>

            <div className="rounded-xl border bg-card p-5">
              <TagPanel
                mode="create"
                allTags={allTags}
                selectedTags={selectedTags}
                onSelectedTagsChange={setSelectedTags}
              />
            </div>

            <div className="rounded-xl border bg-card p-5">
              <EligibilityPanel
                mode="create"
                allRoles={allRoles}
                selectedRoles={selectedRoles}
                onSelectedRolesChange={setSelectedRoles}
              />
            </div>
          </div>
        </form>
      </TaskEditorFrame>
    </>
  );
}
