"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ApplyTemplateDialog,
  type TemplateOption,
} from "./apply-template-dialog";

interface TimetableActionsProps {
  orgId: string;
  templates: TemplateOption[];
  anchor: string;
  todayStr: string;
}

/**
 * Renders two action buttons: "Apply Template" (opens dialog) and "Templates" (link).
 */
export function TimetableActions({
  orgId,
  templates,
  anchor,
  todayStr,
}: TimetableActionsProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);

  function openDialog() {
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={openDialog}
        className="shrink-0"
      >
        Apply Template
      </Button>
      <Button variant="outline" size="sm" asChild className="shrink-0">
        <Link href={`/orgs/${orgId}/timetable/templates`}>Templates</Link>
      </Button>

      <ApplyTemplateDialog
        key={dialogKey}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        orgId={orgId}
        templates={templates}
        defaultStartDate={anchor}
        todayStr={todayStr}
      />
    </>
  );
}