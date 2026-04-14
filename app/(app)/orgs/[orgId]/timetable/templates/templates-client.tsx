"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, LayoutGrid, List, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Toolbar } from "@/components/layout/toolbar";

type Template = {
  id: string;
  name: string;
  cycleLengthDays: number;
  _count: { entries: number };
};

interface TemplatesClientProps {
  orgId: string;
  templates: Template[];
}

export function TemplatesClient({ orgId, templates }: TemplatesClientProps) {
  const router = useRouter();
  const [view, setView] = useState<"card" | "list">("card");

  const viewToggle = (
    <div className="flex items-center rounded-md border overflow-hidden">
      <button
        type="button"
        onClick={() => setView("list")}
        aria-label="List view"
        aria-pressed={view === "list"}
        className={cn(
          "p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary",
          view === "list"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted",
        )}
      >
        <List className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => setView("card")}
        aria-label="Card view"
        aria-pressed={view === "card"}
        className={cn(
          "p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary",
          view === "card"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted",
        )}
      >
        <LayoutGrid className="h-4 w-4" />
      </button>
    </div>
  );

  if (templates.length === 0) {
    return (
      <>
        <Toolbar>
          <div />
          <div className="flex items-center gap-2">
            <Button asChild size="sm" className="gap-1.5">
              <Link href={`/orgs/${orgId}/timetable/templates/new`}>
                <Plus className="h-3.5 w-3.5" /> New Template
              </Link>
            </Button>
            {viewToggle}
          </div>
        </Toolbar>
        <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
          <CalendarDays className="h-10 w-10 opacity-30" />
          <p className="text-sm">
            No templates yet. Create one to get started.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href={`/orgs/${orgId}/timetable/templates/new`}>
              Create Template
            </Link>
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <Toolbar>
        <div />
        <div className="flex items-center gap-2">
          <Button asChild size="sm" className="gap-1.5">
            <Link href={`/orgs/${orgId}/timetable/templates/new`}>
              <Plus className="h-3.5 w-3.5" /> New Template
            </Link>
          </Button>
          {viewToggle}
        </div>
      </Toolbar>

      {/* Card view */}
      {view === "card" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <Link
              key={t.id}
              href={`/orgs/${orgId}/timetable/templates/${t.id}`}
              className="group rounded-xl border bg-card shadow-sm hover:shadow-md transition-all overflow-hidden"
            >
              <div className="flex items-start gap-4 p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0 group-hover:bg-primary/15 transition-colors mt-0.5">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm leading-snug truncate">
                    {t.name}
                  </div>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {t.cycleLengthDays} days
                    </span>
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {t._count.entries} slots
                    </span>
                    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      Draft
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        /* List view */
        <div className="rounded-lg border bg-card overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Name
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Cycle
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Slots
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr
                  key={t.id}
                  role="link"
                  tabIndex={0}
                  onClick={() =>
                    router.push(`/orgs/${orgId}/timetable/templates/${t.id}`)
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(`/orgs/${orgId}/timetable/templates/${t.id}`);
                    }
                  }}
                  className="border-b last:border-0 hover:bg-primary/5 cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50"
                >
                  <td className="px-4 py-3 font-medium">{t.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {t.cycleLengthDays} days
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {t._count.entries}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    Draft
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
