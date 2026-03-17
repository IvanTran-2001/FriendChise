"use client";

import { useActionState } from "react";
import { createTaskAction } from "@/app/actions/tasks";
import type { CreateTaskFormState } from "@/app/actions/tasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const CreateTaskForm = ({ orgId }: { orgId: string }) => {
  const boundAction = createTaskAction.bind(null, orgId);
  const [state, action, pending] = useActionState<CreateTaskFormState, FormData>(
    boundAction,
    null,
  );

  const err = (field: string) =>
    state && !state.ok ? (state.errors[field]?.[0] ?? null) : null;

  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">
          Title <span className="text-destructive">*</span>
        </label>
        <Input name="title" type="text" placeholder="e.g. Deep clean kitchen" />
        {err("title") && <p className="text-xs text-destructive">{err("title")}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Description</label>
        <textarea
          name="description"
          rows={3}
          placeholder="Optional details..."
          className="border rounded-md px-3 py-2 text-sm bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {err("description") && (
          <p className="text-xs text-destructive">{err("description")}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">
          Duration (minutes) <span className="text-destructive">*</span>
        </label>
        <Input
          name="durationMin"
          type="number"
          min={1}
          max={1440}
          placeholder="e.g. 60"
        />
        {err("durationMin") && (
          <p className="text-xs text-destructive">{err("durationMin")}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">
          Preferred start time (minutes since midnight)
        </label>
        <Input
          name="preferredStartTimeMin"
          type="number"
          min={0}
          max={1439}
          placeholder="e.g. 480 = 8:00 am"
        />
        {err("preferredStartTimeMin") && (
          <p className="text-xs text-destructive">{err("preferredStartTimeMin")}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">People required</label>
        <Input
          name="peopleRequired"
          type="number"
          min={1}
          max={50}
          defaultValue={1}
        />
        {err("peopleRequired") && (
          <p className="text-xs text-destructive">{err("peopleRequired")}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Min wait days</label>
          <Input
            name="minWaitDays"
            type="number"
            min={0}
            max={3650}
            placeholder="e.g. 7"
          />
          {err("minWaitDays") && (
            <p className="text-xs text-destructive">{err("minWaitDays")}</p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Max wait days</label>
          <Input
            name="maxWaitDays"
            type="number"
            min={1}
            max={3650}
            placeholder="e.g. 14"
          />
          {err("maxWaitDays") && (
            <p className="text-xs text-destructive">{err("maxWaitDays")}</p>
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
