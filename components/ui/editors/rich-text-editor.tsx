"use client";

/**
 * RichTextEditor — WYSIWYG editor backed by TipTap + tiptap-markdown.
 *
 * Accepts and emits markdown strings so it's a drop-in replacement for
 * the textarea-based MarkdownEditor. Bold/italic/lists render visually in
 * real time; a hidden <input> keeps the serialized markdown in sync with
 * the parent <form> for FormData-based submission.
 *
 * Keyboard shortcuts (StarterKit defaults):
 *   Ctrl/Cmd+B  → Bold
 *   Ctrl/Cmd+I  → Italic
 *   Ctrl/Cmd+Shift+X → Strike
 */

import { useCallback, useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { Markdown } from "tiptap-markdown";
import type { MarkdownStorage } from "tiptap-markdown";
import {
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  Heading3,
  ImagePlus,
  Video,
} from "lucide-react";
import { cn } from "@/lib/core/utils";

// ── Toolbar button ────────────────────────────────────────────────────────────

function ToolbarBtn({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      // Prevent blurring the editor when clicking toolbar buttons
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={title}
      aria-pressed={active}
      className={cn(
        "p-1.5 rounded-sm transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface RichTextEditorProps {
  name: string;
  defaultValue?: string | null;
  placeholder?: string;
  className?: string;
  /** Tailwind min-h-* class for the editor area; defaults to min-h-64 */
  minHeightClass?: string;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  ariaLabel?: string;
  /** Called on any content change with the current markdown string. */
  onChange?: (value: string) => void;
}

export function RichTextEditor({
  name,
  defaultValue,
  placeholder,
  className,
  minHeightClass = "min-h-64",
  ariaInvalid,
  ariaDescribedBy,
  ariaLabel,
  onChange,
}: RichTextEditorProps) {
  const hiddenRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: placeholder ?? "Add a description…",
      }),
      Image.configure({
        inline: false,
        allowBase64: true,
      }),
      Link.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            "data-video": {default: null},
          };
        },
      }).configure({
        openOnClick: false,
        linkOnPaste: true,
        autolink: true,
      }),
      Markdown.configure({
        html: false,
        transformPastedText: true,
        transformCopiedText: false,
      }),
    ],
    content: defaultValue ?? "",
    // Avoid SSR mismatch — editor only runs on client
    immediatelyRender: false,
    editorProps: {
      attributes: {
        id: name,
        class: cn(
          "outline-none px-3 py-2.5 text-sm leading-relaxed cursor-text",
          minHeightClass,
          // Spacing for block elements
          "[&_ul]:list-disc [&_ul]:pl-4",
          "[&_ol]:list-decimal [&_ol]:pl-4",
          "[&_li]:mb-0.5",
          "[&_p:not(:last-child)]:mb-1",
          "[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
          // bold/italic/strike/h3 are handled in globals.css (.tiptap selectors)
          // to bypass the global --font-weight remapping
        ),
        ...(ariaInvalid != null && { "aria-invalid": String(ariaInvalid) }),
        ...(ariaDescribedBy != null && {
          "aria-describedby": ariaDescribedBy,
        }),
        ...(ariaLabel != null && { "aria-label": ariaLabel }),
      },
    },
    onUpdate({ editor }) {
      const markdown =
        (editor.storage as unknown as { markdown: MarkdownStorage }).markdown.getMarkdown();
      // Imperatively update the hidden input without triggering a re-render
      if (hiddenRef.current) {
        hiddenRef.current.value = markdown;
      }
      onChange?.(markdown);
    },
  });

  const handleInsertImage = useCallback(() => {
    const url = window.prompt("Enter image URL");
    if (!url) return;
    editor?.chain().focus().setImage({ src: url, alt: "" }).run();
  }, [editor]);

  const handleInsertVideo = useCallback(() => {
    const url = window.prompt("Enter video URL(YouTube, Vimeo, or direct video file)");
    if (!url) return;
    editor?.chain().focus().insertContent({
      type: "text",
      text: "Video",
      marks: [{ type: "link", attrs: { href: url, "data-video": "true"}}]
    }).run();
  }, [editor]);

  // Set initial hidden input value once editor is ready
  useEffect(() => {
    if (editor && hiddenRef.current) {
      hiddenRef.current.value =
        (editor.storage as unknown as { markdown: MarkdownStorage }).markdown.getMarkdown()
        ?? defaultValue ?? "";
    }
  }, [editor, defaultValue]);

  return (
    <div
      className={cn(
        "flex flex-col border rounded-md overflow-hidden focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/50 transition-shadow",
        ariaInvalid && "border-destructive",
        className,
      )}
    >
      {/* Formatting toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1 border-b bg-muted/30 shrink-0">
        <ToolbarBtn
          onClick={() => editor?.chain().focus().toggleBold().run()}
          active={editor?.isActive("bold") ?? false}
          title="Bold (Ctrl+B)"
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          active={editor?.isActive("italic") ?? false}
          title="Italic (Ctrl+I)"
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor?.chain().focus().toggleStrike().run()}
          active={editor?.isActive("strike") ?? false}
          title="Strikethrough (Ctrl+Shift+S)"
        >
          <Strikethrough className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={handleInsertImage}
          active={editor?.isActive("image") ?? false}
          title="Insert image markdown"
        >
          <ImagePlus className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={handleInsertVideo}
          active={editor?.isActive("link", { "data-video": "true" }) ?? false}
          title="Insert Video markdown"
        >
          <Video className="h-3.5 w-3.5" />
        </ToolbarBtn>

        <div className="w-px h-4 bg-border mx-1 shrink-0" />

        <ToolbarBtn
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 3 }).run()
          }
          active={editor?.isActive("heading", { level: 3 }) ?? false}
          title="Heading"
        >
          <Heading3 className="h-3.5 w-3.5" />
        </ToolbarBtn>

        <div className="w-px h-4 bg-border mx-1 shrink-0" />

        <ToolbarBtn
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          active={editor?.isActive("bulletList") ?? false}
          title="Bullet list"
        >
          <List className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          active={editor?.isActive("orderedList") ?? false}
          title="Ordered list"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarBtn>
      </div>

      {/* Editor — EditorContent renders the ProseMirror div */}
      <EditorContent editor={editor} className="flex-1" />

      {/* Hidden input for FormData submission */}
      <input
        ref={hiddenRef}
        type="hidden"
        name={name}
        defaultValue={defaultValue ?? ""}
      />
    </div>
  );
}
