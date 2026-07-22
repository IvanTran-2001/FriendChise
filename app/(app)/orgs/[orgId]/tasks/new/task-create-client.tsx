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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { randomColor } from "@/components/ui/pickers/color-picker";
import { RichTextEditor } from "@/components/ui/editors/rich-text-editor";
import { createTaskAction } from "@/app/actions/tasks";
import type { CreateTaskFormState } from "@/app/actions/tasks";
import { suggestTaskDetailsAction } from "@/app/actions/ai/task-suggestions";
import { TagPanel, EligibilityPanel } from "../task-panels";
import type { Role, Tag } from "../task-panels";
import type { TaskToolSelection } from "../_components/task-tools-picker";
import { TaskSidebarContent } from "./_components/task-sidebar-content";
import { TaskEditorShell } from "@/app/(app)/orgs/[orgId]/tasks/_components/task-editor-shell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/dialogs/alert-dialog";

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
  toolLinks: TaskToolSelection[];
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

function isTaskToolSelectionArray(value: unknown): value is TaskToolSelection[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item === "object" &&
        !Array.isArray(item) &&
        typeof (item as { toolPath?: unknown }).toolPath === "string" &&
        ((item as { toolLabel?: unknown }).toolLabel === null ||
          typeof (item as { toolLabel?: unknown }).toolLabel === "string"),
    )
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
    const toolLinks = isTaskToolSelectionArray(draft.toolLinks)
      ? draft.toolLinks
      : [];

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
      toolLinks,
    };
  } catch {
    return null;
  }
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
  initialSearch?: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [initialColor] = useState(() => randomColor());
  const storedDraft = useMemo(() => readStoredDraft(orgId), [orgId]);
  const initialTitle = storedDraft?.title ?? initialSearch ?? "";
  const [title, setTitle] = useState(() => initialTitle);
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
  const [selectedTools, setSelectedTools] = useState<TaskToolSelection[]>(() =>
    isTaskToolSelectionArray(storedDraft?.toolLinks) ? storedDraft.toolLinks : [],
  );
  const [discardOpen, setDiscardOpen] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
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
    setTitle(initialTitle);
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
    setSelectedTools([]);
  }, [initialColor, initialTitle]);

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
      toolLinks: selectedTools,
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
      selectedTools,
      startTimeMin,
      title,
    ],
  );

  const isDraftPristine =
    title === initialTitle &&
    description === "" &&
    color === initialColor &&
    selectedImage === null &&
    durationMin === 30 &&
    startTimeMin === null &&
    peopleRequired === 1 &&
    normalizeWaitDays(minWaitDays) === "1" &&
    normalizeWaitDays(maxWaitDays) === "1" &&
    selectedTags.length === 0 &&
    selectedRoles.length === 0 &&
    selectedTools.length === 0;
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

  const handleSuggestDetails = async () => {
    if (pending || isSuggesting) return;

    setIsSuggesting(true);
    try {
      const result = await suggestTaskDetailsAction(orgId, {
        title,
        description,
        durationMin,
        peopleRequired,
        minWaitDays: Number(normalizeWaitDays(minWaitDays)),
        maxWaitDays: Number(normalizeWaitDays(maxWaitDays)),
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      const suggestion = result.suggestion;
      if (!title.trim()) setTitle(suggestion.title);
      if (!description.trim()) setDescription(suggestion.description);
      if (durationMin === 30) setDurationMin(suggestion.durationMin);
      if (peopleRequired === 1) setPeopleRequired(suggestion.peopleRequired);
      if (normalizeWaitDays(minWaitDays) === "1") {
        setMinWaitDays(String(suggestion.minWaitDays));
      }
      if (normalizeWaitDays(maxWaitDays) === "1") {
        setMaxWaitDays(String(suggestion.maxWaitDays));
      }
      toast.success("Suggested task details.");
    } catch {
      toast.error("Failed to generate suggestions. Please try again.");
    } finally {
      setIsSuggesting(false);
    }
  };

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

      <TaskEditorShell
        sidebarContent={
          <TaskSidebarContent
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
            selectedTools={selectedTools}
            onSelectedToolsChange={setSelectedTools}
          />
        }
        toolbarContent={
          <>
            <button
              type="button"
              onClick={() => attemptLeave(`/orgs/${orgId}/tasks`)}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
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
          {selectedTools.map((tool) => (
            <input
              key={tool.toolPath}
              type="hidden"
              name="toolPaths"
              value={tool.toolPath}
            />
          ))}
          {selectedTools.map((tool) => (
            <input
              key={`${tool.toolPath}-label`}
              type="hidden"
              name="toolLabels"
              value={tool.toolLabel ?? ""}
            />
          ))}

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
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Use the task assistant to draft a clearer description and sane defaults.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSuggestDetails}
                  disabled={
                    pending ||
                    isSuggesting ||
                    (!title.trim() && !description.trim())
                  }
                >
                  {isSuggesting ? "Suggesting…" : "Suggest details"}
                </Button>
              </div>
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
                orgId={orgId}
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
      </TaskEditorShell>
    </>
  );
}
