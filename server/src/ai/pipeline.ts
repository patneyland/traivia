import { z } from "zod";
import type { Question, GenerationStage } from "@trivia/shared";
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
      text: z.string(),
      answer: z.string(),
    })
  ),
});

const DistractorSchema = z.object({
  questions: z.array(
    z.object({
      text: z.string(),
      options: z.array(z.string()).length(4),
      answer: z.string(),
    })
  ),
});

const MODEL = "claude-sonnet-4-20250514";

type ProgressFn = (payload: { stage: GenerationStage; message: string; percent: number }) => void;

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

async function callClaude(prompt: string, allowSearch = false): Promise<string> {
  const client = createAnthropicClient();
  console.log("[pipeline] calling Claude, allowSearch =", allowSearch);
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    temperature: 0.4,
    tools: allowSearch ? [{ type: "web_search_20250305", name: "web_search", max_uses: 5 } as any] : undefined,
    messages: [{ role: "user", content: prompt }],
  });

  console.log("[pipeline] response stop_reason:", response.stop_reason, "content types:", response.content.map((b) => b.type));

  const text = response.content
    .filter((item): item is { type: "text"; text: string } => item.type === "text")
    .map((item) => item.text)
    .join("\n");

  if (!text) {
    console.error("[pipeline] WARNING: no text blocks in response. Full content:", JSON.stringify(response.content, null, 2));
  }

  return text;
}

export async function generateQuestions(
  interests: string[],
  questionCount: number,
  onProgress?: ProgressFn
): Promise<Question[]> {
  onProgress?.({
    stage: "topic_expansion",
    message: "Expanding topics...",
    percent: 10,
  });

  const topicPrompt = interpolate(PROMPTS.topicExpansion, {
    INTERESTS: JSON.stringify(interests, null, 2),
    QUESTION_COUNT: String(questionCount),
  });
  const topicRaw = await callClaude(topicPrompt);
  const topicJson = TopicExpansionSchema.parse(
    JSON.parse(extractJson(topicRaw))
  );
  const subtopics = topicJson.topics.flatMap((topic) => topic.subtopics);

  onProgress?.({
    stage: "fact_extraction",
    message: "Researching facts...",
    percent: 35,
  });

  const factPrompt = interpolate(PROMPTS.factExtraction, {
    SUBTOPICS: JSON.stringify(subtopics, null, 2),
  });
  const factRaw = await callClaude(factPrompt, true);
  const factJson = FactExtractionSchema.parse(JSON.parse(extractJson(factRaw)));

  onProgress?.({
    stage: "question_formulation",
    message: "Formulating questions...",
    percent: 65,
  });

  const questionPrompt = interpolate(PROMPTS.questionFormulation, {
    FACTS: JSON.stringify(factJson.facts, null, 2),
    QUESTION_COUNT: String(questionCount),
  });
  const questionRaw = await callClaude(questionPrompt);
  const questionJson = QuestionFormulationSchema.parse(
    JSON.parse(extractJson(questionRaw))
  );

  onProgress?.({
    stage: "distractor_generation",
    message: "Generating answer options...",
    percent: 85,
  });

  const distractorPrompt = interpolate(PROMPTS.distractorGeneration, {
    QUESTIONS: JSON.stringify(questionJson.questions, null, 2),
  });
  const distractorRaw = await callClaude(distractorPrompt);
  const distractorJson = DistractorSchema.parse(
    JSON.parse(extractJson(distractorRaw))
  );

  onProgress?.({
    stage: "complete",
    message: "Questions ready!",
    percent: 100,
  });

  return distractorJson.questions.slice(0, questionCount);
}
