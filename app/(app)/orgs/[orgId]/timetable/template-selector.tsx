"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export type TemplateSelectorItem = { id: string; title: string };

interface TemplateSelectorProps {
  templates: TemplateSelectorItem[];
  selectedId: string | null;
}

export function TemplateSelector({
  templates,
  selectedId,
}: TemplateSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  const selected = templates.find((t) => t.id === selectedId);
  const label = selected ? selected.title : "Custom";

  function select(id: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (id) {
      params.set("template", id);
    } else {
      params.delete("template");
    }
    setOpen(false);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => setOpen((o) => !o)}
      >
        {label} <ChevronDown className="h-3.5 w-3.5" />
      </Button>

      {open && (
        <>
          {/* backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 bg-background border rounded-lg shadow-lg min-w-44 py-1">
            <button
              onClick={() => select(null)}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted/50 flex items-center gap-2"
            >
              {!selectedId && <Check className="h-3.5 w-3.5 text-primary" />}
              <span className={!selectedId ? "font-medium" : "ml-5"}>
                Custom (no template)
              </span>
            </button>
            {templates.length > 0 && <div className="border-t my-1" />}
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => select(t.id)}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted/50 flex items-center gap-2"
              >
                {t.id === selectedId ? (
                  <Check className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <span className="w-3.5" />
                )}
                <span
                  className={
                    t.id === selectedId ? "font-medium text-primary" : ""
                  }
                >
                  {t.title}
                </span>
              </button>
            ))}
            {templates.length === 0 && (
              <div className="px-3 py-1.5 text-xs text-muted-foreground italic">
                No templates yet
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
