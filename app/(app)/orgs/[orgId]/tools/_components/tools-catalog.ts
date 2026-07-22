/**
 * TOOLS_CATALOG — single source of truth for the Tool Hub grid and the
 * Tool Hub page sidebar list.
 *
 * Previously this list was duplicated (with slightly different fields) in
 * both `tools-client.tsx` and `tools-sidebar-content.tsx`. Centralizing it
 * here means new tools only need to be added in one place, and the icon
 * well tint used to identify a module stays visually identical between the
 * grid and the sidebar.
 *
 * `accent` is a full class string (bg/text/ring, with dark-mode variants)
 * applied directly to a `rounded-*` icon well — see `ToolCard` in
 * `tools-client.tsx` and the sidebar row renderer in
 * `tools-sidebar-content.tsx`.
 *
 * Swap for a DB-driven query once a `Tool` model exists in the schema.
 */
import type { ComponentType } from "react";
import { ArrowLeftRight, Calculator, ClipboardList, FileScan, List, Users } from "lucide-react";

export type ToolCatalogItem = {
  id: string;
  name: string;
  icon: ComponentType<{ className?: string }>;
  description: string;
  accent: string;
};

export const TOOLS_CATALOG: ToolCatalogItem[] = [
  {
    id: "item-list",
    name: "Items",
    icon: List,
    description: "Manage your ingredient and product catalog",
    accent: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/15 dark:text-emerald-300",
  },
  {
    id: "conversion",
    name: "Conversion",
    icon: ArrowLeftRight,
    description: "Convert quantities between items",
    accent: "bg-sky-500/10 text-sky-700 ring-sky-500/15 dark:text-sky-300",
  },
  {
    id: "menu",
    name: "Menu",
    icon: ClipboardList,
    description: "Build customer-facing menus",
    accent: "bg-rose-500/10 text-rose-700 ring-rose-500/15 dark:text-rose-300",
  },
  {
    id: "roster",
    name: "Roster",
    icon: Users,
    description: "Manage team rosters and schedules",
    accent: "bg-amber-500/10 text-amber-700 ring-amber-500/15 dark:text-amber-300",
  },
  {
    id: "calculator",
    name: "Calculator",
    icon: Calculator,
    description: "Quick arithmetic calculations",
    accent: "bg-indigo-500/10 text-indigo-700 ring-indigo-500/15 dark:text-indigo-300",
  },
  {
    id: "scan-to-task",
    name: "Scan to Task",
    icon: FileScan,
    description: "Convert files into task items",
    accent: "bg-cyan-500/10 text-cyan-700 ring-cyan-500/15 dark:text-cyan-300",
  },
];
