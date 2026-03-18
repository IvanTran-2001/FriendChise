"use client";

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

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
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
        />
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
        />
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
        />
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
        />
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
        />
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
          />
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
          />
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
