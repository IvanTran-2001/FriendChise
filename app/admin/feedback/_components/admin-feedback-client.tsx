"use client";

/**
 * AdminFeedbackClient — interactive feedback inbox for the admin panel.
 *
 * Features:
 * - Filter toggle: "Unreviewed" (default) | "All"
 * - Unreviewed count badge in the header
 * - Per-item type badge (Issue = red, Idea = amber), user email, org name, timestamp
 * - Screenshot thumbnail (clicks open full image in a new tab)
 * - Optimistic reviewed/unreviewed toggle: UI updates instantly, server action
 *   fires in a transition so a slow network doesn't block the interaction
 * - Reviewed items are dimmed (opacity-50)
 */

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { AlertCircle, Lightbulb, Check, Loader2 } from "lucide-react";
import { FeedbackType } from "@prisma/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toggleFeedbackReviewedAction } from "@/app/actions/feedback";
import { getFeedbackImageReadUrl } from "@/app/actions/storage";

type FeedbackItem = {
  id: string;
  createdAt: Date;
  type: FeedbackType;
  message: string;
  imageUrl: string | null;
  reviewed: boolean;
  user: { email: string | null; name: string | null };
  org: { id: string; name: string } | null;
};

const TYPE_CONFIG = {
  ISSUE: {
    label: "Issue",
    icon: AlertCircle,
    classes: "bg-destructive/10 text-destructive border-destructive/20",
  },
  IDEA: {
    label: "Idea",
    icon: Lightbulb,
    classes: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  },
} as const;

export function AdminFeedbackClient({
  feedback: initial,
  totalCount: initialTotalCount,
  totalPages,
  page,
  filter: initialFilter,
}: {
  feedback: FeedbackItem[];
  totalCount: number;
  totalPages: number;
  page: number;
  filter: "all" | "unreviewed";
}) {
  const [filter, setFilter] = useState<"all" | "unreviewed">(initialFilter);
  const [feedback, setFeedback] = useState(initial);
  const [loadedFilter, setLoadedFilter] = useState(initialFilter);
  const [, startTransition] = useTransition();
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [currentPage, setCurrentPage] = useState(page);
  const [hasMore, setHasMore] = useState(page < totalPages);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    setFeedback(initial);
    setCurrentPage(page);
    setHasMore(page < totalPages);
  }, [initial, page, totalPages]);

  const mergeUniqueFeedback = useCallback((current: FeedbackItem[], incoming: FeedbackItem[]) => {
    const byId = new Map<string, FeedbackItem>();
    for (const item of current) byId.set(item.id, item);
    for (const item of incoming) byId.set(item.id, item);
    return Array.from(byId.values());
  }, []);

  const loadPage = useCallback(
    async ({
      nextPage,
      replace,
      signal,
      requestSeq,
    }: {
      nextPage: number;
      replace: boolean;
      signal: AbortSignal;
      requestSeq: number;
    }) => {
      const params = new URLSearchParams();
      params.set("page", String(nextPage));
      params.set("pageSize", "10");
      params.set("filter", filter);

      const response = await fetch(`/api/admin/feedback?${params.toString()}`, {
        signal,
      });
      if (!response.ok) throw new Error("Failed to load feedback.");

      const data = (await response.json()) as {
        feedback: FeedbackItem[];
        totalCount: number;
        page: number;
        totalPages: number;
      };

      if (requestSeqRef.current !== requestSeq) return;

      setFeedback((current) =>
        replace ? mergeUniqueFeedback([], data.feedback) : mergeUniqueFeedback(current, data.feedback),
      );
      setTotalCount(data.totalCount);
      setCurrentPage(data.page);
      setHasMore(data.page < data.totalPages);
    },
    [filter, mergeUniqueFeedback],
  );

  useEffect(() => {
    if (filter === loadedFilter) return;

    const requestSeq = requestSeqRef.current + 1;
    requestSeqRef.current = requestSeq;
    const controller = new AbortController();

    void (async () => {
      setIsLoadingMore(false);
      try {
        await loadPage({
          nextPage: 1,
          replace: true,
          signal: controller.signal,
          requestSeq,
        });
        setLoadedFilter(filter);
      } finally {
        if (requestSeqRef.current === requestSeq) {
          setIsLoadingMore(false);
        }
      }
    })();

    return () => controller.abort();
  }, [filter, loadPage, loadedFilter]);

  useEffect(() => {
    if (isLoadingMore || !hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        if (isLoadingMore || !hasMore) return;

        const nextPage = currentPage + 1;
        const requestSeq = requestSeqRef.current;
        const controller = new AbortController();
        setIsLoadingMore(true);

        void loadPage({
          nextPage,
          replace: false,
          signal: controller.signal,
          requestSeq,
        })
          .catch(() => {
            // retry on next intersection
          })
          .finally(() => {
            if (requestSeqRef.current === requestSeq) setIsLoadingMore(false);
          });

        return () => controller.abort();
      },
      { rootMargin: "200px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [currentPage, hasMore, isLoadingMore, loadPage]);

  // Fetch short-lived signed read URLs for any loaded images (private bucket).
  useEffect(() => {
    const load = async () => {
      const nextMap: Record<string, string> = {};
      const results = await Promise.allSettled(
        feedback
          .filter((item) => item.imageUrl)
          .map(async (item) => {
            const res = await getFeedbackImageReadUrl(item.imageUrl!);
            if (res.ok) {
              return { imageUrl: item.imageUrl!, signedUrl: res.signedUrl };
            }
            return null;
          }),
      );

      for (const result of results) {
        if (result.status === "fulfilled" && result.value) {
          nextMap[result.value.imageUrl] = result.value.signedUrl;
        }
      }

      setImageUrls((current) => ({ ...current, ...nextMap }));
    };

    void load();
  }, [feedback]);

  const displayed =
    filter === "all" ? feedback : feedback.filter((f) => !f.reviewed);

  function toggleReviewed(id: string, next: boolean) {
    setFeedback((prev) =>
      prev.map((f) => (f.id === id ? { ...f, reviewed: next } : f)),
    );
    startTransition(async () => {
      await toggleFeedbackReviewedAction(id, next);
    });
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex items-end justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Feedback</h1>
          <p className="text-sm text-muted-foreground">
            {feedback.filter((f) => !f.reviewed).length} unreviewed · showing {feedback.length} of {totalCount}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={filter === "unreviewed" ? "default" : "outline"}
            onClick={() => setFilter("unreviewed")}
          >
            Unreviewed
          </Button>
          <Button
            size="sm"
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => setFilter("all")}
          >
            All
          </Button>
        </div>
      </div>

      {displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-2 rounded-xl border border-dashed">
          <Check className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {filter === "unreviewed" ? "All caught up!" : "No feedback yet."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {displayed.map((item) => {
            const config = TYPE_CONFIG[item.type];
            const Icon = config.icon;
            return (
              <div
                key={item.id}
                className={cn(
                  "rounded-xl border bg-card p-4 flex flex-col gap-3 transition-opacity",
                  item.reviewed && "opacity-50",
                )}
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border",
                        config.classes,
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      {config.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {item.user.email}
                    </span>
                    {item.org && (
                      <span className="text-xs text-muted-foreground">
                        · {item.org.name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {new Date(item.createdAt).toLocaleDateString("en-AU", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    <Button
                      size="sm"
                      variant={item.reviewed ? "outline" : "default"}
                      className="h-7 text-xs"
                      onClick={() => toggleReviewed(item.id, !item.reviewed)}
                    >
                      {item.reviewed ? "Reviewed" : "Mark reviewed"}
                    </Button>
                  </div>
                </div>

                {/* Message */}
                <p className="text-sm whitespace-pre-wrap">{item.message}</p>

                {/* Screenshot */}
                {item.imageUrl && imageUrls[item.imageUrl] && (
                  <a
                    href={imageUrls[item.imageUrl]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block mt-1"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrls[item.imageUrl]}
                      alt="Feedback screenshot"
                      className="rounded-md border border-border max-h-48 object-cover cursor-zoom-in hover:opacity-90 transition-opacity"
                    />
                  </a>
                )}
              </div>
            );
          })}

          {hasMore && (
            <div
              ref={sentinelRef}
              className="flex items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/20 px-3 py-4 text-sm text-muted-foreground"
            >
              {isLoadingMore ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading more…
                </span>
              ) : (
                <span>Scroll for more feedback</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
