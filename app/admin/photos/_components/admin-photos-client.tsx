"use client";

/**
 * AdminPhotosClient
 *
 * Drives three independent infinite-scroll photo grids:
 *  - Org logos        → /api/admin/photos/logos
 *  - Org gallery images → /api/admin/photos/org-images
 *  - Feedback screenshots → /api/admin/photos/feedback-images
 *
 * Each section manages its own page/totalPages/isLoadingInitial/isLoadingMore
 * state, following the same IntersectionObserver sentinel pattern used by
 * MembersPageClient and ItemListPageClient.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";

// ─── Shared tile type (matches all three API route response shapes) ───────────

type PhotoTile = {
  key: string;
  label: string;
  sublabel: string;
  src: string;
  href: string;
};

// ─── Individual photo card ────────────────────────────────────────────────────

function PhotoCard({ tile }: { tile: PhotoTile }) {
  return (
    <Card className="overflow-hidden border-border/70 bg-card/90 shadow-sm backdrop-blur-xl">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={tile.src}
        alt={tile.label}
        className="aspect-video w-full object-cover bg-muted"
      />
      <CardContent className="flex flex-col gap-1 p-4">
        <p className="font-medium leading-tight">{tile.label}</p>
        <p className="text-xs text-muted-foreground">{tile.sublabel}</p>
        <a
          href={tile.href}
          target="_blank"
          rel="noreferrer"
          className="mt-2 text-xs font-medium text-primary hover:underline"
        >
          Open full size
        </a>
      </CardContent>
    </Card>
  );
}

// ─── Sentinel / loading footer ────────────────────────────────────────────────

function GridSentinel({
  sentinelRef,
  isLoadingMore,
  hasMore,
}: {
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  isLoadingMore: boolean;
  hasMore: boolean;
}) {
  if (!hasMore) return null;
  return (
    <div
      ref={sentinelRef}
      className="col-span-full flex items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/20 px-3 py-4 text-sm text-muted-foreground"
    >
      {isLoadingMore ? (
        <span className="inline-flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading more…
        </span>
      ) : (
        <span>Scroll for more</span>
      )}
    </div>
  );
}

// ─── Generic infinite-scroll photo section ────────────────────────────────────

interface PhotoGridSectionProps {
  title: string;
  description: string;
  apiPath: string; // e.g. "/api/admin/photos/logos"
  pageSize?: number;
}

function PhotoGridSection({
  title,
  description,
  apiPath,
  pageSize = 12,
}: PhotoGridSectionProps) {
  const [items, setItems] = useState<PhotoTile[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const requestSeqRef = useRef(0);

  const mergeUnique = useCallback((current: PhotoTile[], incoming: PhotoTile[]) => {
    const byKey = new Map<string, PhotoTile>();
    for (const tile of current) byKey.set(tile.key, tile);
    for (const tile of incoming) byKey.set(tile.key, tile);
    return Array.from(byKey.values());
  }, []);

  const loadPage = useCallback(
    async ({
      targetPage,
      replace,
      signal,
      requestSeq,
    }: {
      targetPage: number;
      replace: boolean;
      signal: AbortSignal;
      requestSeq: number;
    }) => {
      const params = new URLSearchParams();
      params.set("page", String(targetPage));
      params.set("pageSize", String(pageSize));

      const response = await fetch(`${apiPath}?${params.toString()}`, { signal });
      if (!response.ok) throw new Error(`Failed to load ${title}.`);

      const data = (await response.json()) as {
        items: PhotoTile[];
        totalCount: number;
        totalPages: number;
        page: number;
      };

      if (requestSeqRef.current !== requestSeq) return;

      setItems((current) =>
        replace ? mergeUnique([], data.items) : mergeUnique(current, data.items),
      );
      setTotalPages(Math.max(1, data.totalPages));
      setTotalCount(data.totalCount);
      setPage(data.page);
    },
    [apiPath, mergeUnique, pageSize, title],
  );

  // Initial load
  useEffect(() => {
    const requestSeq = requestSeqRef.current + 1;
    requestSeqRef.current = requestSeq;
    const controller = new AbortController();

    void (async () => {
      setIsLoadingInitial(true);
      setIsLoadingMore(false);
      try {
        setItems([]);
        setPage(0);
        setTotalPages(1);
        setTotalCount(0);
        await loadPage({ targetPage: 1, replace: true, signal: controller.signal, requestSeq });
      } catch {
        if (requestSeqRef.current !== requestSeq) return;
        setItems([]);
        setTotalPages(1);
        setTotalCount(0);
      } finally {
        if (requestSeqRef.current !== requestSeq) return;
        setIsLoadingInitial(false);
      }
    })();

    return () => controller.abort();
  }, [loadPage]);

  // Infinite scroll sentinel
  useEffect(() => {
    if (isLoadingInitial || isLoadingMore) return;
    if (items.length === 0) return;
    if (page === 0 || page >= totalPages) return;

    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        if (isLoadingInitial || isLoadingMore || page >= totalPages) return;

        const nextPage = page + 1;
        const requestSeq = requestSeqRef.current;
        const controller = new AbortController();
        setIsLoadingMore(true);

        void loadPage({ targetPage: nextPage, replace: false, signal: controller.signal, requestSeq })
          .catch(() => {
            // Retry on next intersection.
          })
          .finally(() => {
            if (requestSeqRef.current !== requestSeq) return;
            setIsLoadingMore(false);
          });

        return () => controller.abort();
      },
      { rootMargin: "240px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [isLoadingInitial, isLoadingMore, items.length, loadPage, page, totalPages]);

  const hasMore = items.length > 0 && page < totalPages;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      {isLoadingInitial ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: Math.min(pageSize, 6) }).map((_, i) => (
            <Card
              key={i}
              className="overflow-hidden border-border/70 bg-card/90 shadow-sm backdrop-blur-xl animate-pulse"
            >
              <div className="aspect-video w-full bg-muted" />
              <CardContent className="flex flex-col gap-2 p-4">
                <div className="h-4 w-2/3 rounded bg-muted" />
                <div className="h-3 w-1/2 rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="border-dashed border-border/70 bg-card/80">
          <CardContent className="p-6 text-sm text-muted-foreground">
            No images found in this section.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((tile) => (
            <PhotoCard key={tile.key} tile={tile} />
          ))}
          <GridSentinel
            sentinelRef={sentinelRef}
            isLoadingMore={isLoadingMore}
            hasMore={hasMore}
          />
        </div>
      )}

      {!isLoadingInitial && totalCount > 0 && (
        <p className="text-xs text-muted-foreground">
          Showing {items.length} of {totalCount}
        </p>
      )}
    </section>
  );
}

// ─── Root client component ────────────────────────────────────────────────────

interface AdminPhotosClientProps {
  /** Pre-fetched summary counts from the server shell for the stats bar. */
  orgLogosCount: number;
  orgImagesCount: number;
  feedbackImagesCount: number;
}

export function AdminPhotosClient({
  orgLogosCount,
  orgImagesCount,
  feedbackImagesCount,
}: AdminPhotosClientProps) {
  const totalPhotos = orgLogosCount + orgImagesCount + feedbackImagesCount;

  return (
    <div className="space-y-6">
      {/* Summary stats — sourced from fast server-side counts */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Total</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight">{totalPhotos}</p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Org logos</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight">{orgLogosCount}</p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Feedback images</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight">{feedbackImagesCount}</p>
        </div>
      </div>

      <PhotoGridSection
        title="Org logos"
        description="Public bucket images attached to organizations."
        apiPath="/api/admin/photos/logos"
        pageSize={12}
      />

      <PhotoGridSection
        title="Org gallery images"
        description="Public gallery images stored in the orgImages table."
        apiPath="/api/admin/photos/org-images"
        pageSize={12}
      />

      <PhotoGridSection
        title="Feedback screenshots"
        description="Private bucket uploads from feedback submissions."
        apiPath="/api/admin/photos/feedback-images"
        pageSize={12}
      />
    </div>
  );
}
