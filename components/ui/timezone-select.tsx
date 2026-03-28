"use client";

import { useState, useRef, useEffect } from "react";
import { rawTimeZones } from "@vvo/tzdb";

function fmtOffset(minutes: number): string {
  const sign = minutes >= 0 ? "+" : "-";
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60)
    .toString()
    .padStart(2, "0");
  const m = (abs % 60).toString().padStart(2, "0");
  return `UTC${sign}${h}:${m}`;
}

const TIMEZONES = rawTimeZones.map((tz) => ({
  value: tz.name,
  label: `(${fmtOffset(tz.rawOffsetInMinutes)}) ${tz.alternativeName} — ${tz.mainCities[0] ?? tz.name}`,
  search:
    `${tz.name} ${tz.alternativeName} ${tz.mainCities.join(" ")} ${tz.countryName}`.toLowerCase(),
}));

export function TimezoneSelect({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = TIMEZONES.find((tz) => tz.value === value);
  const filtered = search
    ? TIMEZONES.filter((tz) => tz.search.includes(search.toLowerCase()))
    : TIMEZONES;

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
