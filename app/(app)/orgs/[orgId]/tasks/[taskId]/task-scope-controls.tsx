"use client";

/**
 * TaskScopeControls — publish / unpublish controls for a task.
 *
 * Shown only on the task-owning (franchisor) org's task detail page when the
 * user holds MANAGE_TASKS. The current scope drives which actions are available:
 *
 *   ORG    → Publish button (sets GLOBAL so franchisees can discover and inherit)
 *   GLOBAL → Make Private button (sets ORG; optionally removes from franchisees)
 *
 * Setting a task back to ORG stops new inheritances; existing TaskInheritance
 * rows are preserved (unless "Remove from franchisees" is chosen).
 */
import { useState, useTransition } from "react";
import { Globe, Lock } from "lucide-react";
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
  unpublishTaskAction,
} from "@/app/actions/tasks";

type TaskScope = "ORG" | "GLOBAL";

interface TaskScopeControlsProps {
  orgId: string;
  taskId: string;
  scope: TaskScope;
}

const SCOPE_LABELS: Record<TaskScope, { label: string; className: string }> = {
  ORG: {
    label: "Private",
    className: "text-muted-foreground",
  },
  GLOBAL: {
    label: "Published",
    className: "text-green-600 dark:text-green-400",
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
        toast.success("Task published — franchisees can now add it to their list");
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
            : "Task made private — franchisees who added it keep access",
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
        {scope === "GLOBAL" ? (
          <Globe className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
        ) : (
          <Lock className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <span className={`text-xs font-medium ${info.className}`}>{info.label}</span>
      </div>

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
