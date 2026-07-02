"use client";

/**
 * Shared task tool helpers.
 *
 * This module centralizes the saved tool-link shape, icon mapping, and the
 * reusable button/list UI so task create, edit, and detail surfaces all render
 * tool links consistently.
 */

import Link from "next/link";
import { ArrowLeftRight, Link2, List, Users } from "lucide-react";
import type { ComponentType } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type TaskToolSelection = {
  toolPath: string;
  toolLabel: string;
};

type TaskToolKind = "conversion" | "item-list" | "roster" | "unknown";

const TOOL_KIND_META: Record<
  TaskToolKind,
  { icon: ComponentType<{ className?: string }>; accent: string }
> = {
  conversion: {
    icon: ArrowLeftRight,
    accent: "bg-sky-500/10 text-sky-700 dark:text-sky-300 ring-sky-500/15",
  },
  "item-list": {
    icon: List,
    accent: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-500/15",
  },
  roster: {
    icon: Users,
    accent: "bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-amber-500/15",
  },
  unknown: {
    icon: Link2,
    accent: "bg-muted/50 text-muted-foreground ring-border/60",
  },
};

function normalizeToolPath(toolPath: string) {
  // Edit/detail pages may pass absolute org paths; normalize them before
  // checking the tool kind so the icon mapping stays stable.
  return toolPath.replace(/^\/orgs\/[^/]+\/tools\//, "");
}

export function getTaskToolKind(toolPath: string): TaskToolKind {
  const normalized = normalizeToolPath(toolPath);

  if (normalized.startsWith("conversion/") || normalized === "conversion") {
    return "conversion";
  }
  if (
    normalized.startsWith("item-list/") ||
    normalized === "item-list" ||
    normalized.startsWith("item-list/lists/")
  ) {
    return "item-list";
  }
  if (normalized.startsWith("roster/") || normalized === "roster") {
    return "roster";
  }
  return "unknown";
}

export function taskToolHref(orgId: string, toolPath: string) {
  if (toolPath.startsWith("/")) return toolPath;
  return `/orgs/${orgId}/tools/${toolPath}`;
}

export function TaskToolButton({
  orgId,
  tool,
}: {
  orgId: string;
  tool: TaskToolSelection;
}) {
  const kind = getTaskToolKind(tool.toolPath);
  const meta = TOOL_KIND_META[kind];
  const Icon = meta.icon;

  return (
    <Button
      asChild
      variant="outline"
      size="sm"
      className="h-auto w-full justify-start gap-3 py-2.5 text-left"
    >
      <Link href={taskToolHref(orgId, tool.toolPath)}>
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ring-1",
            meta.accent,
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1 truncate">{tool.toolLabel}</span>
      </Link>
    </Button>
  );
}

/** Renders the linked tools for a task as a vertical button list. */
export function TaskToolList({
  orgId,
  tools,
}: {
  orgId: string;
  tools: TaskToolSelection[];
}) {
  return (
    <div className="flex flex-col gap-2">
      {tools.map((tool) => (
        <TaskToolButton key={tool.toolPath} orgId={orgId} tool={tool} />
      ))}
    </div>
  );
}