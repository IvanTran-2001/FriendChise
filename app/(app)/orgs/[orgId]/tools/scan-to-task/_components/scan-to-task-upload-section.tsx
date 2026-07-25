"use client";

import type { RefObject, FormEventHandler } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatFileSize, SCAN_TO_TASK_UPLOAD_ACCEPT } from "@/lib/services/scan-to-task-shared";

type ScanToTaskUploadSectionProps = {
  formRef: RefObject<HTMLFormElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  selectedFiles: File[];
  scanPending: boolean;
  instructionText: string;
  onInstructionChange: (value: string) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onFilesChange: (files: File[]) => void;
};

export function ScanToTaskUploadSection({
  formRef,
  fileInputRef,
  selectedFiles,
  scanPending,
  instructionText,
  onInstructionChange,
  onSubmit,
  onFilesChange,
}: ScanToTaskUploadSectionProps) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card p-4 sm:p-6">
      <div className="flex items-center justify-center gap-2 sm:justify-start">
        <Upload className="h-3.5 w-3.5 text-muted-foreground" />
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">New scan</h2>
      </div>
      <p className="mt-1 text-center text-sm text-muted-foreground sm:text-left">
        Scan files into drafts, then review and confirm them to create tasks.
      </p>

      <form ref={formRef} onSubmit={onSubmit} className="mt-4 flex flex-col gap-4">
        <div className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border bg-muted/20 p-4 transition-colors hover:border-primary/30 hover:bg-muted/30">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/15">
                <Upload className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Upload files</p>
                <p className="text-xs text-muted-foreground">
                  Multiple files allowed. PDFs, images, DOCX, TXT, MD, CSV, JSON, and XML.
                </p>
              </div>
            </div>
            <div className="flex justify-center">
              <label
                htmlFor="scan-to-task-files"
                className="inline-flex h-9 cursor-pointer items-center justify-center rounded-full border border-border/70 bg-background px-4 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
              >
                Choose files
              </label>
            </div>
            <Input
              id="scan-to-task-files"
              ref={fileInputRef}
              type="file"
              name="files"
              multiple
              accept={SCAN_TO_TASK_UPLOAD_ACCEPT}
              onChange={(event) => {
                const files = Array.from(event.currentTarget.files ?? []);
                onFilesChange(files);
              }}
              className="sr-only"
            />
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-background p-4">
            <div>
              <p className="text-sm font-medium text-foreground">Optional instruction</p>
              <p className="text-xs text-muted-foreground">
                Tell the AI what kind of task you want from these files.
              </p>
            </div>
            <textarea
              name="instruction"
              rows={5}
              placeholder="Make these into cleanup tasks, extract the action items, turn the handout into tasks…"
              value={instructionText}
              onChange={(event) => onInstructionChange(event.target.value)}
              className="min-h-28 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            />
          </div>
        </div>

        {selectedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedFiles.map((file) => (
              <span key={`${file.name}-${file.size}`} className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground break-all">
                {file.name} · {formatFileSize(file.size)}
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {selectedFiles.length > 0
              ? `${selectedFiles.length} file${selectedFiles.length === 1 ? "" : "s"} selected.`
              : "Select files to get started."}
          </p>
          <Button type="submit" className="w-full sm:w-auto" disabled={scanPending || selectedFiles.length === 0}>
            {scanPending ? "Scanning…" : "Scan drafts"}
          </Button>
        </div>
      </form>
    </section>
  );
}