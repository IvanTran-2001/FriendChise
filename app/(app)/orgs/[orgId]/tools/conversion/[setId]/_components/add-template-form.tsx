/**
 * AddTemplateForm — action sidebar panel for managing ConversionTemplates.
 *
 * Two sections:
 *   1. **Create form** — name input; creates a new empty template and immediately
 *      switches the calculator to it by navigating to `?template=<id>`.
 *   2. **Template list** — searchable list of existing templates. Clicking a row
 *      switches to that template. All templates except "Default" have a delete button.
 *
 * Active template state is URL-driven (`?template=<id>`). The effective active ID
 * mirrors the resolution logic in the server page:
 *   URL param → Default → first in list.
 */
"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Pencil, Trash2, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/core/utils";
import {
  createConversionTemplateAction,
  deleteConversionTemplateAction,
  duplicateConversionTemplateAction,
  renameConversionTemplateAction,
} from "@/app/actions/tools";

type Template = { id: string; name: string };

interface AddTemplateFormProps {
  orgId: string;
  setId: string;
  templates: Template[];
  onClose: () => void;
}

export function AddTemplateForm({
  orgId,
  setId,
  templates,
  onClose: _onClose,
}: AddTemplateFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [templateList, setTemplateList] = useState(templates);
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  // Resolve the active template from the URL (matching server logic)
  const urlTemplateId = searchParams.get("template");
  const effectiveTemplateId =
    templateList.find((t) => t.id === urlTemplateId)?.id ??
    templateList.find((t) => t.name === "Default")?.id ??
    templateList[0]?.id ??
    null;

  function selectTemplate(templateId: string) {
    router.replace(`?template=${templateId}`, { scroll: false });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createConversionTemplateAction(orgId, setId, name);
      if (!result.ok) {
        toast.error(
          "error" in result ? result.error : "Failed to create template.",
        );
        return;
      }
      if (result.ok) {
        setTemplateList((prev) => [...prev, result.template]);
        selectTemplate(result.template.id);
      }
      toast.success(`"${name.trim()}" created.`);
      setName("");
    });
  }

  function handleDelete(templateId: string) {
    setDeletingId(templateId);
    startTransition(async () => {
      const result = await deleteConversionTemplateAction(
        orgId,
        setId,
        templateId,
      );
      if (!result.ok) {
        toast.error(
          "error" in result ? result.error : "Failed to delete template.",
        );
      } else {
        const remaining = templateList.filter((t) => t.id !== templateId);
        setTemplateList(remaining);
        // If we just deleted the active template, switch to Default or first
        if (effectiveTemplateId === templateId) {
          const fallback =
            remaining.find((t) => t.name === "Default")?.id ?? remaining[0]?.id;
          if (fallback) selectTemplate(fallback);
        }
        toast.success("Template deleted.");
      }
      setDeletingId(null);
    });
  }

  function handleDuplicate(template: Template) {
    setDuplicatingId(template.id);
    startTransition(async () => {
      const newName = `${template.name} (Copy)`;
      const result = await duplicateConversionTemplateAction(
        orgId,
        setId,
        template.id,
        newName,
      );
      if (!result.ok) {
        toast.error(
          "error" in result ? result.error : "Failed to duplicate template.",
        );
      } else {
        setTemplateList((prev) => [...prev, result.template]);
        selectTemplate(result.template.id);
        toast.success(`"${result.template.name}" created.`);
      }
      setDuplicatingId(null);
    });
  }

  function handleRename(templateId: string) {
    const trimmed = editName.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const result = await renameConversionTemplateAction(
        orgId,
        setId,
        templateId,
        trimmed,
      );
      if (!result.ok) {
        toast.error(
          "error" in result ? result.error : "Failed to rename template.",
        );
      } else {
        setTemplateList((prev) =>
          prev.map((t) =>
            t.id === templateId ? { ...t, name: result.name } : t,
          ),
        );
        setEditingId(null);
        toast.success("Template renamed.");
      }
    });
  }

  const filteredTemplates = search
    ? templateList.filter((t) =>
        t.name.toLowerCase().includes(search.toLowerCase()),
      )
    : templateList;

  return (
    <div className="flex flex-col gap-5">
      {/* Create form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="template-name" className="text-sm font-medium">
            Name
          </label>
          <Input
            id="template-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Monday Batch"
            required
            autoFocus
            disabled={isPending}
          />
        </div>
        <Button
          type="submit"
          disabled={isPending || !name.trim()}
          className="w-full"
        >
          Create Template
        </Button>
      </form>

      <hr className="border-border" />

      {/* Template list */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Templates
          </span>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="h-7 w-32 text-xs"
          />
        </div>
        {templateList.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">
            No templates yet.
          </p>
        ) : filteredTemplates.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">No matches.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {filteredTemplates.map((t) => {
              const isActive = effectiveTemplateId === t.id;
              const isEditing = editingId === t.id;
              const isDefault = t.name === "Default";

              if (isEditing) {
                return (
                  <div
                    key={t.id}
                    className="flex flex-col gap-1.5 rounded-lg border border-primary bg-primary/5 px-3 py-2"
                  >
                    <Input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(t.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="h-7 text-sm"
                      disabled={isPending}
                    />
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => handleRename(t.id)}
                          disabled={
                            isPending ||
                            !editName.trim() ||
                            editName.trim() === t.name
                          }
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => setEditingId(null)}
                          disabled={isPending}
                        >
                          <X className="h-3 w-3 mr-1" />
                          Cancel
                        </Button>
                      </div>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => handleDelete(t.id)}
                        disabled={isPending || deletingId === t.id}
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        aria-label="Delete template"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={t.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => selectTemplate(t.id)}
                    aria-pressed={isActive}
                    className={cn(
                      "flex-1 min-w-0 flex items-center rounded-lg border px-3 py-2 cursor-pointer transition-colors",
                      isDefault
                        ? isActive
                          ? "border-amber-500 bg-amber-100 dark:bg-amber-900/50"
                          : "border-amber-400/80 bg-amber-100/70 dark:bg-amber-950/30 hover:border-amber-500 hover:bg-amber-100"
                        : isActive
                          ? "border-primary bg-primary/5"
                          : "bg-card hover:border-primary/40",
                    )}
                  >
                    <span
                      className={cn(
                        "text-sm font-medium truncate",
                        isDefault
                          ? "text-amber-800 dark:text-amber-300"
                          : isActive && "text-primary",
                      )}
                    >
                      {t.name}
                    </span>
                  </button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDuplicate(t);
                    }}
                    disabled={isPending || duplicatingId === t.id}
                    aria-label="Duplicate template"
                  >
                    <Copy />
                  </Button>
                  {!isDefault && (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(t.id);
                        setEditName(t.name);
                      }}
                      aria-label="Edit template"
                    >
                      <Pencil />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
