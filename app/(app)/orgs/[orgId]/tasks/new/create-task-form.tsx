"use client";

/**
 * Client form for creating a new task in an org.
 *
 * Uses `useActionState` + `useTransition` to submit the form data to the
 * `createTaskAction` server action. Validation errors from the server are
 * rendered inline next to each field (with `aria-describedby` / `aria-invalid`)
 * and also summarised in a Sonner toast for visibility.
 */
import { useActionState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { createTaskAction } from "@/app/actions/tasks";
import type { CreateTaskFormState } from "@/app/actions/tasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const CreateTaskForm = ({ orgId }: { orgId: string }) => {
  const boundAction = createTaskAction.bind(null, orgId);
  const [state, dispatch, pending] = useActionState<
    CreateTaskFormState,
    FormData
  >(boundAction, null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (state && !state.ok) {
      const messages = Object.entries(state.errors)
        .flatMap(([field, errs]) =>
          field === "_" ? errs : errs.map((e) => `${field}: ${e}`),
        )
        .join("\n");
      toast.error(messages || "Something went wrong");
    }
  }, [state]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => dispatch(formData));
  };

  /** Returns the first error string for the given field, or null. */
  const err = (field: string): string | null =>
    state && !state.ok ? (state.errors[field]?.[0] ?? null) : null;

  const formError = err("_");

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
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
        <label htmlFor="preferredStartTimeMin" className="text-sm font-medium">
          Preferred start time (minutes since midnight)
        </label>
        <Input
          id="preferredStartTimeMin"
          name="preferredStartTimeMin"
          type="number"
          min={0}
          max={1439}
          placeholder="e.g. 480 = 8:00 am"
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
          defaultValue={1}
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
        {pending ? "Creating..." : "Create Task"}
      </Button>
    </form>
  );
};
