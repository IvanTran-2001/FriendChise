"use client";

import { useActionState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { createTemplateAction } from "@/app/actions/templates";
import type { CreateTemplateFormState } from "@/app/actions/templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CreateTemplateForm({ orgId }: { orgId: string }) {
  const boundAction = createTemplateAction.bind(null, orgId);
  const [state, dispatch, pending] = useActionState<
    CreateTemplateFormState,
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

  const err = (field: string): string | null =>
    state && !state.ok ? (state.errors[field]?.[0] ?? null) : null;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {err("_") && (
        <p role="alert" className="text-sm text-destructive">
          {err("_")}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="title" className="text-sm font-medium">
          Name <span className="text-destructive">*</span>
        </label>
        <Input
          id="title"
          name="title"
          type="text"
          required
          placeholder="e.g. Week 1, Summer Roster"
          autoFocus
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
        <label htmlFor="templateDays" className="text-sm font-medium">
          Cycle length (days) <span className="text-destructive">*</span>
        </label>
        <Input
          id="templateDays"
          name="templateDays"
          type="number"
          required
          step={1}
          min={1}
          max={365}
          defaultValue={7}
          aria-invalid={!!err("templateDays")}
          aria-describedby={
            err("templateDays") ? "templateDays-error" : undefined
          }
        />
        <p className="text-xs text-muted-foreground">
          How many days the cycle repeats over (e.g. 7 for a weekly roster).
        </p>
        {err("templateDays") && (
          <p id="templateDays-error" className="text-xs text-destructive">
            {err("templateDays")}
          </p>
        )}
      </div>

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Creating…" : "Create & Edit Template"}
      </Button>
    </form>
  );
}
