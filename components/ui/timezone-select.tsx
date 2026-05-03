"use client";

import { useState, useRef, useEffect } from "react";
import type { TimezoneOption } from "@/lib/timezones";

export function TimezoneSelect({
  value,
  onChange,
  timezones,
  className,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  timezones: TimezoneOption[];
  className?: string;
  id?: string;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = timezones.find((tz) => tz.value === value);
  const filtered = search
    ? timezones.filter((tz) => tz.search.includes(search.toLowerCase()))
    : timezones;

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div
      ref={containerRef}
      className={`relative ${className ?? "max-w-xs w-full"}`}
    >
      <input
        id={id}
        className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
        value={open ? search : (selected?.label ?? value)}
        onChange={(e) => setSearch(e.target.value)}
        onFocus={() => {
          setOpen(true);
          setSearch("");
        }}
        placeholder="Search timezone…"
      />
      {open && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-background shadow-lg">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              No results
            </div>
          ) : (
            filtered.map((tz) => (
              <div
                key={tz.value}
                className={`px-3 py-2 text-sm cursor-pointer hover:bg-accent ${
                  tz.value === value ? "bg-accent/50 font-medium" : ""
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(tz.value);
                  setOpen(false);
                  setSearch("");
                }}
              >
                {tz.label}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
