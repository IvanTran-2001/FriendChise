"use client";

import { TaskDescriptionMarkdown } from "../_components/task-description-markdown";

export function TaskDescription({
  description,
  orgId,
}: {
  description: string;
  orgId?: string;
}) {
  return <TaskDescriptionMarkdown description={description} orgId={orgId} />;
}
