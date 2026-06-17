"use client";

import type { DocHeading } from "@/lib/docs";

type DocRightTocProps = {
  headings: DocHeading[];
};

function scrollToHeading(id: string) {
  const target = document.getElementById(id);
  if (!target) return;

  target.scrollIntoView({ behavior: "smooth", block: "start" });
  window.history.replaceState(null, "", `#${id}`);
}

export function DocRightToc({ headings }: DocRightTocProps) {
  if (headings.length === 0) {
    return <p className="text-sm text-muted-foreground">No sections</p>;
  }

  return (
    <nav className="space-y-1.5">
      {headings.map((heading, index) => (
        <button
          key={`${heading.level}-${heading.id}-${index}`}
          type="button"
          onClick={() => scrollToHeading(heading.id)}
          className={`block w-full rounded px-2 py-1.5 text-left text-sm wrap-break-word leading-snug text-foreground/80 hover:bg-muted hover:text-foreground ${
            heading.level === 3 ? "ml-3" : ""
          }`}
        >
          {heading.text}
        </button>
      ))}
    </nav>
  );
}
