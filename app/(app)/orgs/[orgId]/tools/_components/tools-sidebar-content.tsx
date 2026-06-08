/**
 * ToolsSidebarContent — page sidebar for `/orgs/[orgId]/tools`.
 *
 * Renders a searchable list of available tools as nav links. Each tool
 * navigates to its own sub-page at `/orgs/[orgId]/tools/<toolId>`.
 *
 * `PLACEHOLDER_TOOLS` is a static list — swap for a DB-driven query once a
 * `Tool` model exists in the schema.
 */
"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowLeftRight, List, Users } from "lucide-react";
import { SearchInput } from "@/components/ui/search-input";
import { PageSidebarNavItem } from "@/components/layout/page-sidebar-nav-item";

// Placeholder tool list — replace with DB-driven data once the Tool model exists
const PLACEHOLDER_TOOLS = [
  { id: "item-list", name: "Item List", icon: List },
  { id: "conversion", name: "Conversion", icon: ArrowLeftRight },
  { id: "roster", name: "Roster", icon: Users },
];

export function ToolsSidebarContent({ orgId }: { orgId: string }) {
  const pathname = usePathname();
  const [search, setSearch] = useState("");

  const filtered = PLACEHOLDER_TOOLS.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Search */}
      <div className="px-3 py-2 border-b border-border shrink-0">
        <SearchInput
          placeholder="Search tools…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Tool list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-4 py-4 text-xs text-muted-foreground">
            No tools found.
          </p>
        ) : (
          filtered.map((tool) => {
            const href = `/orgs/${orgId}/tools/${tool.id}`;
            const isActive = pathname === href;
            const Icon = tool.icon;
            return (
              <PageSidebarNavItem
                key={tool.id}
                title={tool.name}
                url={href}
                icon={Icon}
                isActive={isActive}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
