"use client";

/**
 * TaskDetailSidebar — page sidebar sub-content for the task detail page.
 *
 * Renders:
 *  - "Inherited" notice when the org has inherited this task from its parent
 *  - Sharing section (scope indicator + Publish / Freeze / Make Private) for
 *    task owners with MANAGE_TASKS
 *  - Sections section (opens the section-layout ActionSidebar) for any member
 *    with MANAGE_TASKS
 *  - Actions section (Edit link + Delete with confirmation) for task owners
 *    with MANAGE_TASKS
 */
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Globe, LayoutList, Lock, Pencil, Trash2 } from "lucide-react";
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
import { useActionSidebar } from "@/components/layout/action-sidebar-context";
import {
  deleteTaskAction,
  publishTaskAction,
  unpublishTaskAction,
} from "@/app/actions/tasks";
import { TaskSectionsPanel, type SectionRow } from "./task-sections-panel";

type TaskScope = "ORG" | "GLOBAL";

interface TaskDetailSidebarProps {
  orgId: string;
  taskId: string;
  taskName: string;
  isOwner: boolean;
  canManage: boolean;
  scope: TaskScope;
  sections: SectionRow[];
  sharedBy?: string;
  createdByName?: string;
}

// ---------------------------------------------------------------------------
// Scope controls
// ---------------------------------------------------------------------------

const SCOPE_META: Record<
  TaskScope,
  { label: string; icon: React.ReactNode; color: string }
> = {
  ORG: {
    label: "Private",
    icon: <Lock className="h-3.5 w-3.5" />,
    color: "text-muted-foreground",
  },
  GLOBAL: {
    label: "Published",
    icon: <Globe className="h-3.5 w-3.5" />,
    color: "text-green-600 dark:text-green-400",
  },
};

function ScopeSection({
  orgId,
  taskId,
  initialScope,
}: {
  orgId: string;
  taskId: string;
  initialScope: TaskScope;
}) {
  const [scope, setScope] = useState(initialScope);
  const [unpublishOpen, setUnpublishOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const meta = SCOPE_META[scope];

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error);
    });
  }

  return (
    <>
      {/* Current scope indicator */}
      <div className={`flex items-center gap-1.5 px-1 mb-2 ${meta.color}`}>
        {meta.icon}
        <span className="text-xs font-medium">{meta.label}</span>
      </div>

      <div className="flex flex-col gap-1">
        {scope === "ORG" && (
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2"
            disabled={pending}
            onClick={() =>
              run(async () => {
                const r = await publishTaskAction(orgId, taskId);
                if (r.ok) {
                  setScope("GLOBAL");
                  toast.success("Task published to all franchisees");
                }
                return r;
              })
            }
          >
            <Globe className="h-3.5 w-3.5" />
            Publish
          </Button>
        )}

        {scope === "GLOBAL" && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground"
            disabled={pending}
            onClick={() => setUnpublishOpen(true)}
          >
            <Lock className="h-3.5 w-3.5" />
            Make Private
          </Button>
        )}
      </div>

      {/* Unpublish confirmation */}
      <AlertDialog open={unpublishOpen} onOpenChange={setUnpublishOpen}>
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
                setUnpublishOpen(false);
                run(async () => {
                  const r = await unpublishTaskAction(orgId, taskId, false);
                  if (r.ok) {
                    setScope("ORG");
                    toast.success("Task made private");
                  }
                  return r;
                });
              }}
            >
              Keep in franchisees
            </AlertDialogAction>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setUnpublishOpen(false);
                run(async () => {
                  const r = await unpublishTaskAction(orgId, taskId, true);
                  if (r.ok) {
                    setScope("ORG");
                    toast.success("Task removed from franchisees");
                  }
                  return r;
                });
              }}
            >
              Remove from franchisees
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Delete section
// ---------------------------------------------------------------------------

function DeleteSection({
  orgId,
  taskId,
  taskName,
}: {
  orgId: string;
  taskId: string;
  taskName: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteTaskAction(orgId, taskId);
      if (res.ok) {
        router.push(`/orgs/${orgId}/tasks`);
      } else {
        toast.error(res.error);
        setConfirming(false);
      }
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
        onClick={() => setConfirming(true)}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete
      </Button>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &ldquo;{taskName}&rdquo;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={pending}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

export function TaskDetailSidebar({
  orgId,
  taskId,
  taskName,
  isOwner,
  canManage,
  scope,
  sections,
  sharedBy,
  createdByName,
}: TaskDetailSidebarProps) {
  const { open, close, activeTitle } = useActionSidebar();
  const SECTIONS_TITLE = "Sections";

  function handleSectionsOpen() {
    if (activeTitle === SECTIONS_TITLE) {
      close();
      return;
    }
    open(
      SECTIONS_TITLE,
      <TaskSectionsPanel
        orgId={orgId}
        taskId={taskId}
        initialSections={sections}
        onSaved={close}
      />,
    );
  }

  return (
    <div className="flex flex-col gap-0">
      {/* Inherited notice */}
      {!isOwner && (
        <div className="px-3 pt-3 pb-2">
          <div className="flex flex-col gap-1 rounded-md bg-muted px-2.5 py-1.5">
            <div className="flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium">
                Shared by {sharedBy}
              </span>
            </div>
            {createdByName && (
              <span className="text-xs text-muted-foreground/70 pl-5">
                Created by {createdByName}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Sharing section */}
      {isOwner && canManage && (
        <div className="px-3 pt-3 pb-2">
          <p className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider px-1 mb-2">
            Sharing
          </p>
          <ScopeSection orgId={orgId} taskId={taskId} initialScope={scope} />
        </div>
      )}

      {/* Sections section */}
      {canManage && (
        <div className="px-3 pt-2 pb-2 border-t border-border">
          <p className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider px-1 mb-2">
            Layout
          </p>
          <Button
            variant={activeTitle === SECTIONS_TITLE ? "secondary" : "outline"}
            size="sm"
            className="w-full justify-start gap-2"
            onClick={handleSectionsOpen}
          >
            <LayoutList className="h-3.5 w-3.5" />
            Edit Sections
          </Button>
        </div>
      )}

      {/* Actions section */}
      {isOwner && canManage && (
        <div
          className="px-3 pt-2 pb-3 border-t border-border"
          data-testid="task-actions"
        >
          <p className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider px-1 mb-2">
            Actions
          </p>
          <div className="flex flex-col gap-1">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2"
              asChild
            >
              <Link href={`/orgs/${orgId}/tasks/${taskId}/edit`}>
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Link>
            </Button>
            <DeleteSection orgId={orgId} taskId={taskId} taskName={taskName} />
          </div>
        </div>
      )}
    </div>
  );
}
