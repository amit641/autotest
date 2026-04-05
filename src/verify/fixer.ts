import { ai } from 'aiclientjs';
import type { AutotestConfig } from '../types.js';
import type { TestFailure } from './runner.js';

/**
 * Send failing tests back to the LLM for auto-fix.
 */
export async function fixFailingTests(
  sourceCode: string,
  testCode: string,
  failures: TestFailure[],
  config: AutotestConfig,
  onChunk?: (text: string) => void,
): Promise<string> {
  const systemPrompt = buildFixSystemPrompt(config);
  const userPrompt = buildFixUserPrompt(sourceCode, testCode, failures);

  if (onChunk) {
    const stream = await ai(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      {
        provider: config.provider,
        model: config.model,
        apiKey: config.apiKey,
        maxTokens: config.maxTokens,
        temperature: config.temperature,
        stream: true,
      },
    );

    let fullText = '';
    for await (const chunk of stream) {
      fullText += chunk;
      onChunk(chunk);
    }
    return fullText;
  }

  const response = await ai(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    {
      provider: config.provider,
      model: config.model,
      apiKey: config.apiKey,
      maxTokens: config.maxTokens,
      temperature: config.temperature,
    },
  );

  return response.text;
}

function buildFixSystemPrompt(config: AutotestConfig): string {
  return `You are an expert test engineer fixing failing ${config.framework} tests.

Rules:
- Output ONLY the complete, corrected test file — no explanations, no markdown fences
- Fix every failing test based on the actual error messages
- If a test expected a function to throw but it doesn't, remove or rewrite the test to match actual behavior
- If the expected value is wrong, correct it to match the actual source code behavior
- Do NOT remove passing tests
- Do NOT add new tests — only fix the broken ones
- Keep all imports and structure intact
- Read the source code carefully to understand what each function actually does`;
}

function buildFixUserPrompt(
  sourceCode: string,
  testCode: string,
  failures: TestFailure[],
): string {
  const failureDetails = failures
    .map((f, i) => {
      let detail = `${i + 1}. **${f.testName}**\n   Error: ${f.error}`;
      if (f.expected) detail += `\n   Expected: ${f.expected}`;
      if (f.received) detail += `\n   Received: ${f.received}`;
      return detail;
    })
    .join('\n\n');

  return `Fix the failing tests below. The source code is the truth — adjust the tests to match it.

## Source Code (DO NOT MODIFY)

\`\`\`
${sourceCode}
\`\`\`

## Current Test File (FIX THIS)

\`\`\`
${testCode}
\`\`\`

## Failures (${failures.length})

${failureDetails}

Output the COMPLETE fixed test file. Every test must pass.`;
}
