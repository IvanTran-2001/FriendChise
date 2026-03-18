import Link from "next/link";
import { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface ToolbarAction {
  label: string;
  href: string;
}

interface ToolbarProps {
  /** Left-side tools: search inputs, filter dropdowns, buttons, etc. */
  children?: ReactNode;
  /** Items for the "Actions ▼" dropdown on the right. */
  actions?: ToolbarAction[];
}

export function Toolbar({ children, actions }: ToolbarProps) {
  return (
    <div className="-mx-6 -mt-6 mb-6 border-b bg-card px-6 py-2 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 flex-1">{children}</div>

      {actions && actions.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
              Actions
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {actions.map((action) => (
              <DropdownMenuItem key={action.href} asChild>
                <Link href={action.href}>{action.label}</Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
