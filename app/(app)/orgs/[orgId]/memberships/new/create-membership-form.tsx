"use client";

import { useActionState } from "react";
import { createMembershipAction } from "@/app/actions/memberships";
import type { CreateMembershipFormState } from "@/app/actions/memberships";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Role = { id: string; title: string };

export const CreateMembershipForm = ({
  orgId,
  roles,
}: {
  orgId: string;
  roles: Role[];
}) => {
  const boundAction = createMembershipAction.bind(null, orgId);
  const [state, action, pending] = useActionState<
    CreateMembershipFormState,
    FormData
  >(boundAction, null);

  const err = (field: string) =>
    state && !state.ok ? (state.errors[field]?.[0] ?? null) : null;

  const formError = err("_");

  return (
    <form action={action} className="flex flex-col gap-5">
      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          User email <span className="text-destructive">*</span>
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          placeholder="member@example.com"
          aria-describedby={err("email") ? "email-error" : undefined}
        />
        {err("email") && (
          <p id="email-error" className="text-xs text-destructive">
            {err("email")}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="roleId" className="text-sm font-medium">
          Role <span className="text-destructive">*</span>
        </label>
        <select
          id="roleId"
          name="roleId"
          required
          defaultValue=""
          className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          aria-describedby={err("roleId") ? "roleId-error" : undefined}
        >
          <option value="" disabled>
            Select a role…
          </option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.title}
            </option>
          ))}
        </select>
        {err("roleId") && (
          <p id="roleId-error" className="text-xs text-destructive">
            {err("roleId")}
          </p>
        )}
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add member"}
      </Button>
    </form>
  );
};
