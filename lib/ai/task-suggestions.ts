/**
 * Raw inputs used to generate a task suggestion.
 */
type TaskSuggestionInput = {
  title: string;
  description?: string | null;
  durationMin: number;
  peopleRequired: number;
  minWaitDays: number;
  maxWaitDays: number;
};

/**
 * Normalized suggestion output consumed by the UI and task creation flow.
 */
export type TaskSuggestionResult = {
  title: string;
  description: string;
  durationMin: number;
  peopleRequired: number;
  minWaitDays: number;
  maxWaitDays: number;
  summary: string;
};

/**
 * Shared checklist text appended to every generated task description.
 */
const GENERIC_STEPS = [
  "Confirm the goal and the expected outcome.",
  "Gather the tools, supplies, or context needed to start.",
  "Work through the task in order and check the result before marking it done.",
];

/**
 * Lightweight keyword hints that steer the fallback suggestion toward a
 * sensible category when there is no AI model available.
 */
const TASK_HINTS = [
  {
    keywords: ["clean", "sweep", "mop", "wipe", "tidy", "wash"],
    summary: "A cleanup task that resets a space and leaves it ready for use.",
    durationMin: 45,
    peopleRequired: 1,
    minWaitDays: 1,
    maxWaitDays: 1,
  },
  {
    keywords: ["cook", "prep", "prepare", "bake", "serve", "meal"],
    summary: "A food-prep task that needs ingredients, timing, and a final check.",
    durationMin: 60,
    peopleRequired: 1,
    minWaitDays: 1,
    maxWaitDays: 2,
  },
  {
    keywords: ["deliver", "drop off", "pickup", "pick up", "transport"],
    summary: "A logistics task that moves something from one place to another.",
    durationMin: 30,
    peopleRequired: 1,
    minWaitDays: 0,
    maxWaitDays: 1,
  },
  {
    keywords: ["set up", "assemble", "install", "mount", "build"],
    summary: "A setup task that may need preparation, tools, and a second pair of hands.",
    durationMin: 60,
    peopleRequired: 2,
    minWaitDays: 1,
    maxWaitDays: 2,
  },
  {
    keywords: ["check", "inspect", "review", "audit", "verify"],
    summary: "A review task that checks quality, accuracy, or completion.",
    durationMin: 20,
    peopleRequired: 1,
    minWaitDays: 1,
    maxWaitDays: 1,
  },
  {
    keywords: ["plan", "schedule", "organize", "coordinate"],
    summary: "A planning task that gathers details and lines up the next steps.",
    durationMin: 30,
    peopleRequired: 1,
    minWaitDays: 1,
    maxWaitDays: 3,
  },
] as const;

/**
 * Collapses repeated whitespace so generated text is easier to read and match.
 */
function squashWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

/**
 * Capitalizes the first character while leaving the rest of the string alone.
 */
function titleCaseFirst(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Picks a usable title from the provided title or description.
 */
function deriveTitle(input: TaskSuggestionInput) {
  const cleanedTitle = squashWhitespace(input.title);
  if (cleanedTitle) return titleCaseFirst(cleanedTitle);

  const source = squashWhitespace(input.description ?? "");
  if (!source) return "New task";

  const firstLine = source.split(/[.!?\n]/, 1)[0] ?? source;
  const trimmed = firstLine.replace(/^[\s*-]+/, "").trim();
  if (!trimmed) return "New task";
  return titleCaseFirst(trimmed.slice(0, 60));
}

/**
 * Finds the first category hint whose keywords appear in the input text.
 */
function matchHint(text: string) {
  const lower = text.toLowerCase();
  return TASK_HINTS.find((hint) =>
    hint.keywords.some((keyword) => lower.includes(keyword)),
  );
}

/**
 * Builds the final description body shown to the user.
 */
function buildDescription(title: string, summary: string) {
  const bulletPoints = GENERIC_STEPS.map((step) => `- ${step}`).join("\n");
  return [
    summary,
    "",
    `Task: ${title}.`,
    "",
    "Suggested checklist:",
    bulletPoints,
  ].join("\n");
}

/**
 * Converts a rough task input into a polished task suggestion.
 *
 * The function prefers category hints when the text looks like cleanup,
 * logistics, setup, review, or planning work. Otherwise it uses the provided
 * timings and a conservative generic summary.
 */
export function buildTaskSuggestion(
  input: TaskSuggestionInput,
): TaskSuggestionResult {
  const title = deriveTitle(input);
  const combinedText = `${input.title} ${input.description ?? ""}`;
  const hint = matchHint(combinedText);
  const summary =
    hint?.summary ??
    "A straightforward task that should be easy to review and complete.";
  const durationMin = hint?.durationMin ?? input.durationMin ?? 30;
  const peopleRequired = hint?.peopleRequired ?? input.peopleRequired ?? 1;
  const minWaitDays = hint?.minWaitDays ?? input.minWaitDays ?? 1;
  const maxWaitDays = hint?.maxWaitDays ?? input.maxWaitDays ?? minWaitDays;

  return {
    title,
    description: buildDescription(title, summary),
    durationMin,
    peopleRequired,
    minWaitDays,
    maxWaitDays,
    summary,
  };
}