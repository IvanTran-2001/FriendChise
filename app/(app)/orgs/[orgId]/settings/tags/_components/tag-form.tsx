"use client";

import { useState, useActionState, useTransition, useEffect } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createTagAction, updateTagAction, addTagToTaskAction, removeTagFromTaskAction } from "@/app/actions/tags";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  SearchableCombobox,
  type ComboboxItem,
} from "@/components/ui/searchable-combobox";

// ─── Color presets ────────────────────────────────────────────────────────────

export const TAG_COLORS = [
  "#EF4444", "#F97316", "#EAB308", "#22C55E",
  "#14B8A6", "#3B82F6", "#8B5CF6", "#EC4899",
  "#6B7280", "#0F172A", "#92400E", "#166534",
];

const COLOR_LABELS: Record<string, string> = {
  "#EF4444": "Red",    "#F97316": "Orange",  "#EAB308": "Yellow",  "#22C55E": "Green",
  "#14B8A6": "Teal",   "#3B82F6": "Blue",    "#8B5CF6": "Violet",  "#EC4899": "Pink",
  "#6B7280": "Gray",   "#0F172A": "Dark",    "#92400E": "Brown",   "#166534": "Forest",
};

// ─── Color picker ─────────────────────────────────────────────────────────────

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="grid grid-cols-6 gap-2">
      {TAG_COLORS.map((hex) => (
        <button
          key={hex}
          type="button"
          className={cn(
            "w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 focus-visible:outline-none",
            value === hex ? "border-foreground scale-110" : "border-transparent",
          )}
          style={{ backgroundColor: hex }}
          onClick={() => onChange(hex)}
          aria-label={COLOR_LABELS[hex] ?? hex}
          title={COLOR_LABELS[hex] ?? hex}
        />
      ))}
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ActionResult = { ok: true } | { ok: false; error: string };

type Task = { id: string; name: string; color: string };

// ─── Task panel ───────────────────────────────────────────────────────────────
//
// create mode: tasks held in local state, emitted as hidden <input name="taskIds">
// edit mode:   add/remove fire server actions immediately

type TaskPanelProps =
  | { mode: "create"; allTasks: Task[] }
  | { mode: "edit"; orgId: string; tagId: string; allTasks: Task[]; tagTasks: Task[] };

function TaskPanel(props: TaskPanelProps) {
  const isEdit = props.mode === "edit";
  const [tasks, setTasks] = useState<Task[]>(isEdit ? props.tagTasks : []);
  const [isPending, startTransition] = useTransition();

  const taskIds = new Set(tasks.map((t) => t.id));
  const availableItems: ComboboxItem[] = props.allTasks
    .filter((t) => !taskIds.has(t.id))
    .map((t) => ({ id: t.id, name: t.name, color: t.color }));

  const add = (item: ComboboxItem) => {
    const task = props.allTasks.find((t) => t.id === item.id);
    if (!task) return;
    if (isEdit) {
      startTransition(async () => {
        const res = await addTagToTaskAction(props.orgId, task.id, props.tagId);
        if (res.ok) setTasks((prev) => [...prev, task]);
        else toast.error(res.error);
      });
    } else {
      setTasks((prev) => [...prev, task]);
    }
  };

  const remove = (taskId: string) => {
    if (isEdit) {
      startTransition(async () => {
        const res = await removeTagFromTaskAction(props.orgId, taskId, props.tagId);
        if (res.ok) setTasks((prev) => prev.filter((t) => t.id !== taskId));
        else toast.error(res.error);
      });
    } else {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-medium">Tasks</span>

      {/* Hidden inputs for create mode */}
      {!isEdit &&
        tasks.map((task) => (
          <input key={task.id} type="hidden" name="taskIds" value={task.id} />
        ))}

      <SearchableCombobox
        items={availableItems}
        onSelect={add}
        triggerLabel="Add task"
        placeholder="Search tasks…"
        emptyText="No tasks found"
        disabled={isPending}
      />

      {tasks.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tasks.map((task) => (
            <span
              key={task.id}
              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs"
            >
              <span
                className="inline-block w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: task.color }}
              />
              {task.name}
              <button
                type="button"
                className="ml-0.5 hover:text-destructive transition-colors leading-none"
                onClick={() => remove(task.id)}
                disabled={isPending}
                aria-label={`Remove ${task.name}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Create Tag Form ──────────────────────────────────────────────────────────

export function CreateTagForm({
  orgId,
  allTasks,
  onSuccess,
}: {
  orgId: string;
  allTasks: Task[];
  onSuccess?: () => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3B82F6");

  const boundAction = createTagAction.bind(null, orgId);
  const [state, dispatch, pending] = useActionState<ActionResult | null, FormData>(
    boundAction,
    null,
  );
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success("Tag created.");
      startTransition(() => {
        setName("");
        setColor("#3B82F6");
      });
      onSuccess?.();
    } else {
      toast.error(state.error);
    }
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("color", color);
    startTransition(() => dispatch(fd));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="new-tag-name" className="text-sm font-medium">
          Name <span className="text-destructive">*</span>
        </label>
        <Input
          id="new-tag-name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Prep, Cleaning…"
          className="h-9"
          required
          autoFocus
          disabled={pending}
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Color</label>
          <span
            className="inline-block w-4 h-4 rounded-full border border-border shrink-0"
            style={{ backgroundColor: color }}
          />
        </div>
        <ColorPicker value={color} onChange={setColor} />
      </div>

      <TaskPanel mode="create" allTasks={allTasks} />

      <Button
        type="submit"
        size="sm"
        disabled={pending || !name.trim()}
        className="w-full"
      >
        {pending ? "Creating…" : "Create tag"}
      </Button>
    </form>
  );
}

// ─── Edit Tag Form ─────────────────────────────────────────────────────────────

export function EditTagForm({
  orgId,
  tagId,
  defaultName,
  defaultColor,
  isDefault,
  allTasks,
  tagTasks,
  onSuccess,
}: {
  orgId: string;
  tagId: string;
  defaultName: string;
  defaultColor: string;
  isDefault: boolean;
  allTasks: Task[];
  tagTasks: Task[];
  onSuccess?: () => void;
}) {
  const [name, setName] = useState(defaultName);
  const [color, setColor] = useState(defaultColor);

  const boundAction = updateTagAction.bind(null, orgId, tagId);
  const [state, dispatch, pending] = useActionState<ActionResult | null, FormData>(
    boundAction,
    null,
  );
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success("Tag updated.");
      onSuccess?.();
    } else {
      toast.error(state.error);
    }
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("name", name);
    fd.set("color", color);
    startTransition(() => dispatch(fd));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="edit-tag-name" className="text-sm font-medium">
          Name <span className="text-destructive">*</span>
        </label>
        {isDefault ? (
          <>
            <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
              {name}
            </div>
            <p className="text-xs text-muted-foreground">Default tag names cannot be changed.</p>
          </>
        ) : (
          <Input
            id="edit-tag-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-9"
            required
            autoFocus
            disabled={pending}
          />
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Color</label>
          <span
            className="inline-block w-4 h-4 rounded-full border border-border shrink-0"
            style={{ backgroundColor: color }}
          />
        </div>
        <ColorPicker value={color} onChange={setColor} />
      </div>

      <TaskPanel
        mode="edit"
        orgId={orgId}
        tagId={tagId}
        allTasks={allTasks}
        tagTasks={tagTasks}
      />

      <Button
        type="submit"
        size="sm"
        disabled={pending}
        className="w-full"
      >
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
