"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

type Org = { id: string; name: string };

export function RecentOrgBanner({ orgs }: { orgs: Org[] }) {
  const [org, setOrg] = useState<Org | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    try {
      const lastId = localStorage.getItem("lastOrgId");
      if (!lastId) return;
      const match = orgs.find((o) => o.id === lastId);
      if (match) startTransition(() => setOrg(match));
    } catch {
      // localStorage unavailable
    }
  }, [orgs]);

  if (!org) return null;

  return (
    <Link
      href={`/orgs/${org.id}`}
      className="group mb-5 flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3.5 transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/15">
          <ArrowRight className="h-4 w-4 rotate-180" />
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Recent organization
          </span>
          <span className="truncate text-sm font-semibold text-foreground">
            {org.name}
          </span>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
