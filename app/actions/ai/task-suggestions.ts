"use server";

import {
  buildTaskSuggestion,
  type TaskSuggestionResult,
} from "@/lib/ai/task-suggestions";

export type TaskSuggestionInput = {
  title: string;
  description?: string | null;
  durationMin: number;
  peopleRequired: number;
  minWaitDays: number;
  maxWaitDays: number;
};

export type TaskSuggestionActionState =
  | { ok: true; suggestion: TaskSuggestionResult }
  | { ok: false; error: string };

export async function suggestTaskDetailsAction(
  _orgId: string,
  input: TaskSuggestionInput,
): Promise<TaskSuggestionActionState> {
  const title = input.title.trim();
  if (!title && !(input.description ?? "").trim()) {
    return {
      ok: false,
      error: "Add a task title or description before asking for suggestions.",
    };
  }

  return {
    ok: true,
    suggestion: buildTaskSuggestion(input),
  };
}