"use client";

/**
 * Shared form for creating and editing a role.
 *
 * When `role` is supplied the form is in edit mode and pre-fills all fields.
 * On success it navigates back to the roles list.
 *
 * Fields:
 *  - Name — required, max 50 chars.
 *  - Color — optional hex color, toggled on with a checkbox.
 *  - Permissions — checkboxes for every `PermissionAction` enum value.
 *  - Task eligibility — two-column picker: left panel shows tasks already in
 *    the role (click `−` to remove), right panel shows the remaining org tasks
 *    (click `+` to add). Both panels scroll independently when the list is long.
 */
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PermissionAction } from "@prisma/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createRoleAction, updateRoleAction } from "@/app/actions/roles";
import type { RoleWithPermissions } from "@/lib/services/roles";

// ─── Permission label formatter ──────────────────────────────────────────────

function formatPermissionLabel(action: PermissionAction): string {
  const words = action.split("_").map((w) => w.toLowerCase());
  words[0] = words[0][0].toUpperCase() + words[0].slice(1);
  return words.join(" ");
}

// ─── Component ───────────────────────────────────────────────────────────────

interface RoleFormProps {
  orgId: string;
  /** Present in edit mode; absent in create mode. */
  role?: RoleWithPermissions;
  /** All tasks for this org — used to populate the eligibility picker. */
  tasks: { id: string; name: string }[];
}

export function RoleForm({ orgId, role, tasks }: RoleFormProps) {
  const nameId = useId();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(role?.name ?? "");
  const [useColor, setUseColor] = useState(role ? !!role.color : true);
  const [color, setColor] = useState(
    () => role?.color ?? `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0")}`,
  );
  const [permissions, setPermissions] = useState<PermissionAction[]>(
    role?.permissions.map((p) => p.action) ?? [],
  );
  const [eligibleTaskIds, setEligibleTaskIds] = useState<string[]>(
    role?.eligibleFor.map((e) => e.task.id) ?? [],
  );
  const [error, setError] = useState<string | null>(null);

  const includedTasks = tasks.filter((t) => eligibleTaskIds.includes(t.id));
  const availableTasks = tasks.filter((t) => !eligibleTaskIds.includes(t.id));

  function togglePermission(action: PermissionAction) {
    setPermissions((prev) =>
      prev.includes(action)
        ? prev.filter((a) => a !== action)
        : [...prev, action],
    );
  }

  function addTask(taskId: string) {
    setEligibleTaskIds((prev) => [...prev, taskId]);
  }

  function removeTask(taskId: string) {
    setEligibleTaskIds((prev) => prev.filter((id) => id !== taskId));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const data = {
      name,
      color: useColor ? color : undefined,
      permissions,
      taskIds: eligibleTaskIds,
    };

    startTransition(async () => {
      const result = role
        ? await updateRoleAction(orgId, role.id, data)
        : await createRoleAction(orgId, data);

      if (result.ok) {
        toast.success(role ? "Role updated." : "Role created.");
        router.push(`/orgs/${orgId}/settings/roles`);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name */}
      <div className="space-y-1.5">
        <label htmlFor={nameId} className="text-sm font-medium">
          Name
        </label>
        <Input
          id={nameId}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Kitchen Staff"
          required
          disabled={isPending}
        />
      </div>

      {/* Color */}
      <div className="space-y-1.5">
        <label className="flex items-center gap-2 text-sm font-medium cursor-pointer select-none">
          <input
            type="checkbox"
            checked={useColor}
            onChange={(e) => setUseColor(e.target.checked)}
            disabled={isPending}
            className="h-4 w-4 rounded"
          />
          Role color
          <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        {useColor && (
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            disabled={isPending}
            className="h-8 w-14 rounded border border-input cursor-pointer"
          />
        )}
      </div>

      {/* Permissions */}
      <div className="space-y-1.5">
        <p className="text-sm font-medium">Permissions</p>
        <div className="rounded-lg border border-input divide-y divide-input">
          {Object.values(PermissionAction).map((action) => (
            <label
              key={action}
              className="flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer select-none hover:bg-muted/50"
            >
              <input
                type="checkbox"
                checked={permissions.includes(action)}
                onChange={() => togglePermission(action)}
                disabled={isPending}
                className="h-4 w-4 rounded"
              />
              {formatPermissionLabel(action)}
            </label>
          ))}
        </div>
      </div>

      {/* Task eligibility */}
      <div className="space-y-1.5">
        <p className="text-sm font-medium">Task eligibility</p>
        <p className="text-xs text-muted-foreground">
          Tasks this role is allowed to perform.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {/* Left — tasks in role */}
          <div className="flex flex-col rounded-lg border border-input overflow-hidden">
            <p className="px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/50 border-b border-input shrink-0">
              In role
            </p>
            <div className="overflow-y-auto max-h-56 divide-y divide-input">
              {includedTasks.length === 0 ? (
                <p className="px-3 py-3 text-sm text-muted-foreground">
                  None added yet
                </p>
              ) : (
                includedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between px-3 py-2 text-sm"
                  >
                    <span className="truncate pr-2">{task.name}</span>
                    <button
                      type="button"
                      onClick={() => removeTask(task.id)}
                      disabled={isPending}
                      className="shrink-0 text-destructive hover:text-destructive/70 font-bold leading-none"
                      aria-label={`Remove ${task.name}`}
                    >
                      −
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right — available tasks */}
          <div className="flex flex-col rounded-lg border border-input overflow-hidden">
            <p className="px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/50 border-b border-input shrink-0">
              Available
            </p>
            <div className="overflow-y-auto max-h-56 divide-y divide-input">
              {availableTasks.length === 0 ? (
                <p className="px-3 py-3 text-sm text-muted-foreground">
                  {tasks.length === 0
                    ? "No tasks created yet"
                    : "All tasks added"}
                </p>
              ) : (
                availableTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between px-3 py-2 text-sm"
                  >
                    <span className="truncate pr-2">{task.name}</span>
                    <button
                      type="button"
                      onClick={() => addTask(task.id)}
                      disabled={isPending}
                      className="shrink-0 text-primary hover:text-primary/70 font-bold leading-none"
                      aria-label={`Add ${task.name}`}
                    >
                      +
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Actions */}
      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {role ? "Save changes" : "Create role"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/orgs/${orgId}/settings/roles`)}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
