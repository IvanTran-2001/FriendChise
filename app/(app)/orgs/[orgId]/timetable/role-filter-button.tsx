"use client";

/**
 * Role filter dropdown for the timetable toolbar.
 *
 * Filters displayed entries to those whose `TaskEligibility` includes the
 * selected role. The selected `roleId` is stored in the URL (`?roleId=`) so
 * it persists across week navigation without any client state.
 *
 * Clicking an already-selected role toggles it off (clears the filter).
 * A "Clear filter" item is shown at the bottom of the dropdown when a filter
 * is active. Returns `null` when the org has no roles.
 */

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Props for RoleFilterButton. */
interface RoleFilterButtonProps {
  /** All roles for the org to populate the dropdown. */
  roles: { id: string; name: string; color: string | null }[];
  /** Current anchor date (YYYY-MM-DD) — preserved in the generated hrefs. */
  anchor: string;
  /** Current span ("day" | "week") — preserved in the generated hrefs. */
  span: string;
  /** Current view mode ("calendar" | "simple") — preserved in the generated hrefs. */
  mode: string;
  /** The currently active role filter ID, or `null` for no filter. */
  selectedRoleId: string | null;
  orgId: string;
}

function makeHref(
  orgId: string,
  anchor: string,
  mode: string,
  span: string,
  roleId: string | null,
) {
  const params = new URLSearchParams({ anchor, mode, span });
  if (roleId) params.set("roleId", roleId);
  return `/orgs/${orgId}/timetable?${params.toString()}`;
}

export function RoleFilterButton({
  roles,
  anchor,
  mode,
  span,
  selectedRoleId,
  orgId,
}: RoleFilterButtonProps) {
  if (roles.length === 0) return null;

  const selectedRole = roles.find((r) => r.id === selectedRoleId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={selectedRole ? "default" : "outline"}
          size="sm"
          className="gap-1.5"
        >
          {selectedRole ? selectedRole.name : "Filter"}{" "}
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {roles.map((role) => (
          <DropdownMenuItem key={role.id} asChild>
            <Link
              href={makeHref(
                orgId,
                anchor,
                mode,
                span,
                role.id === selectedRoleId ? null : role.id,
              )}
            >
              {role.id === selectedRoleId ? "✓ " : ""}
              {role.name}
            </Link>
          </DropdownMenuItem>
        ))}
        {selectedRoleId && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={makeHref(orgId, anchor, mode, span, null)}>
                Clear filter
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
