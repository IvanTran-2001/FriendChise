"use client";

/**
 * RoleFilterButton — role filter for the timetable sidebar (multi-select).
 */

import { useRouter } from "next/navigation";
import { MultiFilterCombobox } from "@/components/ui/multi-filter-combobox";

interface RoleFilterButtonProps {
  roles: { id: string; name: string; color: string | null }[];
  anchor: string;
  span: string;
  mode: string;
  selectedRoleIds: string[];
  orgId: string;
  selectedTagIds: string[];
  onNavigate?: (roleIds: string[]) => void;
}

function makeHref(
  orgId: string,
  anchor: string,
  mode: string,
  span: string,
  roleIds: string[],
  tagIds: string[],
) {
  const params = new URLSearchParams({ anchor, mode, span });
  if (roleIds.length > 0) params.set("roleId", roleIds.join(","));
  if (tagIds.length > 0) params.set("tagId", tagIds.join(","));
  return `/orgs/${orgId}/timetable?${params.toString()}`;
}

export function RoleFilterButton({
  roles,
  anchor,
  mode,
  span,
  selectedRoleIds,
  orgId,
  selectedTagIds,
  onNavigate,
}: RoleFilterButtonProps) {
  const router = useRouter();

  if (roles.length === 0) return null;

  function handleSelect(roleIds: string[]) {
    onNavigate?.(roleIds);
    if (!onNavigate) {
      router.push(makeHref(orgId, anchor, mode, span, roleIds, selectedTagIds));
    }
  }

  return (
    <MultiFilterCombobox
      items={roles}
      selectedIds={selectedRoleIds}
      allLabel="All roles"
      placeholder="Search roles…"
      ariaLabel="Filter by role"
      onSelect={handleSelect}
    />
  );
}
