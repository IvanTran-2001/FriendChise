"use client";

import type { RefObject, FormEventHandler } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ScanToTaskUploadSectionProps = {
  formRef: RefObject<HTMLFormElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  selectedFiles: File[];
  scanPending: boolean;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onFilesChange: (files: File[]) => void;
};

export function ScanToTaskUploadSection({
  formRef,
  fileInputRef,
  selectedFiles,
  scanPending,
  onSubmit,
  onFilesChange,
}: ScanToTaskUploadSectionProps) {
  return (
    <section className="rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-6">
      <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <label className="flex cursor-pointer flex-col gap-3 rounded-3xl border border-dashed border-border/70 bg-background/60 p-4 transition-colors hover:border-primary/40 hover:bg-background">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-700 ring-1 ring-cyan-500/15 dark:text-cyan-300">
                <Upload className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Upload files</p>
                <p className="text-xs text-muted-foreground">
                  Multiple files allowed. PDFs, images, DOCX, TXT, and MD.
                </p>
              </div>
            </div>
            <Input
              ref={fileInputRef}
              type="file"
              name="files"
              multiple
              accept=".pdf,.doc,.docx,.txt,.md,image/*"
              onChange={(event) => {
                const files = Array.from(event.currentTarget.files ?? []);
                onFilesChange(files);
              }}
              className="cursor-pointer border-0 bg-transparent px-0 shadow-none file:mr-4 file:rounded-full file:border-0 file:bg-cyan-500 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-cyan-600"
            />
          </label>

          <div className="flex flex-col gap-3 rounded-3xl border bg-background/60 p-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Optional instruction</p>
              <p className="text-xs text-muted-foreground">
                Tell the AI what kind of task you want from these files.
              </p>
            </div>
            <textarea
              name="instruction"
              rows={5}
              placeholder="Make these into cleanup tasks, extract the action items, turn the handout into tasks…"
              className="min-h-28 w-full rounded-2xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            />
          </div>
        </div>

        {selectedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedFiles.map((file) => (
              <span key={`${file.name}-${file.size}`} className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
                {file.name}
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Scan files into drafts, then confirm them to create tasks.
          </p>
          <Button type="submit" disabled={scanPending || selectedFiles.length === 0}>
            {scanPending ? "Scanning…" : "Scan drafts"}
          </Button>
        </div>
      </form>
    </section>
  );
}