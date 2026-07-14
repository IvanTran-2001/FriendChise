"use client";

import Link from "next/link";
import { ListTodo, Plus } from "lucide-react";

interface TaskEmptyStateProps {
  orgId: string;
  canManageTasks: boolean;
  hasSearch: boolean;
  trimmedSearch: string;
}

export function TaskEmptyState({
  orgId,
  canManageTasks,
  hasSearch,
  trimmedSearch,
}: TaskEmptyStateProps) {
  return (
    <div className="flex items-center justify-center border py-24">
      <div className="flex flex-col items-center gap-3 text-center">
        <ListTodo className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-2xl font-semibold text-foreground">
          {hasSearch ? "No tasks match your search" : "No tasks yet"}
        </p>
        {hasSearch && canManageTasks && (
          <div className="w-full max-w-xs overflow-hidden rounded-md border bg-popover shadow-sm">
            <Link
              href={`/orgs/${orgId}/tasks/new?title=${encodeURIComponent(trimmedSearch)}`}
              className="flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-accent focus:bg-accent focus:outline-none"
            >
              <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">
                Create <span className="font-medium">&quot;{trimmedSearch}&quot;</span>
              </span>
            </Link>
          </div>
        )}
        {!hasSearch && canManageTasks && (
          <Link href={`/orgs/${orgId}/tasks/new`} className="text-sm text-primary hover:underline">
            Create your first task
          </Link>
        )}
      </div>
    </div>
  );
}