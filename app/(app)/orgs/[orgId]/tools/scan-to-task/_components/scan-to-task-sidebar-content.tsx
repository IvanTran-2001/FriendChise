"use client";

import { FileScan, FileText, Image } from "lucide-react";

export function ScanToTaskSidebarContent() {
  const supported = [
    { icon: Image, label: "Images", description: "Photos and screenshots" },
    { icon: FileScan, label: "PDFs", description: "Read the text you can scan" },
    { icon: FileText, label: "Docs", description: "TXT, MD, and DOCX files" },
  ];

  return (
    <div className="flex h-full flex-col gap-4 p-4 pt-3">
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-700 ring-1 ring-cyan-500/15 dark:text-cyan-300">
            <FileScan className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Scan to Task
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">
              Turn documents into task items.
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          Upload multiple files, add an optional instruction, and the tool will
          create a task for each one.
        </p>
      </div>

      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Supported inputs
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {supported.map(({ icon: Icon, label, description }) => (
            <div key={label} className="flex items-start gap-3 rounded-xl border bg-background/50 p-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-muted/50 text-muted-foreground">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          How it works
        </p>
        <ol className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
          <li className="flex gap-2"><span className="font-medium text-foreground">1.</span> Upload files.</li>
          <li className="flex gap-2"><span className="font-medium text-foreground">2.</span> Add a short instruction if needed.</li>
          <li className="flex gap-2"><span className="font-medium text-foreground">3.</span> Review tasks in list or feed view.</li>
          <li className="flex gap-2"><span className="font-medium text-foreground">4.</span> Open any task to edit details later.</li>
        </ol>
      </div>
    </div>
  );
}