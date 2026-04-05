import { analyzeFile } from './analyzer/index.js';
import { gatherImportContext } from './analyzer/context.js';
import { buildSystemPrompt, buildUserPrompt } from './prompt/index.js';
import { generateWithLLM } from './llm/index.js';
import { parseTestOutput, writeTestFile } from './writer/index.js';
import { verifyAndFix } from './verify/index.js';
import type { AutotestConfig, AutotestResult } from './types.js';

/**
 * Main orchestrator: analyze → prompt → generate → write → (verify → fix).
 */
export async function generateTests(
  sourceFile: string,
  config: AutotestConfig,
  options?: {
    onChunk?: (text: string) => void;
    onStatus?: (msg: string) => void;
    dryRun?: boolean;
    verify?: boolean;
    maxFixIterations?: number;
  },
): Promise<AutotestResult> {
  const start = Date.now();

  // 1. Analyze
  const analysis = analyzeFile(sourceFile);

  // 2. Gather import context
  const importContexts = gatherImportContext(analysis);

  // 3. Build prompts
  const systemPrompt = buildSystemPrompt(config);
  const userPrompt = buildUserPrompt(analysis, config, importContexts);

  // 4. Generate via LLM
  const llmResult = await generateWithLLM(
    systemPrompt,
    userPrompt,
    config,
    options?.onChunk,
  );

  // 5. Parse & write
  const generatedTest = parseTestOutput(llmResult.text, sourceFile, config);

  if (!options?.dryRun) {
    writeTestFile(generatedTest, config);
  }

  const result: AutotestResult = {
    sourceFile: generatedTest.sourceFile,
    testFile: generatedTest.testFile,
    testCount: generatedTest.testCount,
    categories: generatedTest.categories,
    duration: Date.now() - start,
    tokensUsed: llmResult.tokensUsed,
  };

  // 6. Verify & auto-fix if requested
  if (options?.verify && !options?.dryRun) {
    const verifyResult = await verifyAndFix(
      sourceFile,
      generatedTest.testFile,
      config,
      {
        maxIterations: options.maxFixIterations ?? 3,
        onChunk: options.onChunk,
        onStatus: options.onStatus,
      },
    );

    result.verified = verifyResult.passed;
    result.verifyIterations = verifyResult.iterations;
    result.testCount = verifyResult.totalTests;
    result.duration = Date.now() - start;
  }

  return result;
}
