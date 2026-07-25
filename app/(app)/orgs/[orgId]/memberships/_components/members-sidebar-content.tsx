"use client";

/**
 * MembersSidebarContent — page sidebar for the members list page.
 *
 * Sections:
 *  - Filters — role filter, list/card view toggle
 *  - Actions — Invite Member, Add Bot (canManage only)
 */
import { MembersSidebarFilters } from "./members-sidebar-filters";
import Link from "next/link";
import { LayoutGrid, List, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MembersActions } from "./members-panel-triggers";
import { SegmentedControl } from "@/components/ui/controls/segmented-control";

type Role = { id: string; name: string; color: string };

interface MembersSidebarContentProps {
  orgId: string;
  roles: Role[];
  canManage: boolean;
  roleId: string | null;
  view: "list" | "card";
  onRoleChange: (roleId: string | null) => void;
  onViewChange: (view: "list" | "card") => void;
}

export function MembersSidebarContent({
  orgId,
  roles,
  canManage,
  roleId,
  view,
  onRoleChange,
  onViewChange,
}: MembersSidebarContentProps) {
  return (
    <>
      <MembersSidebarFilters
        roles={roles}
        roleId={roleId}
        onRoleChange={onRoleChange}
      />
      <div className="px-3 pt-2.5 pb-3 border-t border-border">
        <p className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider px-1 mb-2">
          View
        </p>
        <SegmentedControl
          value={view}
          onChange={(nextView) => {
            onViewChange(nextView);
          }}
          options={[
            {
              value: "list",
              label: (
                <span className="flex items-center gap-1.5">
                  <List className="h-3.5 w-3.5" />
                  List
                </span>
              ),
            },
            {
              value: "card",
              label: (
                <span className="flex items-center gap-1.5">
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Card
                </span>
              ),
            },
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