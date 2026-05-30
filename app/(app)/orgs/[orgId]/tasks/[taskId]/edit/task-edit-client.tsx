"use client";

/**
 * TaskEditClient — full edit-mode UI for a task.
 *
 * Layout
 *   Toolbar     — ← Task | [Discard (destructive)] [Save changes]
 *   PageSidebar — Color · Duration · Preferred start · People · Wait days
 *   Main        — Title · Photo · Description (WYSIWYG) · Eligibility · Tags
 *
 * Tags and eligibility roles are held in LOCAL STATE and only committed to the
 * database when the user presses "Save changes". Creating a new tag still
 * creates the org-level tag record immediately (so it can be referenced by ID)
 * but the task attachment is deferred until save.
 *
 * Unsaved-changes guard:
 *   • Clicking ← Task or Discard while dirty → AlertDialog with
 *     Keep editing / Discard / Save choices.
 *   • Browser close / refresh / URL-bar navigation → native beforeunload prompt.
 */

import {
  useState,
  useMemo,
  useEffect,
  useTransition,
  useActionState,
  useCallback,
  useRef,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Clock, Users, AlarmClock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ColorPicker } from "@/components/ui/color-picker";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import {
  SearchableCombobox,
  type ComboboxItem,
} from "@/components/ui/searchable-combobox";
import { RegisterPageToolbar } from "@/components/layout/toolbar-context";
import { RegisterPageSidebarSubContent } from "@/components/layout/page-sidebar-context";
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
import { updateTaskAction, createTagOnlyAction } from "@/app/actions/tasks";
import type { TaskFormState } from "@/app/actions/tasks";
import { ImageUploadPanel } from "../../task-form";
import type { Role, Tag } from "../../task-form";

// ─── Deferred Tag Panel ───────────────────────────────────────────────────────
//
// Holds local state pre-populated from the task's existing tags.
// Creates new org tags immediately (so they get an ID) but defers attachment
// until form save. Emits hidden <input name="tagIds"> + a sentinel so the
// server action knows to overwrite the existing list.

interface DeferredTagPanelProps {
  orgId: string;
  allTags: Tag[];
  initialTags: Tag[];
  onDirty: () => void;
}

function DeferredTagPanel({
  orgId,
  allTags,
  initialTags,
  onDirty,
}: DeferredTagPanelProps) {
  const [tags, setTags] = useState<Tag[]>(initialTags);
  const [knownTags, setKnownTags] = useState<Tag[]>(allTags);
  const [isPending, startCreateTransition] = useTransition();

  const tagIds = new Set(tags.map((t) => t.id));
  const availableItems = knownTags.filter((t) => !tagIds.has(t.id));

  const add = (item: ComboboxItem) => {
    const tag = knownTags.find((t) => t.id === item.id);
    if (!tag) return;
    setTags((prev) => [...prev, tag]);
    onDirty();
  };

  const createNew = (name: string) => {
    startCreateTransition(async () => {
      const res = await createTagOnlyAction(orgId, name);
      if (res.ok) {
        setKnownTags((prev) => [...prev, res.tag]);
        setTags((prev) => [...prev, res.tag]);
        onDirty();
      } else {
        toast.error(res.error);
      }
    });
  };

  const remove = (tagId: string) => {
    setTags((prev) => prev.filter((t) => t.id !== tagId));
    onDirty();
  };

  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-medium">Tags</span>

      {/* Sentinel + per-tag hidden inputs consumed by updateTaskAction */}
      <input type="hidden" name="tagsSubmitted" value="1" />
      {tags.map((tag) => (
        <input key={tag.id} type="hidden" name="tagIds" value={tag.id} />
      ))}

      <SearchableCombobox
        items={availableItems}
        onSelect={add}
        onCreate={createNew}
        triggerLabel="Add tag"
        placeholder="Search or create tags…"
        emptyText="No tags found"
        disabled={isPending}
      />

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs"
            >
              {tag.color && (
                <span
                  className="inline-block w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: tag.color }}
                />
              )}
              {tag.name}
              <button
                type="button"
                className="ml-0.5 hover:text-destructive transition-colors leading-none"
                onClick={() => remove(tag.id)}
                aria-label={`Remove ${tag.name}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Deferred Roles Panel ─────────────────────────────────────────────────────
//
// Same deferred pattern for role eligibility.

interface DeferredRolesPanelProps {
  allRoles: Role[];
  initialRoles: Role[];
  onDirty: () => void;
}

function DeferredRolesPanel({
  allRoles,
  initialRoles,
  onDirty,
}: DeferredRolesPanelProps) {
  const [roles, setRoles] = useState<Role[]>(initialRoles);

  const roleIds = new Set(roles.map((r) => r.id));
  const availableItems = allRoles.filter((r) => !roleIds.has(r.id));

  const add = (item: ComboboxItem) => {
    const role = allRoles.find((r) => r.id === item.id);
    if (!role) return;
    setRoles((prev) => [...prev, role]);
    onDirty();
  };

  const remove = (roleId: string) => {
    setRoles((prev) => prev.filter((r) => r.id !== roleId));
    onDirty();
  };

  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-medium">Eligible roles</span>

      {/* Sentinel + per-role hidden inputs consumed by updateTaskAction */}
      <input type="hidden" name="rolesSubmitted" value="1" />
      {roles.map((role) => (
        <input key={role.id} type="hidden" name="roleIds" value={role.id} />
      ))}

      <SearchableCombobox
        items={availableItems}
        onSelect={add}
        triggerLabel="Add role"
        placeholder="Search roles…"
        emptyText="No roles found"
      />

      {roles.length === 0 ? (
        <p className="text-xs text-muted-foreground">All roles eligible</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {roles.map((role) => (
            <span
              key={role.id}
              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs"
            >
              {role.color && (
                <span
                  className="inline-block w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: role.color }}
                />
              )}
              {role.name}
              <button
                type="button"
                className="ml-0.5 hover:text-destructive transition-colors leading-none"
                onClick={() => remove(role.id)}
                aria-label={`Remove ${role.name}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sidebar pickers ──────────────────────────────────────────────────────────

function SidebarDurationPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (min: number) => void;
}) {
  const hours = Math.floor(value / 60);
  const mins = Math.round((value % 60) / 5) * 5;

  const selectClass =
    "h-9 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 w-full";

  return (
    <div className="flex items-center gap-2">
      <select
        value={hours}
        onChange={(e) => onChange(Number(e.target.value) * 60 + mins)}
        className={selectClass}
        aria-label="Hours"
      >
        {Array.from({ length: 24 }, (_, i) => (
          <option key={i} value={i}>
            {i}h
          </option>
        ))}
      </select>
      <select
        value={mins}
        onChange={(e) => onChange(hours * 60 + Number(e.target.value))}
        className={selectClass}
        aria-label="Minutes"
      >
        {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
          <option key={m} value={m}>
            {m}m
          </option>
        ))}
      </select>
    </div>
  );
}

function SidebarStartTimePicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (min: number | null) => void;
}) {
  const toHHMM = (min: number) => {
    const h = Math.floor(min / 60).toString().padStart(2, "0");
    const m = (min % 60).toString().padStart(2, "0");
    return `${h}:${m}`;
  };

  return (
    <Input
      type="time"
      value={value != null ? toHHMM(value) : ""}
      onChange={(e) => {
        const v = e.target.value;
        if (!v) {
          onChange(null);
          return;
        }
        const [h, m] = v.split(":").map(Number);
        onChange(h * 60 + m);
      }}
      className="w-full"
    />
  );
}

// ── Sidebar content ───────────────────────────────────────────────────────────

interface SidebarFieldsProps {
  color: string;
  onColorChange: (v: string) => void;
  durationMin: number;
  onDurationChange: (v: number) => void;
  startTimeMin: number | null;
  onStartTimeChange: (v: number | null) => void;
  peopleRequired: number;
  onPeopleChange: (v: number) => void;
  minWaitDays: string;
  onMinWaitDaysChange: (v: string) => void;
  maxWaitDays: string;
  onMaxWaitDaysChange: (v: string) => void;
  // Photo
  orgId: string;
  taskId: string;
  imageSignedUrl: string | null;
  fallbackInitial: string;
}

function SidebarFields({
  color,
  onColorChange,
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
  orgId,
  taskId,
  imageSignedUrl,
  fallbackInitial,
}: SidebarFieldsProps) {
  const fieldClass = "flex flex-col gap-1.5";
  const labelClass =
    "text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5";
  const inputClass = "h-9 text-sm";

  return (
    <div className="flex flex-col gap-5 p-4 pt-3">
      {/* Photo */}
      <div className={fieldClass}>
        <ImageUploadPanel
          orgId={orgId}
          taskId={taskId}
          initialSignedUrl={imageSignedUrl}
          layout="sidebar"
          fallbackColor={color}
          fallbackInitial={fallbackInitial}
        />
      </div>
      {/* Color */}
      <div className={fieldClass}>
        <span className={labelClass}>Color</span>
        <div className="flex items-center gap-2">
          <ColorPicker value={color} onChange={onColorChange} />
          <span className="text-xs text-muted-foreground font-mono">
            {color.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Duration */}
      <div className={fieldClass}>
        <span className={labelClass}>
          <Clock className="h-3.5 w-3.5" />
          Duration
        </span>
        <SidebarDurationPicker value={durationMin} onChange={onDurationChange} />
        <span className="text-xs text-muted-foreground">
          {durationMin} min total
        </span>
      </div>

      {/* Preferred start time */}
      <div className={fieldClass}>
        <span className={labelClass}>
          <AlarmClock className="h-3.5 w-3.5" />
          Preferred start
        </span>
        <SidebarStartTimePicker
          value={startTimeMin}
          onChange={onStartTimeChange}
        />
        {startTimeMin != null && (
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-destructive transition-colors text-left"
            onClick={() => onStartTimeChange(null)}
          >
            Clear
          </button>
        )}
      </div>

      {/* People required */}
      <div className={fieldClass}>
        <span className={labelClass}>
          <Users className="h-3.5 w-3.5" />
          People required
        </span>
        <Input
          type="number"
          min={1}
          max={50}
          value={peopleRequired}
          onChange={(e) => onPeopleChange(Number(e.target.value))}
          className={inputClass}
        />
      </div>

      {/* Wait days */}
      <div className={fieldClass}>
        <span className={labelClass}>
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
              className={inputClass}
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
              className={inputClass}
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

// ── Main component ────────────────────────────────────────────────────────────

interface TaskEditClientProps {
  orgId: string;
  taskId: string;
  allRoles: Role[];
  eligibleRoles: Role[];
  allTags: Tag[];
  taskTags: Tag[];
  imageSignedUrl?: string | null;
  defaultValues: {
    color: string;
    title: string;
    description?: string | null;
    durationMin: number;
    preferredStartTimeMin?: number | null;
    peopleRequired?: number | null;
    minWaitDays?: number | null;
    maxWaitDays?: number | null;
  };
}

export function TaskEditClient({
  orgId,
  taskId,
  allRoles,
  eligibleRoles,
  allTags,
  taskTags,
  imageSignedUrl,
  defaultValues,
}: TaskEditClientProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  // ── Dirty tracking ─────────────────────────────────────────────────────────
  const [isDirty, setIsDirty] = useState(false);
  const markDirty = useCallback(() => setIsDirty(true), []);

  // ── Sidebar-controlled field state ────────────────────────────────────────
  const [color, setColor] = useState(defaultValues.color);
  const [durationMin, setDurationMin] = useState(defaultValues.durationMin);
  const [startTimeMin, setStartTimeMin] = useState<number | null>(
    defaultValues.preferredStartTimeMin ?? null,
  );
  const [peopleRequired, setPeopleRequired] = useState(
    defaultValues.peopleRequired ?? 1,
  );
  const [minWaitDays, setMinWaitDays] = useState(
    defaultValues.minWaitDays?.toString() ?? "",
  );
  const [maxWaitDays, setMaxWaitDays] = useState(
    defaultValues.maxWaitDays?.toString() ?? "",
  );

  // Dirty-tracking wrappers for sidebar setters
  const setColorDirty = (v: string) => { setColor(v); markDirty(); };
  const setDurationDirty = (v: number) => { setDurationMin(v); markDirty(); };
  const setStartTimeDirty = (v: number | null) => { setStartTimeMin(v); markDirty(); };
  const setPeopleDirty = (v: number) => { setPeopleRequired(v); markDirty(); };
  const setMinWaitDirty = (v: string) => { setMinWaitDays(v); markDirty(); };
  const setMaxWaitDirty = (v: string) => { setMaxWaitDays(v); markDirty(); };

  // ── Navigation guard ───────────────────────────────────────────────────────
  const [discardOpen, setDiscardOpen] = useState(false);
  const [navTarget, setNavTarget] = useState(`/orgs/${orgId}/tasks/${taskId}`);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

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

  const confirmDiscard = () => {
    setIsDirty(false);
    setDiscardOpen(false);
    router.push(navTarget);
  };

  const confirmSaveAndLeave = () => {
    setDiscardOpen(false);
    formRef.current?.requestSubmit();
  };

  // ── Form action ────────────────────────────────────────────────────────────
  const boundAction = updateTaskAction.bind(null, orgId, taskId);
  const [state, dispatch, pending] = useActionState<TaskFormState, FormData>(
    boundAction,
    null,
  );
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!state) return;
    if (!state.ok) {
      const messages = Object.entries(
        (state as { ok: false; errors: Record<string, string[]> }).errors,
      )
        .flatMap(([field, errs]) =>
          field === "_" ? errs : errs.map((e) => `${field}: ${e}`),
        )
        .join("\n");
      toast.error(messages || "Something went wrong");
    } else {
      toast.success("Task saved.");
      setIsDirty(false);
      router.push(navTarget);
    }
    // navTarget intentionally excluded — we only want to read it at submit time
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, router]);

  const err = (field: string): string | null =>
    state && !state.ok
      ? ((state as { ok: false; errors: Record<string, string[]> }).errors[
          field
        ]?.[0] ?? null)
      : null;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => dispatch(fd));
  };

  // ── Memoized sidebar content ───────────────────────────────────────────────
  const sidebarContent = useMemo(
    () => (
      <SidebarFields
        color={color}
        onColorChange={setColorDirty}
        durationMin={durationMin}
        onDurationChange={setDurationDirty}
        startTimeMin={startTimeMin}
        onStartTimeChange={setStartTimeDirty}
        peopleRequired={peopleRequired}
        onPeopleChange={setPeopleDirty}
        minWaitDays={minWaitDays}
        onMinWaitDaysChange={setMinWaitDirty}
        maxWaitDays={maxWaitDays}
        onMaxWaitDaysChange={setMaxWaitDirty}
        orgId={orgId}
        taskId={taskId}
        imageSignedUrl={imageSignedUrl ?? null}
        fallbackInitial={defaultValues.title.charAt(0)}
      />
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [color, durationMin, startTimeMin, peopleRequired, minWaitDays, maxWaitDays],
  );

  return (
    <>
      {/* ── Sidebar: metadata fields ──────────────────────────────────────── */}
      <RegisterPageSidebarSubContent content={sidebarContent} />

      {/* ── Unsaved-changes confirmation dialog ──────────────────────────── */}
      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Would you like to save them before leaving?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive/10 text-destructive hover:bg-destructive/20 border-transparent"
              onClick={confirmDiscard}
            >
              Discard
            </AlertDialogAction>
            <AlertDialogAction onClick={confirmSaveAndLeave}>
              Save changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Toolbar: navigation + save/discard ───────────────────────────── */}
      <RegisterPageToolbar>
        <button
          type="button"
          onClick={() => attemptLeave(`/orgs/${orgId}/tasks/${taskId}`)}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          ← Task
        </button>
        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => attemptLeave(`/orgs/${orgId}/tasks/${taskId}`)}
            disabled={pending}
          >
            Discard
          </Button>
          <Button
            type="submit"
            form="task-edit-form"
            size="sm"
            disabled={pending}
          >
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </RegisterPageToolbar>

      {/* ── Main form ─────────────────────────────────────────────────────── */}
      <form
        ref={formRef}
        id="task-edit-form"
        onSubmit={handleSubmit}
        className="w-full max-w-3xl mx-auto flex flex-col gap-6"
      >
        {/* Hidden inputs for sidebar-controlled fields */}
        <input type="hidden" name="color" value={color} />
        <input type="hidden" name="durationMin" value={durationMin} />
        <input
          type="hidden"
          name="preferredStartTimeMin"
          value={startTimeMin ?? ""}
        />
        <input type="hidden" name="peopleRequired" value={peopleRequired} />
        <input type="hidden" name="minWaitDays" value={minWaitDays} />
        <input type="hidden" name="maxWaitDays" value={maxWaitDays} />

        {/* Global error */}
        {err("_") && (
          <p role="alert" className="text-sm text-destructive">
            {err("_")}
          </p>
        )}

        {/* ── 1. Title ────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="title" className="text-sm font-medium">
            Title <span className="text-destructive">*</span>
          </label>
          <Input
            id="title"
            name="title"
            type="text"
            required
            placeholder="e.g. Deep clean kitchen"
            defaultValue={defaultValues.title}
            onChange={markDirty}
            aria-invalid={!!err("title")}
            aria-describedby={err("title") ? "title-error" : undefined}
          />
          {err("title") && (
            <p id="title-error" className="text-xs text-destructive">
              {err("title")}
            </p>
          )}
        </div>

        {/* ── 2. Description ──────────────────────────────────────────────── */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Description</label>
          <RichTextEditor
            name="description"
            defaultValue={defaultValues.description}
            placeholder="Add details, steps, or notes…"
            minHeightClass="min-h-80"
            onChange={markDirty}
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

        {/* ── 3. Eligible roles ────────────────────────────────────────────── */}
        <div className="rounded-xl border bg-card p-5">
          <DeferredRolesPanel
            allRoles={allRoles}
            initialRoles={eligibleRoles}
            onDirty={markDirty}
          />
        </div>

        {/* ── 4. Tags ──────────────────────────────────────────────────────── */}
        <div className="rounded-xl border bg-card p-5">
          <DeferredTagPanel
            orgId={orgId}
            allTags={allTags}
            initialTags={taskTags}
            onDirty={markDirty}
          />
        </div>
      </form>
    </>
  );
}
