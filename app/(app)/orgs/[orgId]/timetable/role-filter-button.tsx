"use client";

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

interface RoleFilterButtonProps {
  roles: { id: string; name: string; color: string | null }[];
  weekStart: string;
  mode: string;
  selectedRoleId: string | null;
  orgId: string;
}

function makeHref(
  orgId: string,
  weekStart: string,
  mode: string,
  roleId: string | null,
) {
  const params = new URLSearchParams({ week: weekStart, mode });
  if (roleId) params.set("roleId", roleId);
  return `/orgs/${orgId}/timetable?${params.toString()}`;
}

export function RoleFilterButton({
  roles,
  weekStart,
  mode,
  selectedRoleId,
  orgId,
}: RoleFilterButtonProps) {
  if (roles.length === 0) return null;

  const selectedRole = roles.find((r) => r.id === selectedRoleId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={selectedRoleId ? "default" : "outline"}
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
                weekStart,
                mode,
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
              <Link href={makeHref(orgId, weekStart, mode, null)}>
                Clear filter
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
