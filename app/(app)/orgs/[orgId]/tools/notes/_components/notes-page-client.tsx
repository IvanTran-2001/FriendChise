"use client";

import { useState, useEffect, useRef, useTransition, useCallback } from "react";
import { toast } from "sonner";
import {
  CloudLightning,
  CheckCircle2,
  Loader2,
  Trash2,
  FileText,
  AlertTriangle,
  Plus,
} from "lucide-react";
import { RegisterPageSidebarSubContent } from "@/components/layout/contexts/page-sidebar-context";
import { NotesSidebarContent } from "./notes-sidebar-content";
import { RichTextEditor } from "@/components/ui/editors/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionSidebar } from "@/components/layout/contexts/action-sidebar-context";
import { CreatePagePanel } from "./create-page-panel";
import {
  getNotePagesAction,
  getNotePageAction,
  updateNotePageAction,
  deleteNotePageAction,
} from "@/app/actions/tools/notes";

type NotePage = {
  id: string;
  title: string;
  content: string;
  position: number;
  orgId: string;
  createdAt: Date;
  updatedAt: Date;
};

interface NotesPageClientProps {
  orgId: string;
  initialPages: NotePage[];
  initialPageId: string;
}

type SaveStatus = "saved" | "saving" | "error";

export function NotesPageClient({
  orgId,
  initialPages,
  initialPageId,
}: NotesPageClientProps) {
  const { open, close } = useActionSidebar();
  const [isPending, startTransition] = useTransition();

  const [pages, setPages] = useState<NotePage[]>(initialPages);
  const [activePageId, setActivePageId] = useState<string>(initialPageId);

  const activePage = pages.find((p) => p.id === activePageId);

  // Draft states for active page
  const [localTitle, setLocalTitle] = useState("");
  const [localContent, setLocalContent] = useState("");

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [hasConflict, setHasConflict] = useState(false);
  const [editorVersion, setEditorVersion] = useState(0);
  const localTitleRef = useRef(localTitle);
  const localContentRef = useRef(localContent);

  // Keep track of pending save data to flush before page changes or on blur
  const pendingSaveRef = useRef<{ title: string; content: string } | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync draft states when active page changes
  const [prevActivePageId, setPrevActivePageId] = useState<string>(activePageId);
  const [prevActivePage, setPrevActivePage] = useState<NotePage | undefined>(activePage);

  useEffect(() => {
    localTitleRef.current = localTitle;
  }, [localTitle]);

  useEffect(() => {
    localContentRef.current = localContent;
  }, [localContent]);

  if (activePageId !== prevActivePageId || activePage !== prevActivePage) {
    setPrevActivePageId(activePageId);
    setPrevActivePage(activePage);
    if (activePage) {
      setLocalTitle(activePage.title);
      setLocalContent(activePage.content);
      setSaveStatus("saved");
      setHasConflict(false);
      setEditorVersion(0);
    } else {
      setLocalTitle("");
      setLocalContent("");
    }
  }

  // Reset refs and clear timers when the active page changes
  useEffect(() => {
    pendingSaveRef.current = null;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, [activePageId]);

  // Performs the actual save API call
  const saveNoteData = useCallback(
    async (pageId: string, title: string, content: string) => {
      const result = await updateNotePageAction(orgId, pageId, { title, content });
      if (!result.ok) {
        setSaveStatus("error");
        toast.error("Failed to auto-save changes.");
        return false;
      }
      setSaveStatus("saved");
      setPages((prev) =>
        prev.map((p) => (p.id === pageId ? { ...p, title, content } : p))
      );
      return true;
    },
    [orgId]
  );

  // Debounced auto-save trigger
  const triggerSave = useCallback(
    (nextTitle: string, nextContent: string) => {
      if (!activePageId) return;

      // Update local pending ref
      pendingSaveRef.current = { title: nextTitle, content: nextContent };
      setSaveStatus("saving");
      setHasConflict(false); // Typing resolves conflict alert locally

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        startTransition(async () => {
          if (pendingSaveRef.current && activePageId) {
            const success = await saveNoteData(
              activePageId,
              pendingSaveRef.current.title,
              pendingSaveRef.current.content
            );
            if (success) {
              pendingSaveRef.current = null;
            }
          }
        });
      }, 1000);
    },
    [activePageId, saveNoteData]
  );

  // Flush any unsaved edits immediately (e.g. before page change or on blur)
  const flushPendingSave = useCallback(async () => {
    if (pendingSaveRef.current && activePageId) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      setSaveStatus("saving");
      const title = pendingSaveRef.current.title;
      const content = pendingSaveRef.current.content;
      pendingSaveRef.current = null;
      await saveNoteData(activePageId, title, content);
    }
  }, [activePageId, saveNoteData]);

  // Handles switching active page
  const handlePageSelect = useCallback(
    async (id: string) => {
      await flushPendingSave();
      setActivePageId(id);
    },
    [flushPendingSave]
  );

  // Handles updating the title draft
  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const nextTitle = e.target.value;
    setLocalTitle(nextTitle);
    triggerSave(nextTitle, localContent);
  }

  // Handles updating the editor content draft
  function handleContentChange(nextContent: string) {
    setLocalContent(nextContent);
    triggerSave(localTitle, nextContent);
  }

  // Reloads page content from server (Conflict resolver)
  async function handleReload() {
    if (!activePageId) return;
    setSaveStatus("saving");
    const result = await getNotePageAction(orgId, activePageId);
    if (result.ok && result.page) {
      setPages((prev) =>
        prev.map((p) => (p.id === activePageId ? result.page! : p))
      );
      setLocalTitle(result.page.title);
      setLocalContent(result.page.content);
      setEditorVersion((v) => v + 1);
      setHasConflict(false);
      setSaveStatus("saved");
      pendingSaveRef.current = null;
    } else {
      setSaveStatus("error");
      toast.error("Failed to load latest changes.");
    }
  }

  // Delete active page handler
  function handleDeleteActive() {
    if (!activePage) return;
    if (!confirm(`Are you sure you want to delete "${activePage.title}"?`)) return;

    startTransition(async () => {
      const result = await deleteNotePageAction(orgId, activePage.id);
      if (!result.ok) {
        toast.error("Failed to delete page.");
        return;
      }
      toast.success(`"${activePage.title}" deleted.`);
      const remaining = pages.filter((p) => p.id !== activePage.id);
      setPages(remaining);
      setActivePageId(remaining[0]?.id || "");
    });
  }

  // Polling logic for live collaboration updates
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    const runPoll = async () => {
      if (document.visibilityState !== "visible") return;

      // 1. Poll page list for position, title, delete/add changes
      const listRes = await getNotePagesAction(orgId);
      if (listRes.ok && listRes.pages) {
        setPages((prev) => {
          const hasChanges =
            listRes.pages.length !== prev.length ||
            listRes.pages.some((serverPage: NotePage, idx: number) => {
              const localPage = prev[idx];
              return (
                !localPage ||
                localPage.id !== serverPage.id ||
                localPage.title !== serverPage.title ||
                localPage.position !== serverPage.position
              );
            });

          if (hasChanges) {
            return listRes.pages.map((serverPage: NotePage) => {
              // Maintain local unsaved edits if matching current active page
              if (serverPage.id === activePageId && pendingSaveRef.current) {
                return {
                  ...serverPage,
                  title: pendingSaveRef.current.title,
                  content: pendingSaveRef.current.content,
                };
              }
              return serverPage;
            });
          }
          return prev;
        });

        // If active page was deleted by someone else
        const stillExists = listRes.pages.some((p: NotePage) => p.id === activePageId);
        if (!stillExists) {
          setActivePageId(listRes.pages[0]?.id || "");
          return;
        }
      }

      // 2. Poll active page content to check for conflicts
      if (!activePageId) return;

      const pageRes = await getNotePageAction(orgId, activePageId);
      if (pageRes.ok && pageRes.page) {
        const serverPage = pageRes.page;

        const currentLocalTitle = pendingSaveRef.current?.title ?? localTitleRef.current;
        const currentLocalContent = pendingSaveRef.current?.content ?? localContentRef.current;

        if (
          serverPage.title !== currentLocalTitle ||
          serverPage.content !== currentLocalContent
        ) {
          // Check if user has active focus on title input or editor container
          const editorHasFocus =
            document.activeElement?.id === "note-editor" ||
            document.activeElement?.closest(".tiptap") !== null ||
            document.activeElement?.id === "note-title-input";

          if (editorHasFocus) {
            setHasConflict(true);
          } else {
            // Safe to update local states since user is not editing
            setLocalTitle(serverPage.title);
            setLocalContent(serverPage.content);
            setEditorVersion((v) => v + 1);
            setPages((prev) =>
              prev.map((p) => (p.id === activePageId ? serverPage : p))
            );
          }
        }
      }
    };

    intervalId = setInterval(runPoll, 5000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        runPoll();
        if (!intervalId) {
          intervalId = setInterval(runPoll, 5000);
        }
      } else {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [orgId, activePageId]);

  // Sidebar trigger for "+ Create first page" button
  function handleCreateClick() {
    open(
      "New Page",
      <CreatePagePanel
        orgId={orgId}
        onCreated={(page) => {
          setPages((prev) => [...prev, page]);
          setActivePageId(page.id);
        }}
        onClose={close}
      />,
    );
  }

  return (
    <>
      <RegisterPageSidebarSubContent
        content={
          <NotesSidebarContent
            orgId={orgId}
            pages={pages}
            activePageId={activePageId}
            onSelectPage={handlePageSelect}
            onCreatedPage={(page) => setPages((prev) => [...prev, page])}
            onDeletedPage={(id) => {
              const remaining = pages.filter((p) => p.id !== id);
              setPages(remaining);
              setActivePageId(remaining[0]?.id || "");
            }}
            onReorderPages={setPages}
          />
        }
      />

      <main className="flex-1 flex flex-col h-full bg-background overflow-hidden">
        {pages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-xl mx-auto">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-violet-500/10 text-violet-700 ring-1 ring-violet-500/15 dark:text-violet-300 mb-6">
              <FileText className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight mb-2">
              Collaborative Shared Notes
            </h1>
            <p className="text-muted-foreground text-sm max-w-sm mb-6">
              Create shared notes, checklists, and quick team reminders that everyone in your franchise can see and update.
            </p>
            <Button onClick={handleCreateClick} disabled={isPending}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Page
            </Button>
          </div>
        ) : activePage ? (
          <div className="flex-1 flex flex-col h-full overflow-hidden p-6 max-w-4xl w-full mx-auto gap-4">
            {/* Header / Meta */}
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b pb-4 shrink-0">
              <div className="flex-1 flex items-center gap-3 min-w-0 pr-4">
                <Input
                  id="note-title-input"
                  value={localTitle}
                  onChange={handleTitleChange}
                  onBlur={flushPendingSave}
                  className="text-2xl md:text-3xl font-bold tracking-tight bg-transparent border-none p-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/40 text-foreground truncate"
                  placeholder="Untitled Page"
                  disabled={isPending}
                />
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {/* Auto-save Status Indicator */}
                <div className="flex items-center gap-1.5 text-xs select-none">
                  {saveStatus === "saving" && (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      <span className="text-muted-foreground">Saving…</span>
                    </>
                  )}
                  {saveStatus === "saved" && (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      <span className="text-muted-foreground">Saved to cloud</span>
                    </>
                  )}
                  {saveStatus === "error" && (
                    <>
                      <CloudLightning className="h-3.5 w-3.5 text-destructive animate-pulse" />
                      <span className="text-destructive font-medium">Save failed</span>
                    </>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive rounded-full"
                  onClick={handleDeleteActive}
                  disabled={isPending}
                  title="Delete page"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Conflict Warning Banner */}
            {hasConflict && (
              <div className="flex items-center justify-between gap-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl px-4 py-3 text-sm text-amber-800 dark:text-amber-300 shrink-0 select-none animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                  <span>This page has been modified by another user.</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReload}
                  className="bg-background border-amber-500/30 text-amber-800 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-200 hover:bg-amber-500/10 shrink-0"
                >
                  Reload Changes
                </Button>
              </div>
            )}

            {/* Rich Text Editor */}
            <div className="flex-1 min-h-0 overflow-y-auto pr-1">
              <RichTextEditor
                key={`${activePageId}-${editorVersion}`}
                name="note-editor"
                defaultValue={localContent}
                onChange={handleContentChange}
                placeholder="Start typing your team notes here…"
                minHeightClass="min-h-[400px]"
                className="border-none shadow-none rounded-none focus-within:ring-0 focus-within:ring-offset-0 focus-within:border-none"
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-8 text-center text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        )}
      </main>
    </>
  );
}
