"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pin, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import type { Task } from "./task-types";
import { formatDuration, ownershipBadge, stripMd } from "./task-format-utils";
import { TaskDescriptionMarkdown } from "../task-description-markdown";

interface TaskFeedViewProps {
  orgId: string;
  tasks: Task[];
  canManageTasks: boolean;
  isPending: boolean;
  onAddToList: (task: Task) => void;
  onDeleteClick: (task: Task) => void;
}

function formatFeedTime(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function Avatar({
  name,
  image,
}: {
  name: string;
  image: string | null;
}) {
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt={name} className="h-10 w-10 rounded-full object-cover shrink-0" />;
  }

  const hue = name
    .split("")
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 360;

  return (
    <div
      className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white shrink-0"
      style={{ backgroundColor: `hsl(${hue}, 55%, 52%)` }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function FeedComment({
  comment,
  isPinned,
}: {
  comment: NonNullable<Task["comments"]>[number];
  isPinned: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/70 px-3 py-2.5">
      <div className="flex items-start gap-2.5">
        <Avatar name={comment.authorName} image={comment.authorImage} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">{comment.authorName}</span>
            <span>·</span>
            <span>{formatFeedTime(comment.createdAt)}</span>
            {isPinned && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                <Pin className="h-3 w-3" />
                Pinned
              </span>
            )}
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-foreground/90 line-clamp-3">
            {stripMd(comment.content)}
          </p>
        </div>
      </div>
    </div>
  );
}

function TaskFeedCard({
  orgId,
  task,
  canManageTasks,
  isPending,
  onAddToList,
  onDeleteClick,
}: TaskFeedViewProps & { task: Task }) {
  const router = useRouter();
  const pinnedComments = task.comments ?? [];

  return (
    <article
      className="overflow-hidden rounded-[28px] border border-border/60 bg-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
      data-tour-target={task.name.toLowerCase().includes("fry morning batches") ? "task-fry-morning-batches" : undefined}
    >
      <Link href={`/orgs/${orgId}/tasks/${task.id}`} className="block w-full text-left">
        <div className="relative aspect-4/3 w-full overflow-hidden bg-linear-to-br from-amber-50 via-stone-100 to-stone-200">
          {task.imageSignedUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={task.imageSignedUrl}
              alt={task.name}
              className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <div
                className="flex h-20 w-20 items-center justify-center rounded-[28px] text-3xl font-semibold shadow-sm"
                style={{ backgroundColor: task.color + "18", color: task.color }}
              >
                {task.name.charAt(0).toUpperCase()}
              </div>
            </div>
          )}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-black/35 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-3.5">
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/80">
                  Recipe feed
                </p>
                <h3 className="mt-1 truncate text-lg font-semibold leading-tight text-white">
                  {task.name}
                </h3>
              </div>
              <span className="shrink-0 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-stone-800 backdrop-blur">
                {formatFeedTime(task.createdAt)}
              </span>
            </div>
          </div>
        </div>
      </Link>

      <div className="px-3.5 pt-3.5">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          {ownershipBadge(task, orgId)}
          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground">
            {formatDuration(task.durationMin)}
          </span>
          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground">
            {task.minPeople}+ ppl
          </span>
        </div>

        {task.description && (
          <div className="mt-3 rounded-2xl border border-border/60 bg-background/70 px-3 py-2.5">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Description
            </p>
            <TaskDescriptionMarkdown
              description={task.description}
              orgId={orgId}
              interactiveLinks={false}
              className="max-h-28 overflow-y-auto pr-1 text-sm leading-relaxed text-foreground/90 sm:max-h-32"
            />
          </div>
        )}
      </div>

      {pinnedComments.length > 0 && (
        <div className="border-t border-border/60 px-3.5 py-3.5">
          <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            <Pin className="h-3 w-3" />
            Pinned notes
          </div>
          <div className="space-y-1.5">
            {pinnedComments.map((comment) => (
              <FeedComment key={comment.id} comment={comment} isPinned />
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 border-t border-border/60 px-3.5 py-3.5">
        {canManageTasks && task._available && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            disabled={isPending}
            title="Add to my list"
            onClick={() => onAddToList(task)}
          >
            <Plus className="h-4 w-4" />
            <span className="sr-only">Add to list</span>
          </Button>
        )}

        {canManageTasks && !task._available && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" disabled={isPending}>
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Task actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push(`/orgs/${orgId}/tasks/${task.id}/edit`)}>
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem disabled>Duplicate</DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDeleteClick(task)}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </article>
  );
}

export function TaskFeedView(props: TaskFeedViewProps) {
  return (
    <div className="mx-auto flex w-full max-w-107.5 flex-col gap-3">
      {props.tasks.map((task) => (
        <TaskFeedCard key={task.id} {...props} task={task} />
      ))}
    </div>
  );
}

export function TaskFeedSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="mx-auto flex w-full max-w-107.5 flex-col gap-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="overflow-hidden rounded-[28px] border border-border/60 bg-card">
          <Skeleton className="h-36 w-full rounded-none" />
          <div className="px-3.5 pt-3.5">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-4 w-2/5 rounded" />
              <Skeleton className="h-3 w-16 rounded" />
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-12 rounded-full" />
              <Skeleton className="h-5 w-10 rounded-full" />
            </div>
            <div className="mt-3 rounded-2xl border border-border/60 bg-background/70 px-3 py-2.5 space-y-2">
              <Skeleton className="h-3 w-24 rounded" />
              <Skeleton className="h-3 w-full rounded" />
              <Skeleton className="h-3 w-11/12 rounded" />
            </div>
          </div>
          <div className="border-t border-border/60 px-3.5 py-3.5 space-y-2">
            <Skeleton className="h-3 w-28 rounded" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
          <div className="border-t border-border/60 px-3.5 py-3.5">
            <div className="flex justify-end gap-2">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}