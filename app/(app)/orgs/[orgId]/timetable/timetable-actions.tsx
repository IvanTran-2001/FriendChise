"use client";

/**
 * @file timetable-actions.tsx
 * "Actions" dropdown for the timetable toolbar.
 *
 * Manages the open/closed state of `ApplyTemplateDialog` locally so only
 * one import site (the server page) is needed.
 */

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ApplyTemplateDialog,
  type TemplateOption,
} from "./apply-template-dialog";

interface TimetableActionsProps {
  orgId: string;
  templates: TemplateOption[];
  weekStart: string;
}

/**
 * Renders the "Actions" dropdown button and the Apply Template dialog.
 * Provides "Apply Template" (opens dialog) and "Templates" (navigation link).
 */
export function TimetableActions({ orgId, templates, weekStart }: TimetableActionsProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
            Actions <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setDialogOpen(true)}>
            Apply Template
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={`/orgs/${orgId}/timetable/templates`}>
              Templates
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ApplyTemplateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        orgId={orgId}
        templates={templates}
        defaultStartDate={weekStart}
      />
    </>
  );
}
