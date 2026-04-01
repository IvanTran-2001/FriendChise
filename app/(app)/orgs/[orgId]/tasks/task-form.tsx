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
                  className="text-xs text-muted-foreground hover:text-destructive font-mono px-1"
                  onClick={() => remove(role.id)}
                  disabled={isPending}
                  aria-label={`Remove ${role.name}`}
                >
                  [−]
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── Main form ────────────────────────────────────────────────────────────────

export function TaskForm(props: TaskFormProps) {
  const isEdit = props.mode === "edit";

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

  const dv = isEdit ? props.defaultValues : null;

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
          <label htmlFor="description" className="text-sm font-medium">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            placeholder="Optional details..."
            defaultValue={dv?.description ?? undefined}
            className="border rounded-md px-3 py-2 text-sm bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
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
            Duration (minutes) <span className="text-destructive">*</span>
          </label>
          <Input
            id="durationMin"
            name="durationMin"
            type="number"
            required
            min={1}
            max={1440}
            placeholder="e.g. 60"
            defaultValue={dv?.durationMin}
            aria-invalid={!!err("durationMin")}
            aria-describedby={
              err("durationMin") ? "durationMin-error" : undefined
            }
          />
          {err("durationMin") && (
            <p id="durationMin-error" className="text-xs text-destructive">
              {err("durationMin")}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="preferredStartTimeMin"
            className="text-sm font-medium"
          >
            Preferred start time (minutes since midnight)
          </label>
          <Input
            id="preferredStartTimeMin"
            name="preferredStartTimeMin"
            type="number"
            min={0}
            max={1439}
            placeholder="e.g. 480 = 8:00 am"
            defaultValue={dv?.preferredStartTimeMin ?? undefined}
            aria-invalid={!!err("preferredStartTimeMin")}
            aria-describedby={
              err("preferredStartTimeMin")
                ? "preferredStartTimeMin-error"
                : undefined
            }
          />
          {err("preferredStartTimeMin") && (
            <p
              id="preferredStartTimeMin-error"
              className="text-xs text-destructive"
            >
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
      <div className="rounded-md border p-4">
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
