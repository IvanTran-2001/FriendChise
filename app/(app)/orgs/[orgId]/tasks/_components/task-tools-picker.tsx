"use client";

/**
 * Task tool picker.
 *
 * The picker opens in the action sidebar, lazy-loads the available tools for
 * the selected kind, and returns a normalized saved link object that the task
 * forms can persist or render later.
 */

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";

import { useActionSidebar } from "@/components/layout/action-sidebar-context";
import { Button } from "@/components/ui/button";
import { SearchableCombobox, type ComboboxItem } from "@/components/ui/searchable-combobox";
import type { TaskToolSelection } from "@/components/ui/task-tools";

export type { TaskToolSelection } from "@/components/ui/task-tools";

type ToolKind = "conversion" | "item-list" | "roster";

interface TaskToolsPickerProps {
  orgId: string;
  selectedTools: TaskToolSelection[];
  onSelectedToolsChange: (tools: TaskToolSelection[]) => void;
}

const KIND_META: Record<
  ToolKind,
  { label: string; emptyLabel: string; hubHref: string }
> = {
  // Shared labels and hub links for each tool type.
  conversion: {
    label: "Conversion",
    emptyLabel: "No conversion sets yet",
    hubHref: "/tools/conversion",
  },
  "item-list": {
    label: "Item List",
    emptyLabel: "No item lists yet",
    hubHref: "/tools/item-list",
  },
  roster: {
    label: "Roster",
    emptyLabel: "No roster templates yet",
    hubHref: "/tools/roster",
  },
};

const KIND_OPTIONS: ComboboxItem[] = [
  { id: "conversion", name: KIND_META.conversion.label },
  { id: "item-list", name: KIND_META["item-list"].label },
  { id: "roster", name: KIND_META.roster.label },
];

const HUB_OPTION_ID = "hub";

function toolPathFor(kind: ToolKind, id: string) {
  // Keep saved links aligned with the existing tool route structure.
  if (kind === "conversion") return `conversion/${id}`;
  if (kind === "item-list") return `item-list/lists/${id}`;
  return `roster/templates/${id}`;
}

function toolLabelFor(kind: ToolKind, name: string) {
  return `${KIND_META[kind].label}: ${name}`;
}

function ToolPickerContent({
  orgId,
  kind,
  onPick,
}: {
  orgId: string;
  kind: ToolKind;
  onPick: (selection: TaskToolSelection) => void;
}) {
  const meta = KIND_META[kind];
  const [items, setItems] = useState<{ id: string; name: string }[]>([]);
  const [loadedKind, setLoadedKind] = useState<ToolKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loading = loadedKind !== kind;
  const showError = loadedKind === kind && error !== null;

  useEffect(() => {
    let active = true;

    fetch(`/api/orgs/${orgId}/task-tools?kind=${kind}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to load tool options");
        }
        return (await response.json()) as { items: { id: string; name: string }[] };
      })
      .then((data) => {
        if (!active) return;
        setLoadedKind(kind);
        setError(null);
        setItems(data.items ?? []);
      })
      .catch(() => {
        if (!active) return;
        setLoadedKind(kind);
        setError("Unable to load options");
        setItems([]);
      });

    return () => {
      active = false;
    };
  }, [kind, orgId]);

  if (loading) {
    return <div className="rounded-2xl border bg-muted/30 p-4 text-sm text-muted-foreground">Loading {meta.label.toLowerCase()}s…</div>;
  }

  if (showError) {
    return <div className="rounded-2xl border bg-muted/30 p-4 text-sm text-muted-foreground">{error}</div>;
  }

  const comboboxItems: ComboboxItem[] = [
    { id: HUB_OPTION_ID, name: `${meta.label} Hub` },
    ...items.map((item) => ({
      id: item.id,
      name: item.name,
    })),
  ];

  return (
    <SearchableCombobox
      items={comboboxItems}
      onSelect={(item) => {
        if (item.id === HUB_OPTION_ID) {
          onPick({
            toolPath: `/orgs/${orgId}${meta.hubHref}`,
            toolLabel: `${meta.label} Hub`,
          });
          return;
        }

        const picked = items.find((candidate) => candidate.id === item.id);
        if (!picked) return;
        onPick({
          toolPath: toolPathFor(kind, picked.id),
          toolLabel: toolLabelFor(kind, picked.name),
        });
      }}
      triggerLabel={`Choose ${meta.label.toLowerCase()}`}
      placeholder={`Search ${meta.label.toLowerCase()}s…`}
      emptyText={`No ${meta.label.toLowerCase()}s found`}
    />
  );
}

export function TaskToolsPicker({
  orgId,
  selectedTools,
  onSelectedToolsChange,
}: TaskToolsPickerProps) {
  const { open, close, activeTitle } = useActionSidebar();

  function handlePick(selection: TaskToolSelection) {
    if (!selectedTools.some((tool) => tool.toolPath === selection.toolPath)) {
      onSelectedToolsChange([...selectedTools, selection]);
    }
    close();
  }

  function openPicker() {
    // The action sidebar stores the rendered ReactNode, so the picker state
    // that drives the dropdown must live inside the panel component itself.
    open(
      "Add Tools",
      <TaskToolsPickerPanel orgId={orgId} onPick={handlePick} />,
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant={activeTitle === "Add Tools" ? "default" : "outline"}
        size="sm"
        className="w-full justify-start gap-2"
        onClick={openPicker}
      >
        <Plus className="h-4 w-4" />
        Add Tools
      </Button>

      {selectedTools.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedTools.map((tool) => (
            <span
              key={tool.toolPath}
              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs"
            >
              {tool.toolLabel ?? "Tool"}
              <button
                type="button"
                className="ml-0.5 hover:text-destructive transition-colors leading-none"
                onClick={() =>
                  onSelectedToolsChange(
                    selectedTools.filter((selected) => selected.toolPath !== tool.toolPath),
                  )
                }
                aria-label={`Remove ${tool.toolLabel ?? "Tool"}`}
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

function TaskToolsPickerPanel({
  orgId,
  onPick,
}: {
  orgId: string;
  onPick: (selection: TaskToolSelection) => void;
}) {
  // This state belongs to the sidebar panel, not the trigger button, so the
  // kind dropdown can rerender the loaded tool list immediately.
  const [kind, setKind] = useState<ToolKind>("conversion");

  return (
    <div className="p-4">
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-sm font-medium">Choose a tool type</p>
        </div>

        <SearchableCombobox
          items={KIND_OPTIONS}
          triggerLabel={`Type: ${KIND_META[kind].label}`}
          placeholder="Search tool types…"
          emptyText="No tool types found"
          onSelect={(item) => setKind(item.id as ToolKind)}
        />

        <ToolPickerContent orgId={orgId} kind={kind} onPick={onPick} />
      </div>
    </div>
  );
}
