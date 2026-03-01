import { z } from "zod";
import type { Question, GenerationStage } from "@trivia/shared";
import { randomUUID } from "crypto";
import { createAnthropicClient } from "./client";
import { PROMPTS } from "./prompts";

const TopicExpansionSchema = z.object({
  topics: z.array(
    z.object({
      interest: z.string(),
      subtopics: z.array(z.string()),
    })
  ),
});

const FactExtractionSchema = z.object({
  facts: z.array(
    z.object({
      subtopic: z.string(),
      fact: z.string(),
      answer: z.string(),
    })
  ),
});

const QuestionFormulationSchema = z.object({
  questions: z.array(
    z.object({
      interest: z.string().optional(),
      subInterest: z.string().optional(),
      text: z.string(),
      answer: z.string(),
    })
  ),
});

const DistractorSchema = z.object({
  questions: z.array(
    z.object({
      interest: z.string().optional(),
      subInterest: z.string().optional(),
      text: z.string(),
      options: z.array(z.string()).length(4),
      answer: z.string(),
    })
  ),
});

const MODEL = "claude-sonnet-4-20250514";
const INPUT_USD_PER_MILLION_TOKENS = 3;
const OUTPUT_USD_PER_MILLION_TOKENS = 15;

type ProgressFn = (payload: { stage: GenerationStage; message: string; percent: number }) => void;
type ClaudeCallStage = Exclude<GenerationStage, "complete">;

type GenerationLogContext = {
  roomCode?: string;
  runId?: string;
};

type ClaudeCallContext = {
  stage: ClaudeCallStage;
  roomCode: string;
  runId: string;
};

type ClaudeUsage = {
  input_tokens?: unknown;
  output_tokens?: unknown;
  [key: string]: unknown;
};

type ClaudeCost = {
  inputTokens: number;
  outputTokens: number;
  inputUsd: number;
  outputUsd: number;
  totalUsd: number;
};

type ClaudeCallResult = {
  text: string;
  usage: ClaudeUsage;
  cost: ClaudeCost;
};

function normalizeTopicValue(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
}

function interpolate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replaceAll(`{{${key}}}`, value),
    template
  );
}

function extractJson(text: string): string {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    throw new Error("No JSON object found in model response.");
  }
  return text.slice(first, last + 1);
}

function toNonNegativeInt(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.floor(parsed);
}

function roundUsd(value: number): number {
  return Number(value.toFixed(6));
}

function estimateClaudeCost(usage: ClaudeUsage): ClaudeCost {
  const inputTokens = toNonNegativeInt(usage.input_tokens);
  const outputTokens = toNonNegativeInt(usage.output_tokens);
  const inputUsd = (inputTokens / 1_000_000) * INPUT_USD_PER_MILLION_TOKENS;
  const outputUsd = (outputTokens / 1_000_000) * OUTPUT_USD_PER_MILLION_TOKENS;
  return {
    inputTokens,
    outputTokens,
    inputUsd,
    outputUsd,
    totalUsd: inputUsd + outputUsd,
  };
}

function structuredLog(payload: Record<string, unknown>, level: "log" | "error" = "log"): void {
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    ...payload,
  });
  if (level === "error") {
    console.error(line);
    return;
  }
  console.log(line);
}

async function callClaude(
  prompt: string,
  context: ClaudeCallContext,
  allowSearch = false
): Promise<ClaudeCallResult> {
  const client = createAnthropicClient();
  const startedAtMs = Date.now();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    temperature: 0.4,
    tools: allowSearch ? [{ type: "web_search_20250305", name: "web_search", max_uses: 5 } as any] : undefined,
    messages: [{ role: "user", content: prompt }],
  });

  const usage = (response.usage ?? {}) as ClaudeUsage;
  const cost = estimateClaudeCost(usage);

  structuredLog({
    event: "anthropic_cost",
    roomCode: context.roomCode,
    runId: context.runId,
    stage: context.stage,
    model: MODEL,
    allowSearch,
    stopReason: response.stop_reason,
    durationMs: Date.now() - startedAtMs,
    inputTokens: cost.inputTokens,
    outputTokens: cost.outputTokens,
    inputUsd: roundUsd(cost.inputUsd),
    outputUsd: roundUsd(cost.outputUsd),
    totalUsd: roundUsd(cost.totalUsd),
    usage,
  });

  const text = response.content
    .filter((item): item is { type: "text"; text: string } => item.type === "text")
    .map((item) => item.text)
    .join("\n");

  if (!text) {
    structuredLog(
      {
        event: "anthropic_response_warning",
        roomCode: context.roomCode,
        runId: context.runId,
        stage: context.stage,
        message: "No text blocks in Claude response.",
        contentTypes: response.content.map((item) => item.type),
      },
      "error"
    );
  }

  return { text, usage, cost };
}

export async function generateQuestions(
  interests: string[],
  questionCount: number,
  onProgress?: ProgressFn,
  logContext: GenerationLogContext = {}
): Promise<Question[]> {
  const roomCode = logContext.roomCode ?? "unknown";
  const runId = logContext.runId ?? randomUUID();
  const totals = {
    callCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalUsd: 0,
  };

  const addCallCost = (cost: ClaudeCost) => {
    totals.callCount += 1;
    totals.inputTokens += cost.inputTokens;
    totals.outputTokens += cost.outputTokens;
    totals.totalUsd += cost.totalUsd;
  };

  try {
  onProgress?.({
    stage: "topic_expansion",
    message: "Expanding topics...",
    percent: 10,
  });

  const topicPrompt = interpolate(PROMPTS.topicExpansion, {
    INTERESTS: JSON.stringify(interests, null, 2),
    QUESTION_COUNT: String(questionCount),
  });
  const topicResponse = await callClaude(topicPrompt, {
    stage: "topic_expansion",
    roomCode,
    runId,
  });
  addCallCost(topicResponse.cost);
  const topicJson = TopicExpansionSchema.parse(
    JSON.parse(extractJson(topicResponse.text))
  );
  const subtopicToInterest = new Map<string, string>();
  topicJson.topics.forEach((topic) => {
    const interest = normalizeTopicValue(topic.interest, "General");
    topic.subtopics.forEach((subtopic) => {
      const normalizedSubtopic = normalizeTopicValue(subtopic, "General");
      subtopicToInterest.set(normalizedSubtopic, interest);
    });
  });
  const subtopics = topicJson.topics.flatMap((topic) =>
    topic.subtopics.map((subtopic) => normalizeTopicValue(subtopic, "General"))
  );

  onProgress?.({
    stage: "fact_extraction",
    message: "Researching facts...",
    percent: 35,
  });

  const factPrompt = interpolate(PROMPTS.factExtraction, {
    SUBTOPICS: JSON.stringify(subtopics, null, 2),
  });
  const factResponse = await callClaude(
    factPrompt,
    {
      stage: "fact_extraction",
      roomCode,
      runId,
    },
    true
  );
  addCallCost(factResponse.cost);
  const factJson = FactExtractionSchema.parse(JSON.parse(extractJson(factResponse.text)));
  const enrichedFacts = factJson.facts.map((fact) => ({
    subInterest: normalizeTopicValue(fact.subtopic, "General"),
    interest: normalizeTopicValue(
      subtopicToInterest.get(normalizeTopicValue(fact.subtopic, "General")),
      "General"
    ),
    fact: fact.fact,
    answer: fact.answer,
  }));

  onProgress?.({
    stage: "question_formulation",
    message: "Formulating questions...",
    percent: 65,
  });

  const questionPrompt = interpolate(PROMPTS.questionFormulation, {
    FACTS: JSON.stringify(enrichedFacts, null, 2),
    QUESTION_COUNT: String(questionCount),
  });
  const questionResponse = await callClaude(questionPrompt, {
    stage: "question_formulation",
    roomCode,
    runId,
  });
  addCallCost(questionResponse.cost);
  const questionJson = QuestionFormulationSchema.parse(
    JSON.parse(extractJson(questionResponse.text))
  );
  const normalizedQuestions = questionJson.questions.map((question, index) => ({
    interest: normalizeTopicValue(
      question.interest,
      enrichedFacts[index]?.interest ?? "General"
    ),
    subInterest: normalizeTopicValue(
      question.subInterest,
      enrichedFacts[index]?.subInterest ?? "General"
    ),
    text: question.text,
    answer: question.answer,
  }));

  onProgress?.({
    stage: "distractor_generation",
    message: "Generating answer options...",
    percent: 85,
  });

  const distractorPrompt = interpolate(PROMPTS.distractorGeneration, {
    QUESTIONS: JSON.stringify(normalizedQuestions, null, 2),
  });
  const distractorResponse = await callClaude(distractorPrompt, {
    stage: "distractor_generation",
    roomCode,
    runId,
  });
  addCallCost(distractorResponse.cost);
  const distractorJson = DistractorSchema.parse(
    JSON.parse(extractJson(distractorResponse.text))
  );
  const finalizedQuestions = distractorJson.questions.map((question, index) => ({
    interest: normalizeTopicValue(
      question.interest,
      normalizedQuestions[index]?.interest ?? "General"
    ),
    subInterest: normalizeTopicValue(
      question.subInterest,
      normalizedQuestions[index]?.subInterest ?? "General"
    ),
    text: question.text,
    options: question.options,
    answer: question.answer,
  }));

  onProgress?.({
    stage: "complete",
    message: "Questions ready!",
    percent: 100,
  });

  const outputQuestions = finalizedQuestions.slice(0, questionCount);

  structuredLog({
    event: "anthropic_cost_summary",
    status: "ok",
    roomCode,
    runId,
    model: MODEL,
    callCount: totals.callCount,
    inputTokens: totals.inputTokens,
    outputTokens: totals.outputTokens,
    totalUsd: roundUsd(totals.totalUsd),
    requestedQuestionCount: questionCount,
    generatedQuestionCount: outputQuestions.length,
  });

  return outputQuestions;
  } catch (error) {
    structuredLog(
      {
        event: "anthropic_cost_summary",
        status: "failed",
        roomCode,
        runId,
        model: MODEL,
        callCount: totals.callCount,
        inputTokens: totals.inputTokens,
        outputTokens: totals.outputTokens,
        totalUsd: roundUsd(totals.totalUsd),
        requestedQuestionCount: questionCount,
        error: error instanceof Error ? error.message : String(error),
      },
      "error"
    );
    throw error;
  }
}
