/**
 * ToolsClient — landing page content for `/orgs/[orgId]/tools`.
 *
 * Two sections (recent first):
 *   1. **Recent** — last 5 ConversionSets by `updatedAt`, with a "View all" link.
 *      Hidden when the org has no sets yet.
 *   2. **Tools** — shortcut cards for each tool (Item List, Conversion, Roster)
 *      linking to their respective sub-pages.
 *
 * `TOOLS` is a static list mirroring `PLACEHOLDER_TOOLS` in `tools-sidebar-content.tsx`.
 * Both should be updated together when new tools are added.
 */
"use client";

import Link from "next/link";
import { ArrowLeftRight, ArrowRight, List, Users } from "lucide-react";
import { Toolbar } from "@/components/layout/toolbar";

const TOOLS = [
  { id: "item-list", name: "Item List", icon: List, description: "Manage your ingredient and product catalog" },
  { id: "conversion", name: "Conversion", icon: ArrowLeftRight, description: "Convert quantities between items" },
  { id: "roster", name: "Roster", icon: Users, description: "Manage team rosters and schedules" },
];

interface RecentSet {
  id: string;
  name: string;
  updatedAt: Date;
}

interface ToolsClientProps {
  orgId: string;
  recentSets: RecentSet[];
}

export function ToolsClient({ orgId, recentSets }: ToolsClientProps) {
  const recent = recentSets.slice(0, 5);

  return (
    <>
      <Toolbar />

      <div className="max-w-2xl mx-auto w-full px-1 py-6 flex flex-col gap-8">
        {/* Recent conversion sets */}
        {recent.length > 0 && (
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Recent</h2>
              <Link
                href={`/orgs/${orgId}/tools/conversion`}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                View all
              </Link>
            </div>
            <div className="flex flex-col gap-2">
              {recent.map((set) => (
                <Link
                  key={set.id}
                  href={`/orgs/${orgId}/tools/conversion/${set.id}`}
                  className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm hover:border-primary/40 hover:shadow-md transition-all group"
                >
                  <ArrowLeftRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="text-sm font-medium flex-1 truncate">{set.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(set.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Tool shortcuts */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tools</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {TOOLS.map((tool) => {
              const Icon = tool.icon;
              return (
                <Link
                  key={tool.id}
                  href={`/orgs/${orgId}/tools/${tool.id}`}
                  className="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm hover:border-primary/40 hover:shadow-md transition-all"
                >
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{tool.name}</span>
                    <span className="text-xs text-muted-foreground">{tool.description}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}
