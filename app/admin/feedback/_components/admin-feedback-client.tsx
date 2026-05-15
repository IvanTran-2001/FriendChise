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

import { useState, useTransition, useEffect } from "react";
import { AlertCircle, Lightbulb, Check } from "lucide-react";
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
}: {
  feedback: FeedbackItem[];
}) {
  const [filter, setFilter] = useState<"all" | "unreviewed">("unreviewed");
  const [feedback, setFeedback] = useState(initial);
  const [, startTransition] = useTransition();
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});

  // Fetch short-lived signed read URLs for all images (private bucket)
  useEffect(() => {
    const load = async () => {
      const map: Record<string, string> = {};
      await Promise.all(
        initial
          .filter((f) => f.imageUrl)
          .map(async (f) => {
            const res = await getFeedbackImageReadUrl(f.imageUrl!);
            if (res.ok) map[f.imageUrl!] = res.signedUrl;
          }),
      );
      setImageUrls(map);
    };
    load();
  }, [initial]);

  const displayed = filter === "all" ? feedback : feedback.filter((f) => !f.reviewed);

  function toggleReviewed(id: string, next: boolean) {
    setFeedback((prev) =>
      prev.map((f) => (f.id === id ? { ...f, reviewed: next } : f)),
    );
    startTransition(async () => {
      await toggleFeedbackReviewedAction(id, next);
    });
  }

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 sm:px-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Feedback</h1>
          <p className="text-sm text-muted-foreground">
            {feedback.filter((f) => !f.reviewed).length} unreviewed ·{" "}
            {feedback.length} total
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

      {/* List */}
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
        </div>
      )}
    </div>
  );
}
