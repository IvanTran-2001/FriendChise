"use client";

/**
 * RoleFilterButton — role filter for the timetable sidebar.
 * Thin URL-routing wrapper around FilterCombobox.
 */

import { useRouter } from "next/navigation";
import { FilterCombobox } from "@/components/ui/filter-combobox";

/** Props for RoleFilterButton. */
interface RoleFilterButtonProps {
  roles: { id: string; name: string; color: string | null }[];
  anchor: string;
  span: string;
  mode: string;
  selectedRoleId: string | null;
  orgId: string;
  /** The currently active tag filter ID — preserved in generated hrefs. */
  selectedTagId?: string | null;
  /** Called with the new roleId (or null when clearing) before navigating. */
  onNavigate?: (roleId: string | null) => void;
}

function makeHref(
  orgId: string,
  anchor: string,
  mode: string,
  span: string,
  roleId: string | null,
  tagId?: string | null,
) {
  const params = new URLSearchParams({ anchor, mode, span });
  if (roleId) params.set("roleId", roleId);
  if (tagId) params.set("tagId", tagId);
  return `/orgs/${orgId}/timetable?${params.toString()}`;
}

export function RoleFilterButton({
  roles,
  anchor,
  mode,
  span,
  selectedRoleId,
  orgId,
  selectedTagId,
  onNavigate,
}: RoleFilterButtonProps) {
  const router = useRouter();

  if (roles.length === 0) return null;

  function handleSelect(roleId: string | null) {
    onNavigate?.(roleId);
    router.push(makeHref(orgId, anchor, mode, span, roleId, selectedTagId));
  }

  return (
    <FilterCombobox
      items={roles}
      selectedId={selectedRoleId}
      allLabel="All roles"
      placeholder="Search roles…"
      ariaLabel="Filter by role"
      onSelect={handleSelect}
    />
  );
}
