import OpenAI from "openai";
import { scanToTaskConfig } from "./s2t-config";
import { buildScanToTaskDuplicateAdjudicationPrompt, summarizePromptDraft } from "./s2t-prompts";
import {
  limitText,
  logScanToTaskModelError,
  logScanToTaskModelInput,
  logScanToTaskModelResponse,
} from "./s2t-helpers";
import type { TaskDuplicateCandidate } from "@/lib/services/tasks";

const openAiKey = process.env.OPENAI_API_KEY?.trim();
const openAiClient = openAiKey ? new OpenAI({ apiKey: openAiKey }) : null;
const openAiModel = scanToTaskConfig.model;
const scanToTaskDebugLogging = scanToTaskConfig.debugLogging;
const scanToTaskVerboseLogging = scanToTaskConfig.verboseLogging;

export type ScanToTaskBatchResultDraft = {
  resultId: string;
  batchId: string;
  fileName: string;
  draft: {
    title: string;
    summary: string;
    description: string;
    sourceText: string;
    importantDetails: string[] | string;
    actionItems: string[] | string;
  };
};

export type ScanToTaskDuplicateAdjudication = {
  sameTask: boolean;
  reason: string;
};

export type DuplicateAdjudicationBudget = {
  remainingAttempts: number;
  maxConcurrent: number;
  activeAttempts: number;
  waiters: Array<() => void>;
  takeAttempt: () => boolean;
};

export function createDuplicateAdjudicationBudget({
  maxAttempts,
  maxConcurrency,
}: {
  maxAttempts: number;
  maxConcurrency: number;
}): DuplicateAdjudicationBudget {
  const budget: DuplicateAdjudicationBudget = {
    remainingAttempts: Math.max(0, maxAttempts),
    maxConcurrent: Math.max(1, maxConcurrency),
    activeAttempts: 0,
    waiters: [],
    takeAttempt() {
      if (budget.remainingAttempts <= 0) return false;
      budget.remainingAttempts -= 1;
      return true;
    },
  };

  return budget;
}

async function acquireDuplicateAdjudicationSlot(budget: DuplicateAdjudicationBudget) {
  if (budget.activeAttempts < budget.maxConcurrent) {
    budget.activeAttempts += 1;
    return;
  }

  await new Promise<void>((resolve) => {
    budget.waiters.push(resolve);
  });
}

function releaseDuplicateAdjudicationSlot(budget: DuplicateAdjudicationBudget) {
  const nextWaiter = budget.waiters.shift();
  if (nextWaiter) {
    nextWaiter();
    return;
  }

  budget.activeAttempts = Math.max(0, budget.activeAttempts - 1);
}

function formatCandidateText(candidate: TaskDuplicateCandidate) {
  return [candidate.name, candidate.description ?? "", `duration ${candidate.durationMin}`, `people ${candidate.minPeople}`]
    .filter(Boolean)
    .join("\n");
}

export async function adjudicateScanTaskDuplicate(
  draft: ScanToTaskBatchResultDraft["draft"],
  candidate: TaskDuplicateCandidate,
  budget?: DuplicateAdjudicationBudget,
): Promise<ScanToTaskDuplicateAdjudication | null> {
  if (!openAiClient) return null;
  if (budget) {
    await acquireDuplicateAdjudicationSlot(budget);
  }

  const input = {
    stage: "duplicate-adjudication",
    draftTitle: draft.title,
    draftSummary: limitText(draft.summary, 160),
    draftDescriptionPreview: limitText(draft.description, 240),
    candidateName: candidate.name,
    candidateDurationMin: candidate.durationMin,
    candidateMinPeople: candidate.minPeople,
  };

  try {
    logScanToTaskModelInput(scanToTaskDebugLogging, "duplicate-adjudication", openAiModel, input);

    const response = await openAiClient.chat.completions.create({
      model: openAiModel,
      temperature: scanToTaskConfig.duplicateAdjudicationTemperature,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: buildScanToTaskDuplicateAdjudicationPrompt(),
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `New draft:\n${JSON.stringify(summarizePromptDraft(draft), null, 2)}`,
            },
            {
              type: "text",
              text: `Existing task candidate:\n${formatCandidateText(candidate)}`,
            },
          ],
        },
      ],
    }, { timeout: scanToTaskConfig.requestTimeoutMs });

    const content = response.choices[0]?.message?.content;
    logScanToTaskModelResponse(
      scanToTaskDebugLogging,
      scanToTaskVerboseLogging,
      "duplicate-adjudication",
      response.id,
      openAiModel,
      content ?? "",
      response.usage,
    );
    if (!content) return null;

    const parsed = JSON.parse(content) as Partial<ScanToTaskDuplicateAdjudication>;
    if (typeof parsed.sameTask !== "boolean") return null;

    return {
      sameTask: parsed.sameTask,
      reason: typeof parsed.reason === "string" ? parsed.reason.trim() : "",
    };
  } catch (error) {
    logScanToTaskModelError(scanToTaskDebugLogging, "duplicate-adjudication", openAiModel, error, input);
    return null;
  } finally {
    if (budget) {
      releaseDuplicateAdjudicationSlot(budget);
    }
  }
}
