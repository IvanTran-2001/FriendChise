import OpenAI from "openai";
import { scanToTaskConfig } from "./s2t-config";
import { buildScanToTaskConflictMergePrompt, buildScanToTaskTaskMergePrompt } from "./s2t-prompts";
import { logScanToTaskModelError, logScanToTaskModelInput, logScanToTaskModelResponse } from "./s2t-helpers";
import { scanTaskDraftSchema, scanTaskMergeSchema, type ScanTaskDraftInput, type ScanTaskMergeInput } from "@/lib/validators/scan-to-task";

const openAiKey = process.env.OPENAI_API_KEY?.trim();
const openAiClient = openAiKey ? new OpenAI({ apiKey: openAiKey }) : null;
const openAiModel = scanToTaskConfig.model;
const scanToTaskDebugLogging = scanToTaskConfig.debugLogging;
const scanToTaskVerboseLogging = scanToTaskConfig.verboseLogging;

export async function mergeScanToTaskWithExistingTask(input: {
  existingTask: {
    id: string;
    name: string;
    description: string | null;
    durationMin: number;
    minPeople: number;
    maxPeople: number | null;
  };
  draft: {
    title: string;
    description: string;
    summary: string;
    sourceText: string;
  };
}): Promise<ScanTaskMergeInput | null> {
  if (!openAiClient) return null;

  const logInput = {
    stage: "task-merge",
    existingTaskId: input.existingTask.id,
    existingTaskTitle: input.existingTask.name,
    draftTitle: input.draft.title,
  };

  try {
    const prompt = buildScanToTaskTaskMergePrompt(input.existingTask, input.draft);
    logScanToTaskModelInput(scanToTaskDebugLogging, "task-merge", openAiModel, logInput);

    const response = await openAiClient.chat.completions.create({
      model: openAiModel,
      temperature: scanToTaskConfig.textTemperature,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: prompt.system,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt.user,
            },
          ],
        },
      ],
    }, { timeout: 20_000 });

    const content = response.choices[0]?.message?.content;
    logScanToTaskModelResponse(
      scanToTaskDebugLogging,
      scanToTaskVerboseLogging,
      "task-merge",
      response.id,
      openAiModel,
      content ?? "",
      response.usage,
    );
    if (!content) return null;

    const parsed = scanTaskMergeSchema.safeParse(JSON.parse(content));
    if (!parsed.success) return null;

    return parsed.data;
  } catch (error) {
    logScanToTaskModelError(scanToTaskDebugLogging, "task-merge", openAiModel, error, logInput);
    return null;
  }
}

export async function mergeScanToTaskConflictItems(input: {
  drafts: Array<{
    title: string;
    description: string;
    summary: string;
    sourceText: string;
  }>;
  tasks: Array<{
    id: string;
    name: string;
    description: string | null;
    durationMin: number;
    minPeople: number;
    maxPeople: number | null;
  }>;
  instruction?: string;
}): Promise<ScanTaskDraftInput | null> {
  if (!openAiClient) return null;

  const logInput = {
    stage: "conflict-merge",
    draftCount: input.drafts.length,
    taskCount: input.tasks.length,
    instructionPreview: input.instruction ? input.instruction.slice(0, 200) : "",
  };

  try {
    const prompt = buildScanToTaskConflictMergePrompt(input);
    logScanToTaskModelInput(scanToTaskDebugLogging, "conflict-merge", openAiModel, logInput);

    const response = await openAiClient.chat.completions.create({
      model: openAiModel,
      temperature: scanToTaskConfig.textTemperature,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: prompt.system,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt.user,
            },
          ],
        },
      ],
    }, { timeout: 20_000 });

    const content = response.choices[0]?.message?.content;
    logScanToTaskModelResponse(
      scanToTaskDebugLogging,
      scanToTaskVerboseLogging,
      "conflict-merge",
      response.id,
      openAiModel,
      content ?? "",
      response.usage,
    );
    if (!content) return null;

    const parsed = scanTaskDraftSchema.safeParse(JSON.parse(content));
    if (!parsed.success) return null;

    return parsed.data;
  } catch (error) {
    logScanToTaskModelError(scanToTaskDebugLogging, "conflict-merge", openAiModel, error, logInput);
    return null;
  }
}