import fs from "fs";
import path from "path";

const PROMPTS_DIR = path.resolve(__dirname, "../../../prompts");

function loadPrompt(filename: string): string {
  return fs.readFileSync(path.join(PROMPTS_DIR, filename), "utf-8");
}

export const PROMPTS = {
  topicExpansion: loadPrompt("topic-expansion.txt"),
  factExtraction: loadPrompt("fact-extraction.txt"),
  questionFormulation: loadPrompt("question-formulation.txt"),
  distractorGeneration: loadPrompt("distractor-generation.txt"),
};
