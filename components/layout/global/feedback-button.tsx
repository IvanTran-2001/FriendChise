"use client";

/**
 * FeedbackButton — navbar button that opens the feedback form in the ActionSidebar.
 *
 * Desktop: outlined purple pill with icon + label.
 * Mobile:  icon-only square button.
 * Active state (sidebar open with "Feedback" title): solid purple fill.
 *
 * The button is intentionally a plain <button> (not a shadcn Button) so the
 * purple outlined/filled style can be applied directly without fighting variant
 * overrides.
 */

import { MessageSquarePlus } from "lucide-react";
import { useActionSidebar } from "@/components/layout/contexts/action-sidebar-context";
import { FeedbackContent } from "@/components/feedback/feedback-content";

export function FeedbackButton() {
  const { open, close, activeTitle } = useActionSidebar();

  function handleOpen() {
    open("Feedback", <FeedbackContent onClose={close} />);
  }

  const isActive = activeTitle === "Feedback";

  return (
    <>
      {/* Desktop: text button */}
      <button
        onClick={handleOpen}
        aria-label="Give feedback"
        className={`hidden sm:flex items-center gap-1.5 h-8.5 px-2.5 rounded-full border text-xs font-medium transition-all duration-150 cursor-pointer shadow-sm
          ${
            isActive
              ? "bg-purple-600 border-purple-600 text-white hover:bg-purple-700 hover:border-purple-700 hover:shadow-md"
              : "border-purple-500/70 bg-background/85 text-purple-500 hover:bg-purple-500/8 hover:border-purple-500 hover:shadow-md"
          }`}
      >
        <span className="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full bg-current/10">
          <MessageSquarePlus className="h-3.5 w-3.5" />
        </span>
        <span className="leading-none">Feedback</span>
      </button>

      {/* Mobile: icon only */}
      <button
        onClick={handleOpen}
        aria-label="Give feedback"
        className={`sm:hidden flex items-center justify-center h-8.5 w-8.5 rounded-full border transition-all duration-150 cursor-pointer shadow-sm
          ${
            isActive
              ? "bg-purple-600 border-purple-600 text-white hover:bg-purple-700 hover:shadow-md"
              : "border-purple-500/70 bg-background/85 text-purple-500 hover:bg-purple-500/8 hover:border-purple-500 hover:shadow-md"
          }`}
      >
        <MessageSquarePlus className="h-4 w-4" />
      </button>
    </>
  );
}
