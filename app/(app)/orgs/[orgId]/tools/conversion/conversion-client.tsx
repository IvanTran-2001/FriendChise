/**
 * ConversionClient — client component for `/orgs/[orgId]/tools/conversion`.
 *
 * Two sections:
 *   1. Recently Used — up to 3 most recently updated templates (quick-jump links).
 *   2. Conversion Sets — searchable grid of all sets with template count.
 *
 * Each set card links to the set detail page. The pencil icon opens
 * `EditSetForm` in the ActionSidebar without navigating away.
 */
"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Clock, FolderOpen, Layers, Pencil } from "lucide-react";
import { RegisterPageToolbar } from "@/components/layout/toolbar-context";
import { SearchInput } from "@/components/ui/search-input";
import { Button } from "@/components/ui/button";
import { useActionSidebar } from "@/components/layout/action-sidebar-context";
import { EditSetForm } from "./_components/edit-set-form";
import { cn } from "@/lib/utils";

interface ConversionSet {
  id: string;
  name: string;
  updatedAt: Date;
  _count: { templates: number };
}

interface RecentTemplate {
  id: string;
  name: string;
  updatedAt: Date;
  set: { id: string; name: string };
}

interface ConversionClientProps {
  orgId: string;
  sets: ConversionSet[];
  recentTemplates: RecentTemplate[];
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function ConversionClient({
  orgId,
  sets,
  recentTemplates,
}: ConversionClientProps) {
  const [search, setSearch] = useState("");
  const { open, close, activeTitle } = useActionSidebar();
  const formKeyRef = useRef(0);

  const filtered = sets.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()),
  );

  function handleEdit(e: React.MouseEvent, set: ConversionSet) {
    e.preventDefault();
    const k = ++formKeyRef.current;
    open(
      `Edit: ${set.name}`,
      <div key={k} className="p-4">
        <EditSetForm orgId={orgId} set={set} onClose={close} />
      </div>,
    );
  }

  return (
    <>
      <RegisterPageToolbar>
        <SearchInput
          placeholder="Search sets…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </RegisterPageToolbar>

      <div className="flex flex-col gap-8 py-5">
        {/* Recently used templates */}
        {recentTemplates.length > 0 && !search && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Recently Used
              </h2>
            </div>
            <div className="flex flex-col gap-1.5">
              {recentTemplates.map((t) => (
                <Link
                  key={t.id}
                  href={`/orgs/${orgId}/tools/conversion/${t.set.id}?template=${t.id}`}
                  className="flex items-center gap-3 rounded-lg border bg-card px-4 py-2.5 hover:border-primary/40 hover:shadow-sm transition-all"
                >
                  <Layers className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium truncate block">
                      {t.name}
                    </span>
                    <span className="text-xs text-muted-foreground truncate block">
                      {t.set.name}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {timeAgo(t.updatedAt)}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Conversion sets */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Conversion Sets
            </h2>
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-2 rounded-xl border border-dashed">
              <FolderOpen className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                {sets.length === 0
                  ? `No sets yet. Use "+ Add Set" to create one.`
                  : "No sets match your search."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((set) => (
                <Link
                  key={set.id}
                  href={`/orgs/${orgId}/tools/conversion/${set.id}`}
                  className={cn(
                    "group flex items-center justify-between rounded-xl border bg-card px-4 py-3.5 shadow-sm",
                    "hover:border-primary/40 hover:shadow-md transition-all cursor-pointer",
                    activeTitle === `Edit: ${set.name}` && "border-primary/40",
                  )}
                >
                  <div className="flex flex-col gap-0.5 min-w-0 pr-2">
                    <span className="text-sm font-semibold truncate">
                      {set.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {set._count.templates} template
                      {set._count.templates !== 1 ? "s" : ""}
                      {" · "}
                      {timeAgo(set.updatedAt)}
                    </span>
                  </div>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={(e) => handleEdit(e, set)}
                    aria-label={`Edit ${set.name}`}
                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Pencil />
                  </Button>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
