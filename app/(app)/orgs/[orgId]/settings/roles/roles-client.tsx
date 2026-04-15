"use client";

/**
 * Roles management client component.
 *
 * Renders a table of org roles. Each row shows:
 *  - A color dot (if the role has a color), the role name, and `default`/`system` badges.
 *  - The list of permissions granted to the role as small chips.
 *  - A `···` dropdown menu with Edit and Delete actions.
 *
 * The Delete action is hidden for system roles (`isDeletable: false`).
 * Clicking Delete opens an AlertDialog confirmation before calling `deleteRoleAction`.
 */
import { useTransition } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { type PermissionAction } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteRoleAction } from "@/app/actions/roles";
import type { RoleWithPermissions } from "@/lib/services/roles";
import { ROLE_KEYS } from "@/lib/rbac";
import { cn } from "@/lib/utils";

// ─── Permission label formatter ──────────────────────────────────────────────

function formatPermissionLabel(action: PermissionAction): string {
  const words = action.split("_").map((w) => w.toLowerCase());
  words[0] = words[0][0].toUpperCase() + words[0].slice(1);
  return words.join(" ");
}

// ─── Row actions ──────────────────────────────────────────────────────────────

function RoleRowActions({
  orgId,
  role,
}: {
  orgId: string;
  role: RoleWithPermissions;
}) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      try {
        const result = await deleteRoleAction(orgId, role.id);
        if (result.ok) {
          toast.success(`Role "${role.name}" deleted.`);
        } else {
          toast.error(result.error);
        }
      } catch {
        toast.error("Failed to delete role. Please try again.");
      }
    });
  }

  return (
    <AlertDialog>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <a href={`/orgs/${orgId}/settings/roles/${role.id}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </a>
          </DropdownMenuItem>
          {role.isDeletable && (
            <>
              <DropdownMenuSeparator />
              <AlertDialogTrigger asChild>
                <DropdownMenuItem
                  onSelect={(e) => e.preventDefault()}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </AlertDialogTrigger>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete role &quot;{role.name}&quot;?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove the role and unassign it from all
            members. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Main client component ────────────────────────────────────────────────────

interface Props {
  orgId: string;
  roles: RoleWithPermissions[];
}

export function RolesClient({ orgId, roles }: Props) {
  if (roles.length === 0) {
    return <p className="text-sm text-muted-foreground">No roles yet.</p>;
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden overflow-x-auto shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Role name
            </th>
            <th className="hidden sm:table-cell px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Permissions
            </th>
            <th className="hidden sm:table-cell px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Tasks
            </th>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {roles.map((role, i) => (
            <tr
              key={role.id}
              className={cn(
                "hover:bg-primary/5 transition-colors",
                i < roles.length - 1 ? "border-b" : "",
              )}
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  {role.color && (
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: role.color }}
                    />
                  )}
                  <span className="font-medium">{role.name}</span>
                  {role.isDefault && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      default
                    </span>
                  )}
                  {!role.isDeletable && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      system
                    </span>
                  )}
                </div>
                <div className="sm:hidden mt-1 flex flex-wrap gap-1">
                  {role.permissions.length > 0 && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      {role.permissions.length} permission
                      {role.permissions.length !== 1 ? "s" : ""}
                    </span>
                  )}
                  {role.eligibleFor.length > 0 && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      {role.eligibleFor.length} task
                      {role.eligibleFor.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </td>
              <td className="hidden sm:table-cell px-4 py-3">
                {role.permissions.length === 0 ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {role.permissions.map(({ action }) => (
                      <span
                        key={action}
                        className="rounded-md border px-1.5 py-0.5 text-xs font-medium"
                      >
                        {formatPermissionLabel(action)}
                      </span>
                    ))}
                  </div>
                )}
              </td>
              <td className="hidden sm:table-cell px-4 py-3">
                {role.eligibleFor.length === 0 ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {role.eligibleFor.map(({ task }) => (
                      <span
                        key={task.id}
                        className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs"
                      >
                        {task.color && (
                          <span
                            className="inline-block h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: task.color }}
                          />
                        )}
                        {task.name}
                      </span>
                    ))}
                  </div>
                )}
              </td>
              <td className="px-2 py-2">
                {role.key !== ROLE_KEYS.OWNER && (
                  <RoleRowActions orgId={orgId} role={role} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
