"use client";

/**
 * TaskScopeControls — publish / freeze / unpublish controls for a task.
 *
 * Shown only on the task-owning (franchisor) org's task detail page when the
 * user holds MANAGE_TASKS. The current scope drives which actions are available:
 *
 *   ORG    → Publish button (sets GLOBAL, pushes to all current child orgs)
 *   GLOBAL → Freeze button  (sets FROZEN, stops auto-inherit for new orgs)
 *              Make Private button (sets ORG, optionally removes from children)
 *   FROZEN → Make Private button
 *              Re-publish button  (back to GLOBAL)
 */
import { useState, useTransition } from "react";
import { Globe, Lock, Snowflake } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  publishTaskAction,
  freezeTaskAction,
  unpublishTaskAction,
} from "@/app/actions/tasks";

type TaskScope = "ORG" | "GLOBAL" | "FROZEN";

interface TaskScopeControlsProps {
  orgId: string;
  taskId: string;
  scope: TaskScope;
}

const SCOPE_LABELS: Record<TaskScope, { label: string; description: string; className: string }> = {
  ORG: {
    label: "Private",
    description: "Only visible to your org",
    className: "text-muted-foreground",
  },
  GLOBAL: {
    label: "Published",
    description: "Shared with all franchisees",
    className: "text-green-600 dark:text-green-400",
  },
  FROZEN: {
    label: "Frozen",
    description: "Existing franchisees keep it, new ones don't inherit",
    className: "text-blue-600 dark:text-blue-400",
  },
};

export function TaskScopeControls({ orgId, taskId, scope: initialScope }: TaskScopeControlsProps) {
  const [scope, setScope] = useState<TaskScope>(initialScope);
  const [unpublishDialogOpen, setUnpublishDialogOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const info = SCOPE_LABELS[scope];

  function handlePublish() {
    startTransition(async () => {
      const result = await publishTaskAction(orgId, taskId);
      if (result.ok) {
        setScope("GLOBAL");
        toast.success("Task published to all franchisees");
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleFreeze() {
    startTransition(async () => {
      const result = await freezeTaskAction(orgId, taskId);
      if (result.ok) {
        setScope("FROZEN");
        toast.success("Task frozen — existing franchisees keep it");
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleRepublish() {
    startTransition(async () => {
      const result = await publishTaskAction(orgId, taskId);
      if (result.ok) {
        setScope("GLOBAL");
        toast.success("Task re-published");
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleUnpublish(removeFromChildren: boolean) {
    startTransition(async () => {
      const result = await unpublishTaskAction(orgId, taskId, removeFromChildren);
      if (result.ok) {
        setScope("ORG");
        toast.success(
          removeFromChildren
            ? "Task made private and removed from franchisees"
            : "Task made private",
        );
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      {/* Current scope badge */}
      <div className="flex items-center gap-1.5">
        {scope === "GLOBAL" && <Globe className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />}
        {scope === "FROZEN" && <Snowflake className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />}
        {scope === "ORG" && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
        <span className={`text-xs font-medium ${info.className}`}>{info.label}</span>
      </div>

      {/* Action buttons */}
      {scope === "ORG" && (
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={handlePublish}
          disabled={pending}
        >
          <Globe className="h-3 w-3" />
          Publish
        </Button>
      )}

      {scope === "GLOBAL" && (
        <>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={handleFreeze}
            disabled={pending}
          >
            <Snowflake className="h-3 w-3" />
            Freeze
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs text-muted-foreground"
            onClick={() => setUnpublishDialogOpen(true)}
            disabled={pending}
          >
            <Lock className="h-3 w-3" />
            Make Private
          </Button>
        </>
      )}

      {scope === "FROZEN" && (
        <>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={handleRepublish}
            disabled={pending}
          >
            <Globe className="h-3 w-3" />
            Re-publish
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs text-muted-foreground"
            onClick={() => setUnpublishDialogOpen(true)}
            disabled={pending}
          >
            <Lock className="h-3 w-3" />
            Make Private
          </Button>
        </>
      )}

      {/* Unpublish confirmation */}
      <AlertDialog open={unpublishDialogOpen} onOpenChange={setUnpublishDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Make task private?</AlertDialogTitle>
            <AlertDialogDescription>
              This task is currently shared with franchisees. Do you want to
              remove it from their task libraries too?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setUnpublishDialogOpen(false);
                handleUnpublish(false);
              }}
            >
              Keep in franchisees
            </AlertDialogAction>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setUnpublishDialogOpen(false);
                handleUnpublish(true);
              }}
            >
              Remove from franchisees
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
