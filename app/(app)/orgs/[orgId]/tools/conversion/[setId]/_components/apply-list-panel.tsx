"use client";

import { useState, useTransition } from "react";
import { ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import {
  getListPreviewAction,
  applyListToTemplateAction,
} from "@/app/actions/tools";

type List = { id: string; name: string };
type PreviewItem = { id: string; name: string; unit: string; quantity: number };

interface ApplyListPanelProps {
  orgId: string;
  setId: string;
  templateId: string;
  lists: List[];
  onApplied: () => void;
  onClose: () => void;
}

export function ApplyListPanel({
  orgId,
  setId,
  templateId,
  lists,
  onApplied,
  onClose,
}: ApplyListPanelProps) {
  const [selectedList, setSelectedList] = useState<List | null>(null);
  const [previewItems, setPreviewItems] = useState<PreviewItem[] | null>(null);
  const [isFetchingPreview, startFetchPreview] = useTransition();
  const [isApplying, startApply] = useTransition();
  const [confirmStep, setConfirmStep] = useState(false);

  function handleSelectList(item: { id: string; name: string }) {
    setSelectedList(item);
    setPreviewItems(null);
    setConfirmStep(false);
    startFetchPreview(async () => {
      const result = await getListPreviewAction(orgId, item.id);
      if (result.ok) {
        setPreviewItems(result.items);
      } else {
        toast.error("Failed to load list items.");
      }
    });
  }

  function handleApply(mode: "replace" | "add") {
    if (!selectedList) return;
    startApply(async () => {
      const result = await applyListToTemplateAction(
        orgId,
        setId,
        templateId,
        selectedList.id,
        mode,
      );
      if (!result.ok) {
        toast.error("error" in result ? result.error : "Failed to apply list.");
        return;
      }
      toast.success(
        mode === "replace"
          ? "From items replaced with list."
          : "List items added to From side.",
      );
      onApplied();
      onClose();
    });
  }

  const listOptions = lists.map((l) => ({ id: l.id, name: l.name }));

  return (
    <div className="flex flex-col h-full">
      {/* List picker */}
      <div className="px-4 py-4 border-b border-border flex flex-col gap-3">
        <p className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">
          Select a list
        </p>
        <SearchableCombobox
          items={listOptions}
          onSelect={handleSelectList}
          triggerLabel={selectedList?.name ?? "Choose list…"}
          placeholder="Search lists…"
          emptyText="No lists found."
        />
      </div>

      {/* Preview */}
      {selectedList && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {isFetchingPreview ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : previewItems && previewItems.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                This list has no items.
              </p>
            </div>
          ) : previewItems ? (
            <>
              <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
                <p className="text-xs text-muted-foreground/60">
                  {previewItems.length} item{previewItems.length !== 1 ? "s" : ""} · amounts summed
                </p>
              </div>

              <div className="flex-1 overflow-y-auto py-1">
                {previewItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 px-4 py-2.5"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.unit}</p>
                    </div>
                    <span className="text-sm tabular-nums font-semibold shrink-0">
                      {item.quantity % 1 === 0
                        ? item.quantity.toString()
                        : item.quantity.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Apply / Confirm step */}
              <div className="px-4 py-4 border-t border-border flex flex-col gap-2">
                {!confirmStep ? (
                  <Button
                    className="w-full"
                    disabled={isApplying}
                    onClick={() => setConfirmStep(true)}
                  >
                    Apply
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : (
                  <>
                    <p className="text-xs text-center text-muted-foreground mb-1">
                      How should this be applied?
                    </p>
                    <Button
                      variant="destructive"
                      className="w-full"
                      disabled={isApplying}
                      onClick={() => handleApply("replace")}
                    >
                      {isApplying ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      Replace existing From items
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={isApplying}
                      onClick={() => handleApply("add")}
                    >
                      {isApplying ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      Add on to From items
                    </Button>
                    <button
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors text-center mt-1"
                      onClick={() => setConfirmStep(false)}
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* Empty state */}
      {!selectedList && (
        <div className="flex-1 flex items-center justify-center px-4">
          <p className="text-sm text-muted-foreground text-center">
            Pick a list to preview its items and apply them as From quantities.
          </p>
        </div>
      )}
    </div>
  );
}
