"use client";

import { useState, useRef } from "react";
import { X } from "lucide-react";

type Role = { id: string; name: string; color: string };

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
export function RolePicker({
  allRoles,
  selectedIds,
  onChange,
}: RolePickerProps) {
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
        <div className="flex flex-wrap gap-1.5">
          {selected.map((role) => (
            <span
              key={role.id}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
              style={{ backgroundColor: role.color + "22", color: role.color }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: role.color }}
              />
              {role.name}
              <button
                type="button"
                onClick={() => removeRole(role.id)}
                className="ml-0.5 hover:opacity-60 transition-opacity"
                aria-label={`Remove ${role.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {available.length > 0 && (
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOpen(true);
            }}
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
                    onMouseDown={(e) => {
                      e.preventDefault();
                      addRole(r.id);
                    }}
                    className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: r.color }}
                    />
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
