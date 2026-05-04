"use client";

/**
 * MembersSidebarContent — page sidebar for the members list page.
 *
 * Sections:
 *  - Filters — role filter, list/card view toggle
 *  - Actions — Invite Member, Add Bot (canManage only)
 *
 * All filter/view state is URL-driven: each control pushes a new URL so the
 * server page re-renders with the updated params.
 */
import { useRouter } from "next/navigation";
import { ChevronDown, LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MembersActions } from "./members-actions";

type Role = { id: string; name: string };

interface MembersSidebarContentProps {
  orgId: string;
  roles: Role[];
  canManage: boolean;
  roleId: string | null;
  view: "list" | "card";
}

export function MembersSidebarContent({
  orgId,
  roles,
  canManage,
  roleId,
  view,
}: MembersSidebarContentProps) {
  const router = useRouter();

  function buildHref(overrides: {
    roleId?: string | null;
    view?: "list" | "card";
  }) {
    const params = new URLSearchParams();
    const next = { roleId, view, ...overrides };
    if (next.roleId) params.set("roleId", next.roleId);
    if (next.view && next.view !== "card") params.set("view", next.view);
    const qs = params.toString();
    return `/orgs/${orgId}/memberships${qs ? `?${qs}` : ""}`;
  }

  const activeRole = roles.find((r) => r.id === roleId);

  return (
    <>
      {/* Filters section */}
      <div className="px-3 pt-3 pb-2">
        <p className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider px-1 mb-2">
          Filters
        </p>
        <div className="flex flex-col gap-2">

        {/* Role filter */}
        {roles.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant={roleId ? "secondary" : "outline"}
                size="sm"
                className="w-full justify-between gap-2"
              >
                {activeRole ? activeRole.name : "All roles"}
                <ChevronDown className="h-3.5 w-3.5 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-40">
              {roleId && (
                <DropdownMenuItem
                  onClick={() => router.push(buildHref({ roleId: null }))}
                >
                  All roles
                </DropdownMenuItem>
              )}
              {roles.map((r) => (
                <DropdownMenuItem
                  key={r.id}
                  onClick={() => router.push(buildHref({ roleId: r.id }))}
                >
                  {r.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* View toggle */}
        <SegmentedControl
          size="sm"
          className="w-fit"
          value={view}
          onChange={(v) =>
            router.push(buildHref({ view: v as "list" | "card" }))
          }
          options={[
            { value: "list", label: <List className="h-4 w-4" /> },
            { value: "card", label: <LayoutGrid className="h-4 w-4" /> },
          ]}
        />
        </div>
      </div>

      {canManage && (
        <div className="px-3 pt-2 pb-3 border-t border-border">
          <p className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider px-1 mb-2">
            Actions
          </p>
          <div className="flex flex-col gap-2">
            <MembersActions orgId={orgId} roles={roles} />
          </div>
        </div>
      )}
    </>
  );
}
