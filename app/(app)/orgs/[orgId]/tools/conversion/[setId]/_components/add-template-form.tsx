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
import { Copy, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  createConversionTemplateAction,
  deleteConversionTemplateAction,
  duplicateConversionTemplateAction,
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
        toast.error("error" in result ? result.error : "Failed to create template.");
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
      const result = await deleteConversionTemplateAction(orgId, setId, templateId);
      if (!result.ok) {
        toast.error("error" in result ? result.error : "Failed to delete template.");
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
      const result = await duplicateConversionTemplateAction(orgId, setId, template.id, newName);
      if (!result.ok) {
        toast.error("error" in result ? result.error : "Failed to duplicate template.");
      } else {
        setTemplateList((prev) => [...prev, result.template]);
        selectTemplate(result.template.id);
        toast.success(`"${result.template.name}" created.`);
      }
      setDuplicatingId(null);
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
          <p className="text-xs text-muted-foreground py-2">No templates yet.</p>
        ) : filteredTemplates.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">No matches.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {filteredTemplates.map((t) => {
              const isActive = effectiveTemplateId === t.id;
              return (
                <div key={t.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => selectTemplate(t.id)}
                    aria-pressed={isActive}
                    className={cn(
                      "flex-1 flex items-center justify-between rounded-lg border bg-card px-3 py-2 cursor-pointer transition-colors",
                      isActive
                        ? "border-primary bg-primary/5"
                        : "hover:border-primary/40",
                    )}
                  >
                    <span className={cn("text-sm font-medium truncate", isActive && "text-primary")}>
                      {t.name}
                    </span>
                  </button>
                  <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDuplicate(t); }}
                      disabled={isPending && duplicatingId === t.id}
                      className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-2"
                      aria-label="Duplicate template"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  {t.name !== "Default" && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }}
                      disabled={isPending && deletingId === t.id}
                      className="shrink-0 text-muted-foreground hover:text-destructive transition-colors p-2"
                      aria-label="Delete template"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
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
