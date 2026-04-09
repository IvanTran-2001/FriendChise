"use client";

import { useState, useRef } from "react";
import { X } from "lucide-react";

type Role = { id: string; name: string };

interface RolePickerProps {
  allRoles: Role[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

/**
 * Searchable multi-role picker.
 * Type to filter available roles; click a result to add it instantly.
 * Selected roles appear as a list with X buttons to remove.
 */
export function RolePicker({ allRoles, selectedIds, onChange }: RolePickerProps) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = allRoles.filter((r) => selectedIds.includes(r.id));
  const available = allRoles.filter((r) => !selectedIds.includes(r.id));
  const filtered = available.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()),
  );

  function addRole(id: string) {
    onChange([...selectedIds, id]);
    setSearch("");
    inputRef.current?.focus();
  }

  function removeRole(id: string) {
    onChange(selectedIds.filter((i) => i !== id));
  }

  return (
    <div className="flex flex-col gap-2">
      {selected.length > 0 && (
        <ul className="flex flex-col divide-y rounded-lg border overflow-hidden">
          {selected.map((role) => (
            <li
              key={role.id}
              className="flex items-center justify-between px-3 py-2 text-sm"
            >
              <span>{role.name}</span>
              <button
                type="button"
                onClick={() => removeRole(role.id)}
                className="text-muted-foreground hover:text-destructive transition-colors"
                aria-label={`Remove ${role.name}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {available.length > 0 && (
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Search roles…"
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 placeholder:text-muted-foreground"
          />
          {open && filtered.length > 0 && (
            <ul className="absolute z-20 top-full mt-1 w-full rounded-lg border bg-popover shadow-md overflow-hidden">
              {filtered.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); addRole(r.id); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                  >
                    {r.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {open && search && filtered.length === 0 && (
            <div className="absolute z-20 top-full mt-1 w-full rounded-lg border bg-popover shadow-md px-3 py-2 text-sm text-muted-foreground">
              No roles found
            </div>
          )}
        </div>
      )}

      {allRoles.length === 0 && (
        <p className="text-xs text-muted-foreground">No roles available</p>
      )}
    </div>
  );
}
