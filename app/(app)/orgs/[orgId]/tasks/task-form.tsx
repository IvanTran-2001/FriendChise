"use client";

/**
 * Shared form for creating and editing tasks.
 *
 * Layout: two-column.
 *   Left  — task fields (title, description, duration, etc.)
 *   Right — role eligibility panel (searchable dropdown + current list)
 *
 * Props:
 *   mode="create" — submits createTaskAction (redirects on success)
 *   mode="edit"   — submits updateTaskAction (stays on page, shows toast)
 *
 * Eligibility is managed live via addEligibilityAction / removeEligibilityAction.
 * In create mode, eligibility can only be set after the task exists (edit page).
 */

import {
  useActionState,
  useEffect,
  useTransition,
  useState,
  useRef,
} from "react";
import { toast } from "sonner";
import {
  createTaskAction,
  updateTaskAction,
  addEligibilityAction,
  removeEligibilityAction,
} from "@/app/actions/tasks";
import type { CreateTaskFormState, TaskFormState } from "@/app/actions/tasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Role = { id: string; name: string; color: string | null };

type TaskFormProps =
  | {
      mode: "create";
      orgId: string;
      allRoles: Role[];
    }
  | {
      mode: "edit";
      orgId: string;
      taskId: string;
      allRoles: Role[];
      eligibleRoles: Role[];
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
    };

// ─── Shared eligibility panel ─────────────────────────────────────────────────
//
// create mode: pure local state + hidden inputs submitted with the form.
// edit mode:   same UI but add/remove fire server actions immediately.

type EligibilityPanelProps =
  | { mode: "create"; allRoles: Role[] }
  | {
      mode: "edit";
      orgId: string;
      taskId: string;
      allRoles: Role[];
      eligibleRoles: Role[];
    };

/**
 * Role eligibility panel used inside `TaskForm`.
 *
 * In **create** mode the selected roles are held in local state and emitted as
 * hidden `<input name="roleIds">` elements so they travel with the FormData
 * on submit.
 *
 * In **edit** mode each add/remove fires an immediate server action
 * (`addEligibilityAction` / `removeEligibilityAction`) so changes persist
 * without a full form submit.
 */
function EligibilityPanel(props: EligibilityPanelProps) {
  const isEdit = props.mode === "edit";
  const [roles, setRoles] = useState<Role[]>(isEdit ? props.eligibleRoles : []);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const roleIds = new Set(roles.map((r) => r.id));
  const filtered = props.allRoles.filter(
    (r) =>
      !roleIds.has(r.id) && r.name.toLowerCase().includes(search.toLowerCase()),
  );

  const add = (role: Role) => {
    setSearch("");
    setOpen(false);
    inputRef.current?.blur();
    if (isEdit) {
      startTransition(async () => {
        const res = await addEligibilityAction(
          props.orgId,
          props.taskId,
          role.id,
        );
        if (res.ok) setRoles((prev) => [...prev, role]);
        else toast.error(res.error);
      });
    } else {
      setRoles((prev) => [...prev, role]);
    }
  };

  const remove = (roleId: string) => {
    if (isEdit) {
      startTransition(async () => {
        const res = await removeEligibilityAction(
          props.orgId,
          props.taskId,
          roleId,
        );
        if (res.ok) setRoles((prev) => prev.filter((r) => r.id !== roleId));
        else toast.error(res.error);
      });
    } else {
      setRoles((prev) => prev.filter((r) => r.id !== roleId));
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-medium">Eligible roles</span>

      {/* Hidden inputs for create mode — picked up by FormData on submit */}
      {!isEdit &&
        roles.map((role) => (
          <input key={role.id} type="hidden" name="roleIds" value={role.id} />
        ))}

      {/* Searchable role dropdown */}
      <div className="relative">
        <Input
          ref={inputRef}
          placeholder="Search roles..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="h-8 text-sm"
          disabled={isPending}
        />
        {open && filtered.length > 0 && (
          <div className="absolute z-20 top-full mt-1 w-full rounded-md border bg-popover shadow-md max-h-48 overflow-y-auto">
            {filtered.map((role) => (
              <button
                key={role.id}
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2"
                onMouseDown={(e) => {
                  e.preventDefault();
                  add(role);
                }}
              >
                {role.color && (
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: role.color }}
                  />
                )}
                {role.name}
              </button>
            ))}
          </div>
        )}
        {open && filtered.length === 0 && search.trim() !== "" && (
          <div className="absolute z-20 top-full mt-1 w-full rounded-md border bg-popover shadow-md px-3 py-2 text-sm text-muted-foreground">
            No roles found
          </div>
        )}
      </div>

      {/* Current role list */}
      <div className="rounded-md border min-h-20">
        {roles.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground text-center">
            All roles eligible
          </p>
        ) : (
          <ul>
            {roles.map((role) => (
              <li
                key={role.id}
                className="flex items-center justify-between px-3 py-2 border-b last:border-0 text-sm"
              >
                <span className="flex items-center gap-2">
                  {role.color && (
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: role.color }}
                    />
                  )}
                  {role.name}
                </span>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-destructive leading-none px-1 py-0.5 rounded transition-colors"
                  onClick={() => remove(role.id)}
                  disabled={isPending}
                  aria-label={`Remove ${role.name}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── Duration picker ──────────────────────────────────────────────────────────

/**
 * Hours + minutes selects that submit a single hidden `name` input
 * containing the total minutes (as a string number).
 */
function DurationPicker({
  defaultValueMin,
  name,
  error,
}: {
  defaultValueMin: number;
  name: string;
  error: string | null;
}) {
  const [hours, setHours] = useState(Math.floor(defaultValueMin / 60));
  const [minutes, setMinutes] = useState(defaultValueMin % 60);
  const totalMin = hours * 60 + minutes;

  return (
    <div className="flex items-center gap-2">
      <input type="hidden" name={name} value={totalMin} />
      <select
        value={hours}
        onChange={(e) => setHours(Number(e.target.value))}
        className="h-9 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
        aria-label="Hours"
        aria-invalid={!!error}
      >
        {Array.from({ length: 24 }, (_, i) => (
          <option key={i} value={i}>{i}h</option>
        ))}
      </select>
      <select
        value={minutes}
        onChange={(e) => setMinutes(Number(e.target.value))}
        className="h-9 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
        aria-label="Minutes"
        aria-invalid={!!error}
      >
        {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
          <option key={m} value={m}>{m}m</option>
        ))}
      </select>
      <span className="text-xs text-muted-foreground">{totalMin} min total</span>
    </div>
  );
}

/**
 * A `type="time"` input that submits minutes-since-midnight (or empty string
 * if the field is cleared) as the hidden `name` input.
 */
function StartTimePicker({
  defaultValueMin,
  name,
  error,
}: {
  defaultValueMin: number | null;
  name: string;
  error: string | null;
}) {
  const toHHMM = (min: number) => {
    const h = Math.floor(min / 60).toString().padStart(2, "0");
    const m = (min % 60).toString().padStart(2, "0");
    return `${h}:${m}`;
  };
  const [value, setValue] = useState(
    defaultValueMin != null ? toHHMM(defaultValueMin) : "",
  );
  const valueMin = value ? value.split(":").reduce((h, m, i) => h + Number(m) * (i === 0 ? 60 : 1), 0) : "";

  return (
    <>
      <input type="hidden" name={name} value={valueMin} />
      <Input
        id={name}
        type="time"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-invalid={!!error}
        className="w-40"
      />
    </>
  );
}

// ─── Main form ────────────────────────────────────────────────────────────────

/**
 * Two-column task form (create / edit).
 *
 * Left column  — task fields: title, color picker, description, duration,
 *                preferred start time, people required, min/max wait days.
 * Right column — `EligibilityPanel` for picking which roles can be assigned.
 *
 * Color is managed via a `useState` lazy initialiser (random hex for new tasks,
 * pre-filled from `defaultValues.color` for edits). A hidden
 * `<input name="color">` keeps the value in sync with `FormData` so it flows
 * through the server action without a controlled form library.
 *
 * Form state errors are rendered inline with `aria-invalid`/`aria-describedby`
 * and summarised in a Sonner toast.
 */
export function TaskForm(props: TaskFormProps) {
  const isEdit = props.mode === "edit";

  const dv = isEdit ? props.defaultValues : null;

  const [color, setColor] = useState(() => dv?.color ?? "#6366f1");

  useEffect(() => {
    if (!isEdit) {
      // Randomize color on mount only (stable fallback used during SSR to avoid hydration mismatch)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setColor(
        `#${Math.floor(Math.random() * 0xffffff)
          .toString(16)
          .padStart(6, "0")}`,
      );
    }
  }, [isEdit]);

  const boundAction = isEdit
    ? updateTaskAction.bind(null, props.orgId, props.taskId)
    : createTaskAction.bind(null, props.orgId);

  const [state, dispatch, pending] = useActionState<
    CreateTaskFormState | TaskFormState,
    FormData
  >(
    boundAction as (
      prev: CreateTaskFormState | TaskFormState,
      fd: FormData,
    ) => Promise<CreateTaskFormState | TaskFormState>,
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
    } else if (isEdit) {
      toast.success("Task saved");
    }
  }, [state, isEdit]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => dispatch(formData));
  };

  const err = (field: string): string | null =>
    state && !state.ok
      ? ((state as { ok: false; errors: Record<string, string[]> }).errors[
          field
        ]?.[0] ?? null)
      : null;

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8 items-start"
    >
      {/* ── Left: task fields ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-5">
        {err("_") && (
          <p role="alert" className="text-sm text-destructive">
            {err("_")}
          </p>
        )}

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
            defaultValue={dv?.title}
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
          <label htmlFor="color" className="text-sm font-medium">
            Color <span className="text-destructive">*</span>
          </label>
          <div className="flex items-center gap-3">
            <input type="hidden" name="color" value={color} />
            <input
              id="color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              aria-invalid={!!err("color")}
              aria-describedby={err("color") ? "color-error" : undefined}
              className="h-9 w-14 cursor-pointer rounded-md border border-input p-0.5 bg-background"
            />
            <span className="text-sm text-muted-foreground font-mono">
              {color}
            </span>
          </div>
          {err("color") && (
            <p id="color-error" className="text-xs text-destructive">
              {err("color")}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="description" className="text-sm font-medium">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            placeholder="Optional details..."
            defaultValue={dv?.description ?? undefined}
            className="border rounded-md px-3 py-2 text-sm bg-card resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            aria-invalid={!!err("description")}
            aria-describedby={
              err("description") ? "description-error" : undefined
            }
          />
          {err("description") && (
            <p id="description-error" className="text-xs text-destructive">
              {err("description")}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="durationMin" className="text-sm font-medium">
            Duration <span className="text-destructive">*</span>
          </label>
          <DurationPicker
            defaultValueMin={dv?.durationMin ?? 30}
            name="durationMin"
            error={err("durationMin")}
          />
          {err("durationMin") && (
            <p id="durationMin-error" className="text-xs text-destructive">
              {err("durationMin")}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="preferredStartTimeMin" className="text-sm font-medium">
            Preferred start time
          </label>
          <StartTimePicker
            defaultValueMin={dv?.preferredStartTimeMin ?? null}
            name="preferredStartTimeMin"
            error={err("preferredStartTimeMin")}
          />
          {err("preferredStartTimeMin") && (
            <p id="preferredStartTimeMin-error" className="text-xs text-destructive">
              {err("preferredStartTimeMin")}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="peopleRequired" className="text-sm font-medium">
            People required
          </label>
          <Input
            id="peopleRequired"
            name="peopleRequired"
            type="number"
            min={1}
            max={50}
            defaultValue={dv?.peopleRequired ?? 1}
            aria-invalid={!!err("peopleRequired")}
            aria-describedby={
              err("peopleRequired") ? "peopleRequired-error" : undefined
            }
          />
          {err("peopleRequired") && (
            <p id="peopleRequired-error" className="text-xs text-destructive">
              {err("peopleRequired")}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="minWaitDays" className="text-sm font-medium">
              Min wait days
            </label>
            <Input
              id="minWaitDays"
              name="minWaitDays"
              type="number"
              min={0}
              max={3650}
              placeholder="e.g. 7"
              defaultValue={dv?.minWaitDays ?? undefined}
              aria-invalid={!!err("minWaitDays")}
              aria-describedby={
                err("minWaitDays") ? "minWaitDays-error" : undefined
              }
            />
            {err("minWaitDays") && (
              <p id="minWaitDays-error" className="text-xs text-destructive">
                {err("minWaitDays")}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="maxWaitDays" className="text-sm font-medium">
              Max wait days
            </label>
            <Input
              id="maxWaitDays"
              name="maxWaitDays"
              type="number"
              min={1}
              max={3650}
              placeholder="e.g. 14"
              defaultValue={dv?.maxWaitDays ?? undefined}
              aria-invalid={!!err("maxWaitDays")}
              aria-describedby={
                err("maxWaitDays") ? "maxWaitDays-error" : undefined
              }
            />
            {err("maxWaitDays") && (
              <p id="maxWaitDays-error" className="text-xs text-destructive">
                {err("maxWaitDays")}
              </p>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground -mt-3">
          At least one of min or max wait days is required.
        </p>

        <Button type="submit" disabled={pending}>
          {pending
            ? isEdit
              ? "Saving..."
              : "Creating..."
            : isEdit
              ? "Save"
              : "Create Task"}
        </Button>
      </div>

      {/* ── Right: eligibility panel ───────────────────────────────────── */}
      <div className="rounded-xl border bg-card p-5">
        {isEdit ? (
          <EligibilityPanel
            mode="edit"
            orgId={props.orgId}
            taskId={props.taskId}
            allRoles={props.allRoles}
            eligibleRoles={props.eligibleRoles}
          />
        ) : (
          <EligibilityPanel mode="create" allRoles={props.allRoles} />
        )}
      </div>
    </form>
  );
}
