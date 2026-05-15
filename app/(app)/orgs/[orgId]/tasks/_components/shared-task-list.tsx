"use client";

/**
 * SharedTaskList — shows GLOBAL tasks published by the parent org.
 *
 * Tasks with an existing TaskInheritance row for this org are shown as
 * "Added". All others show an "Add to My Tasks" button that calls
 * `inheritTaskAction`.
 */
import { useState, useTransition } from "react";
import { Check, Plus, Clock, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { inheritTaskAction, removeInheritedTaskAction } from "@/app/actions/tasks";

type Task = {
  id: string;
  name: string;
  color: string;
  description: string | null;
  durationMin: number;
  minPeople: number;
  inheritedBy: { id: string }[];
};

interface SharedTaskListProps {
  orgId: string;
  tasks: Task[];
  canManageTasks: boolean;
}

function TaskCard({
  task,
  orgId,
  canManageTasks,
}: {
  task: Task;
  orgId: string;
  canManageTasks: boolean;
}) {
  const isAdded = task.inheritedBy.length > 0;
  const [added, setAdded] = useState(isAdded);
  const [pending, startTransition] = useTransition();

  function handleAdd() {
    startTransition(async () => {
      const result = await inheritTaskAction(orgId, task.id);
      if (result.ok) {
        setAdded(true);
        toast.success(`"${task.name}" added to your tasks`);
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleRemove() {
    startTransition(async () => {
      const result = await removeInheritedTaskAction(orgId, task.id);
      if (result.ok) {
        setAdded(false);
        toast.success(`"${task.name}" removed from your tasks`);
      } else {
        toast.error(result.error);
      }
    });
  }

  const durationLabel =
    task.durationMin < 60
      ? `${task.durationMin} min`
      : `${Math.floor(task.durationMin / 60)}h ${task.durationMin % 60 ? `${task.durationMin % 60}m` : ""}`.trim();

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors">
      <div
        className="mt-0.5 h-3 w-3 shrink-0 rounded-full"
        style={{ backgroundColor: task.color }}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-tight">{task.name}</p>
        {task.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {task.description}
          </p>
        )}
        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {durationLabel}
          </span>
          {task.minPeople > 1 && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {task.minPeople}+
            </span>
          )}
        </div>
      </div>
      {canManageTasks && (
        <div className="shrink-0">
          {added ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs text-muted-foreground"
              onClick={handleRemove}
              disabled={pending}
            >
              <Check className="h-3 w-3" />
              Added
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={handleAdd}
              disabled={pending}
            >
              <Plus className="h-3 w-3" />
              Add
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function SharedTaskList({ orgId, tasks, canManageTasks }: SharedTaskListProps) {
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm font-medium text-muted-foreground">No shared tasks yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Your franchisor hasn&apos;t published any tasks yet.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-4">
      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          orgId={orgId}
          canManageTasks={canManageTasks}
        />
      ))}
    </div>
  );
}
