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
      className="group flex items-center justify-between gap-3 rounded-xl border bg-muted/40 hover:bg-muted/70 px-4 py-3 transition-colors mb-6"
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-muted-foreground font-medium">Continue where you left off</span>
        <span className="text-sm font-semibold">{org.name}</span>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0" />
    </Link>
  );
}
