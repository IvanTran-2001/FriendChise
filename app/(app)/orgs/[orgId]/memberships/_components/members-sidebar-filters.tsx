"use client";

import { FilterCombobox } from "@/components/ui/filter-combobox";

type Role = { id: string; name: string; color: string };

export function MembersSidebarFilters({
  roles,
  roleId,
  onRoleChange,
}: {
  roles: Role[];
  roleId: string | null;
  onRoleChange: (roleId: string | null) => void;
}) {
  if (roles.length === 0) {
    return null;
  }

  return (
    <div className="px-3 pt-3 pb-2">
      <p className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider px-1 mb-2">
        Filters
      </p>
      <div className="flex flex-col gap-2">
        <FilterCombobox
          items={roles}
          selectedId={roleId}
          allLabel="All roles"
          placeholder="Search roles…"
          onSelect={onRoleChange}
        />
      </div>
    </div>
  );
}