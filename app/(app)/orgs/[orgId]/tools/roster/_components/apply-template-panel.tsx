"use client";

import { useState, useTransition } from "react";
import { Loader2, Minus, Plus, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableCombobox, type ComboboxItem } from "@/components/ui/searchable-combobox";
import { useActionSidebar } from "@/components/layout/action-sidebar-context";
import { applyRosterTemplateAction } from "@/app/actions/roster";

type RosterTemplate = { id: string; name: string; cycleWeeks: number };

function thisMondayStr(): string {
  const d = new Date();
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

interface ApplyTemplatePanelProps {
  orgId: string;
  templates: RosterTemplate[];
}

export function ApplyTemplatePanel({ orgId, templates }: ApplyTemplatePanelProps) {
  const { close } = useActionSidebar();
  const [templateId, setTemplateId] = useState("");
  const [startDate, setStartDate] = useState(thisMondayStr);
  const [repeats, setRepeats] = useState(1);
  const [conflict, setConflict] = useState(false);
  const [isPending, startTransition] = useTransition();

  const selectedTemplate = templates.find((t) => t.id === templateId);
  const totalWeeks = selectedTemplate ? selectedTemplate.cycleWeeks * repeats : null;

  function handleApply(force: boolean) {
    if (!templateId || !startDate) return;
    startTransition(async () => {
      setConflict(false);
      const result = await applyRosterTemplateAction(orgId, templateId, startDate, repeats, force);
      if (!result.ok) {
        if (result.conflict) {
          setConflict(true);
        } else {
          toast.error(result.error ?? "Failed to apply template");
        }
        return;
      }
      toast.success("Template applied");
      close();
    });
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Template picker */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Template</span>
        <SearchableCombobox
          items={templates.map((t) => ({ id: t.id, name: t.name }))}
          onSelect={(item: ComboboxItem) => setTemplateId(item.id)}
          triggerLabel={selectedTemplate?.name ?? "Choose template…"}
          placeholder="Search templates…"
        />
      </div>

      {/* Starting week */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Starting week</span>
        <Input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="h-8 text-sm px-2"
        />
      </div>

      {/* Repeat cycles */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">
          Repeat{totalWeeks ? ` — ${totalWeeks} week${totalWeeks === 1 ? "" : "s"} total` : ""}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 shrink-0"
            disabled={repeats <= 1}
            onClick={() => setRepeats((r) => Math.max(1, r - 1))}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <span className="flex-1 text-center text-sm font-medium tabular-nums">{repeats}</span>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 shrink-0"
            disabled={repeats >= 52}
            onClick={() => setRepeats((r) => Math.min(52, r + 1))}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Conflict warning */}
      {conflict && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 flex gap-2 items-start">
          <TriangleAlert className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 dark:text-amber-300">
            Some of these weeks already have entries. Applying will replace them.
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={close}>
          Cancel
        </Button>
        {conflict ? (
          <Button
            size="sm"
            className="flex-1 bg-amber-600 hover:bg-amber-700 text-white border-0"
            disabled={isPending}
            onClick={() => handleApply(true)}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Replace"}
          </Button>
        ) : (
          <Button
            size="sm"
            className="flex-1"
            disabled={isPending || !templateId || !startDate}
            onClick={() => handleApply(false)}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
          </Button>
        )}
      </div>
    </div>
  );
}
