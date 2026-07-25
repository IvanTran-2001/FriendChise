"use client";

import { useRouter } from "next/navigation";
import { MultiFilterCombobox } from "@/components/ui/comboboxes/multi-filter-combobox";

type Tag = { id: string; name: string; color: string };

interface TagMultiFilterButtonProps {
  tags: Tag[];
  selectedTagIds: string[];
  basePath: string;
  extraParams: Record<string, string>;
  onNavigate?: (tagIds: string[]) => void;
}

export function TagMultiFilterButton({
  tags,
  selectedTagIds,
  basePath,
  extraParams,
  onNavigate,
}: TagMultiFilterButtonProps) {
  const router = useRouter();

  function handleSelect(tagIds: string[]) {
    onNavigate?.(tagIds);
    if (!onNavigate) {
      const params = new URLSearchParams(extraParams);
      if (tagIds.length > 0) {
        params.set("tagId", tagIds.join(","));
      } else {
        params.delete("tagId");
      }
      const qs = params.toString();
      router.push(`${basePath}${qs ? `?${qs}` : ""}`);
    }
  }

  return (
    <MultiFilterCombobox
      items={tags}
      selectedIds={selectedTagIds}
      allLabel="All tags"
      placeholder="Search tags…"
      ariaLabel="Filter by tag"
      onSelect={handleSelect}
    />
  );
}
