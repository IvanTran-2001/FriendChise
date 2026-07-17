"use client";

/**
 * In-page nav anchor link that smooth-scrolls to a section by id without
 * ever changing the URL (no `#hash` pushed to history).
 *
 * Plain `<a href="#id">` links push a history entry, which caused a real
 * bug: navigating to `/signin` and then pressing the browser Back button
 * could land on `/#product` in a state the app didn't reliably re-render.
 * Scrolling client-side and calling `preventDefault()` avoids that class of
 * bug entirely — there's simply no hash URL to go back to.
 */
export function NavAnchorLink({
  targetId,
  className,
  children,
}: {
  targetId: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={`#${targetId}`}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        document
          .getElementById(targetId)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }}
    >
      {children}
    </a>
  );
}
