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
import { useActionSidebar } from "@/components/layout/action-sidebar-context";
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
        className={`hidden sm:flex items-center gap-1.5 h-8 px-3 rounded-md border text-xs font-medium transition-colors
          ${
            isActive
              ? "bg-purple-600 border-purple-600 text-white hover:bg-purple-700 hover:border-purple-700"
              : "border-purple-500 text-purple-500 hover:bg-purple-500/10"
          }`}
      >
        <MessageSquarePlus className="h-3.5 w-3.5" />
        Feedback
      </button>

      {/* Mobile: icon only */}
      <button
        onClick={handleOpen}
        aria-label="Give feedback"
        className={`sm:hidden flex items-center justify-center h-9 w-9 rounded-md border transition-colors
          ${
            isActive
              ? "bg-purple-600 border-purple-600 text-white hover:bg-purple-700"
              : "border-purple-500 text-purple-500 hover:bg-purple-500/10"
          }`}
      >
        <MessageSquarePlus className="h-4 w-4" />
      </button>
    </>
  );
}
