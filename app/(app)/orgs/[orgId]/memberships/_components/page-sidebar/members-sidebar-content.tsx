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
import { LayoutGrid, List, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { FilterCombobox } from "@/components/ui/filter-combobox";
import { MembersActions } from "../action-sidebar/members-panel-triggers";
import Link from "next/link";

type Role = { id: string; name: string; color: string };

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

  return (
    <>
      {/* Filters section */}
      <div className="px-3 pt-3 pb-2 border-t border-border">
        <p className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider px-1 mb-2">
          Filters
        </p>
        <div className="flex flex-col gap-2">
          {/* Role filter */}
          {roles.length > 0 && (
            <FilterCombobox
              items={roles}
              selectedId={roleId}
              allLabel="All roles"
              placeholder="Search roles…"
              onSelect={(newRoleId) => router.push(buildHref({ roleId: newRoleId }))}
            />
          )}
        </div>
      </div>

      {/* View section */}
      <div className="px-3 pt-2.5 pb-3 border-t border-border">
        <p className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider px-1 mb-2">
          View
        </p>
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

      {canManage && (
        <div className="px-3 pt-2.5 pb-3 border-t border-border">
          <p className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider px-1 mb-2">
            Actions
          </p>
          <div className="flex flex-col gap-2">
            <MembersActions orgId={orgId} roles={roles} />
            <Button
              variant="outline"
              size="sm"
              asChild
              className="w-full justify-start gap-2"
            >
              <Link href={`/orgs/${orgId}/tools/roster`}>
                <Users className="h-4 w-4 shrink-0" />
                Roster
              </Link>
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
