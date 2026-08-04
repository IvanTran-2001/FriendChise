/**
 * Collapses repeated whitespace so extracted text and prompts stay compact
 * and easier for the model to parse.
 */
export function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Converts a sluggy or underscored string into a title-cased label.
 */
export function titleCase(value: string) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Derives a readable fallback task title from a source filename.
 */
export function filenameToTitle(fileName: string) {
  const base = fileName.replace(/\.[^.]+$/, "");
  const cleaned = cleanText(base.replace(/[._-]+/g, " "));
  return cleaned ? titleCase(cleaned) : "New task";
}

/**
 * Builds a short summary for non-image sources when no extracted text exists.
 */
export function filenameToSummary(fileName: string) {
  return `Imported from ${fileName}.`;
}

/**
 * Limits prompt text so we do not send excessively large inputs to the model.
 */
export function limitText(value: string, maxLength = 12000) {
  const cleaned = cleanText(value);
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength)}…` : cleaned;
}

/**
 * Limits text without collapsing internal whitespace or line breaks.
 * Use this when the model should still see the original document structure.
 */
export function limitTextPreservingFormatting(value: string, maxLength = 12000) {
  const normalized = value.replace(/\r\n/g, "\n").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}…` : normalized;
}

/**
 * Splits long source text into smaller chunks so a large document can become
 * multiple drafts instead of one oversized task.
 */
export function splitTextIntoChunks(value: string, maxChunkLength = 4000, maxChunks = 5) {
  const normalized = value.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let currentChunk = "";

  const pushCurrentChunk = () => {
    if (!currentChunk) return;
    chunks.push(currentChunk);
    currentChunk = "";
  };

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChunkLength) {
      pushCurrentChunk();

      const sentences = paragraph.split(/(?<=[.!?])\s+/).filter(Boolean);
      let sentenceChunk = "";

      for (const sentence of sentences) {
        if (!sentenceChunk) {
          sentenceChunk = sentence;
          continue;
        }

        if (sentenceChunk.length + sentence.length + 1 <= maxChunkLength) {
          sentenceChunk += ` ${sentence}`;
        } else {
          chunks.push(sentenceChunk);
          sentenceChunk = sentence;
        }
      }

      if (sentenceChunk) {
        chunks.push(sentenceChunk);
      }
      continue;
    }

    if (!currentChunk) {
      currentChunk = paragraph;
      continue;
    }

    if (currentChunk.length + paragraph.length + 2 <= maxChunkLength) {
      currentChunk += `\n\n${paragraph}`;
    } else {
      pushCurrentChunk();
      currentChunk = paragraph;
    }
  }

  pushCurrentChunk();

  while (chunks.length > maxChunks) {
    const tail = chunks.pop();
    if (!tail) continue;
    chunks[chunks.length - 1] = `${chunks[chunks.length - 1]}\n\n${tail}`;
  }

  return chunks;
}

/**
 * Builds a human-readable summary of a storage-backed file source.
 */
export function buildSourceSummary(fileName: string, kind: string, instruction: string) {
  const chunks = [
    `File: ${fileName}`,
    `Type: ${kind}`,
    instruction.trim() ? `Instruction: ${limitText(instruction, 500)}` : null,
  ].filter(Boolean);
  return chunks.join("\n");
}

/**
 * Normalizes the token usage fields returned by the OpenAI SDK.
 */
export function summarizeScanToTaskTokenUsage(usage: unknown) {
  if (!usage || typeof usage !== "object") return null;

  const record = usage as Record<string, unknown>;
  const promptTokens = record.prompt_tokens ?? record.promptTokens;
  const completionTokens = record.completion_tokens ?? record.completionTokens;
  const totalTokens = record.total_tokens ?? record.totalTokens;

  if (
    typeof promptTokens !== "number" &&
    typeof completionTokens !== "number" &&
    typeof totalTokens !== "number"
  ) {
    return null;
  }

  return {
    promptTokens: typeof promptTokens === "number" ? promptTokens : null,
    completionTokens: typeof completionTokens === "number" ? completionTokens : null,
    totalTokens: typeof totalTokens === "number" ? totalTokens : null,
  };
}

let scanToTaskLogSequence = 0;

function nextScanToTaskLogCallId() {
  scanToTaskLogSequence += 1;
  return `call-${scanToTaskLogSequence}`;
}

function baseLogPayload(context: string, model: string, callId: string, stage: string) {
  return {
    callId,
    stage,
    context,
    model,
  };
}

function printScanToTaskLogBlock(
  kind: "input" | "output" | "error",
  payload: Record<string, unknown>,
) {
  console.debug("");
  console.debug(`[scan-to-task] ${kind}`, payload);
}

/**
 * Logs the request input sent to a model call only when scan debug logging is enabled.
 */
export function logScanToTaskModelInput(
  enabled: boolean,
  context: string,
  model: string,
  input: Record<string, unknown>,
) {
  if (!enabled) return;
  const callId = nextScanToTaskLogCallId();
  printScanToTaskLogBlock("input", {
    ...baseLogPayload(context, model, callId, String(input.stage ?? context)),
    input,
  });
}

/**
 * Logs the response output returned by a model call only when scan debug logging is enabled.
 */
export function logScanToTaskModelResponse(
  enabled: boolean,
  verbose: boolean,
  context: string,
  responseId: string | undefined,
  model: string,
  content: string,
  usage?: unknown,
) {
  if (!enabled) return;
  printScanToTaskLogBlock("output", {
    context,
    responseId,
    model,
    ...(verbose ? { contentPreview: content.length > 500 ? `${content.slice(0, 500)}…` : content } : {}),
    contentLength: content.length,
    usage: summarizeScanToTaskTokenUsage(usage),
  });
}

/**
 * Logs model failures in the same shape as input/output logs.
 */
export function logScanToTaskModelError(
  enabled: boolean,
  context: string,
  model: string,
  error: unknown,
  input?: Record<string, unknown>,
) {
  if (!enabled) return;
  printScanToTaskLogBlock("error", {
    context,
    model,
    error: error instanceof Error ? error.message : String(error),
    ...(input ? { input } : {}),
  });
}