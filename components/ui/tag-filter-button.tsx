"use client";

/**
 * TagFilterButton — tag filter for sidebar filter sections.
 * Thin URL-routing wrapper around FilterCombobox.
 *
 * Selecting a tag (or clearing) calls router.push with the new URL built from
 * `basePath` + `extraParams` + the chosen tagId.
 */
import { useRouter } from "next/navigation";
import { FilterCombobox } from "@/components/ui/filter-combobox";

type Tag = { id: string; name: string; color: string };

interface TagFilterButtonProps {
  tags: Tag[];
  selectedTagId: string | null;
  /** Path portion of the URL, e.g. `/orgs/abc/tasks` */
  basePath: string;
  /**
   * Other URL params to preserve when navigating.
   * tagId is automatically appended / omitted — do NOT include it here.
   */
  extraParams: Record<string, string>;
  /** Called with the new tagId (or null when clearing) before navigating. Use to sync cookies/localStorage. */
  onNavigate?: (tagId: string | null) => void;
}

export function TagFilterButton({
  tags,
  selectedTagId,
  basePath,
  extraParams,
  onNavigate,
}: TagFilterButtonProps) {
  const router = useRouter();

  function handleSelect(tagId: string | null) {
    onNavigate?.(tagId);
    const params = new URLSearchParams(extraParams);
    if (tagId) params.set("tagId", tagId);
    const qs = params.toString();
    router.push(`${basePath}${qs ? `?${qs}` : ""}`);
  }

  return (
    <FilterCombobox
      items={tags}
      selectedId={selectedTagId}
      allLabel="All tags"
      placeholder="Search tags…"
      ariaLabel="Filter by tag"
      onSelect={handleSelect}
    />
  );
}
