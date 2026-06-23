"use client";

import { useEffect, useMemo, useState, isValidElement } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

type DocCodeBlockProps = {
  children: React.ReactNode;
};

function toClipboardText(value: React.ReactNode): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(toClipboardText).join("");
  }

  if (isValidElement(value)) {
    return toClipboardText((value.props as { children?: React.ReactNode }).children);
  }

  return "";
}

async function copyText(value: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Fall through to textarea fallback
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const success = document.execCommand("copy");
  document.body.removeChild(textarea);
  return success;
}

export function DocCodeBlock({ children }: DocCodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const code = useMemo(() => toClipboardText(children).replace(/\n+$/, ""), [children]);

  useEffect(() => {
    if (!copied) return;

    const timeout = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  return (
    <div className="group relative my-4 overflow-hidden rounded-lg border border-border/70 bg-muted/50">
      <div className="absolute right-2 top-2 z-10 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={async () => {
            const success = await copyText(code);
            if (success) {
              setCopied(true);
            }
          }}
          className="pointer-events-auto h-8 rounded-full border-border/70 bg-background/90 px-3 text-xs font-medium shadow-sm transition hover:-translate-y-0.5 hover:border-primary/20 hover:bg-background"
          aria-label={copied ? "Copied code block to clipboard" : "Copy code block to clipboard"}
        >
          {copied ? (
            <>
              <Check className="mr-1.5 h-3.5 w-3.5" />
              Copied
            </>
          ) : (
            <>
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              Copy
            </>
          )}
        </Button>
      </div>

      <pre className="overflow-x-auto p-3 text-sm">
        <code className="font-mono leading-6 text-foreground">{children}</code>
      </pre>
    </div>
  );
}