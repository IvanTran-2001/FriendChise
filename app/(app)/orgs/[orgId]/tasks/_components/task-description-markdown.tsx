"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MarkdownImage, MarkdownLink } from "@/components/ui/editors/markdown-media";

type TaskDescriptionMarkdownProps = {
  description: string;
  orgId?: string;
  className?: string;
  interactiveLinks?: boolean;
};

export function TaskDescriptionMarkdown({
  description,
  orgId,
  className,
  interactiveLinks = true,
}: TaskDescriptionMarkdownProps) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p className="text-sm mb-2 last:mb-0">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="text-sm list-disc pl-4 mb-2 space-y-0.5">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="text-sm list-decimal pl-4 mb-2 space-y-0.5">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="text-sm">{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold">{children}</strong>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold mt-3 mb-1 first:mt-0">
              {children}
            </h3>
          ),
          img: ({ src, alt }) => (
            <MarkdownImage
              src={typeof src === "string" ? src : undefined}
              alt={alt}
              orgId={orgId}
            />
          ),
          a: ({ href, children }) =>
            interactiveLinks ? (
              <MarkdownLink href={href}>{children}</MarkdownLink>
            ) : (
              <span className="underline decoration-primary/40 text-primary/80">
                {children}
              </span>
            ),
        }}
      >
        {description}
      </ReactMarkdown>
    </div>
  );
}