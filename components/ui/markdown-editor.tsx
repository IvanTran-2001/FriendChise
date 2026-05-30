"use client";

import { useState, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  Heading3,
} from "lucide-react";

interface MarkdownEditorProps {
  name: string;
  defaultValue?: string | null;
  placeholder?: string;
  rows?: number;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
}

type ToolbarItem =
  | { icon: React.ElementType; label: string; action: () => void }
  | null;

export function MarkdownEditor({
  name,
  defaultValue,
  placeholder,
  rows = 5,
  ariaInvalid,
  ariaDescribedBy,
}: MarkdownEditorProps) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [tab, setTab] = useState<"write" | "preview">("write");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Toolbar actions ──────────────────────────────────────────────────────

  const wrapSelection = useCallback(
    (wrapper: string) => {
      const el = textareaRef.current;
      if (!el) return;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const selected = value.slice(start, end) || "text";
      const newValue =
        value.slice(0, start) + wrapper + selected + wrapper + value.slice(end);
      setValue(newValue);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(
          start + wrapper.length,
          start + wrapper.length + selected.length,
        );
      });
    },
    [value],
  );

  const prefixLines = useCallback(
    (prefix: string) => {
      const el = textareaRef.current;
      if (!el) return;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const selected = value.slice(start, end) || "";
      const lines = selected ? selected.split("\n") : [""];
      const prefixed = lines.map((l) => `${prefix}${l}`).join("\n");
      const newValue = value.slice(0, start) + prefixed + value.slice(end);
      setValue(newValue);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start, start + prefixed.length);
      });
    },
    [value],
  );

  const toggleHeading = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const pos = el.selectionStart;
    const lineStart = value.lastIndexOf("\n", pos - 1) + 1;
    const lineEndRaw = value.indexOf("\n", pos);
    const lineEnd = lineEndRaw === -1 ? value.length : lineEndRaw;
    const line = value.slice(lineStart, lineEnd);
    const already = line.startsWith("### ");
    const newLine = already ? line.slice(4) : `### ${line}`;
    const newValue = value.slice(0, lineStart) + newLine + value.slice(lineEnd);
    setValue(newValue);
    requestAnimationFrame(() => {
      el.focus();
      const delta = already ? -4 : 4;
      el.setSelectionRange(pos + delta, pos + delta);
    });
  }, [value]);

  const tools: ToolbarItem[] = [
    { icon: Bold, label: "Bold", action: () => wrapSelection("**") },
    { icon: Italic, label: "Italic", action: () => wrapSelection("_") },
    {
      icon: Strikethrough,
      label: "Strikethrough",
      action: () => wrapSelection("~~"),
    },
    null,
    { icon: List, label: "Bullet list", action: () => prefixLines("- ") },
    {
      icon: ListOrdered,
      label: "Numbered list",
      action: () => prefixLines("1. "),
    },
    null,
    { icon: Heading3, label: "Heading", action: toggleHeading },
  ];

  return (
    <div
      className={[
        "flex flex-col border rounded-md overflow-hidden",
        "focus-within:ring-2 focus-within:ring-ring",
        ariaInvalid ? "border-destructive" : "border-input",
      ].join(" ")}
    >
      {/* ── Header: tabs + toolbar ─────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b bg-muted/40 px-2 py-1 gap-2">
        {/* Write / Preview tabs */}
        <div className="flex gap-0.5">
          {(["write", "preview"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={[
                "px-2.5 py-1 text-xs font-medium rounded capitalize transition-colors",
                tab === t
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Formatting toolbar (write tab only) */}
        {tab === "write" && (
          <div className="flex items-center gap-0.5">
            {tools.map((tool, i) =>
              tool === null ? (
                <div key={i} className="w-px h-3.5 bg-border mx-1" />
              ) : (
                <button
                  key={tool.label}
                  type="button"
                  title={tool.label}
                  onClick={tool.action}
                  className="h-6 w-6 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                >
                  <tool.icon className="h-3.5 w-3.5" />
                </button>
              ),
            )}
          </div>
        )}
      </div>

      {/* ── Write pane ────────────────────────────────────────────────── */}
      {tab === "write" && (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          className="w-full px-3 py-2 text-sm bg-card resize-none focus:outline-none font-mono"
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
        />
      )}

      {/* ── Preview pane ──────────────────────────────────────────────── */}
      {tab === "preview" && (
        <div className="px-3 py-2 min-h-24 text-sm">
          {value.trim() ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => (
                  <p className="mb-2 last:mb-0">{children}</p>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal pl-4 mb-2 space-y-0.5">
                    {children}
                  </ol>
                ),
                li: ({ children }) => <li>{children}</li>,
                strong: ({ children }) => (
                  <strong className="font-semibold">{children}</strong>
                ),
                em: ({ children }) => <em className="italic">{children}</em>,
                del: ({ children }) => (
                  <del className="line-through">{children}</del>
                ),
                h3: ({ children }) => (
                  <h3 className="font-semibold mt-3 mb-1 first:mt-0">
                    {children}
                  </h3>
                ),
              }}
            >
              {value}
            </ReactMarkdown>
          ) : (
            <p className="text-muted-foreground italic">Nothing to preview.</p>
          )}
        </div>
      )}

      {/* Hidden input — picked up by FormData on submit */}
      <input type="hidden" name={name} value={value} />
    </div>
  );
}
