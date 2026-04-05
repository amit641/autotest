import { analyzeFile } from './analyzer/index.js';
import { buildSystemPrompt, buildUserPrompt } from './prompt/index.js';
import { generateWithLLM } from './llm/index.js';
import { parseTestOutput, writeTestFile } from './writer/index.js';
import type { AutotestConfig, AutotestResult } from './types.js';

/**
 * Main orchestrator: analyze → prompt → generate → write.
 */
export async function generateTests(
  sourceFile: string,
  config: AutotestConfig,
  options?: {
    onChunk?: (text: string) => void;
    dryRun?: boolean;
  },
): Promise<AutotestResult> {
  const start = Date.now();

  // 1. Analyze
  const analysis = analyzeFile(sourceFile);

  // 2. Build prompts
  const systemPrompt = buildSystemPrompt(config);
  const userPrompt = buildUserPrompt(analysis, config);

  // 3. Generate via LLM
  const llmResult = await generateWithLLM(
    systemPrompt,
    userPrompt,
    config,
    options?.onChunk,
  );

  // 4. Parse & write
  const generatedTest = parseTestOutput(llmResult.text, sourceFile, config);

  if (!options?.dryRun) {
    writeTestFile(generatedTest, config);
  }

  return {
    sourceFile: generatedTest.sourceFile,
    testFile: generatedTest.testFile,
    testCount: generatedTest.testCount,
    categories: generatedTest.categories,
    duration: Date.now() - start,
    tokensUsed: llmResult.tokensUsed,
  };
}
