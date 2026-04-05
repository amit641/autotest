import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, basename, join, extname } from 'node:path';
import type { GeneratedTest, TestCategory, AutotestConfig } from '../types.js';

/**
 * Parse raw LLM output into clean test code.
 * Strips markdown fences, extracts test count, and categorizes tests.
 */
export function parseTestOutput(
  raw: string,
  sourceFile: string,
  config: AutotestConfig,
): GeneratedTest {
  let code = raw.trim();

  // Extract code from markdown fences — handles preamble text before fences
  const fenceStart = code.indexOf('```');
  if (fenceStart !== -1) {
    code = code.slice(fenceStart);
    const firstNewline = code.indexOf('\n');
    code = code.slice(firstNewline + 1);
    const lastFence = code.lastIndexOf('```');
    if (lastFence !== -1) {
      code = code.slice(0, lastFence);
    }
    code = code.trim();
  }

  // Count tests
  const itMatches = code.match(/\bit\s*\(/g) || [];
  const testMatches = code.match(/\btest\s*\(/g) || [];
  const testCount = itMatches.length + testMatches.length;

  // Categorize tests by describe blocks
  const categories = extractCategories(code);

  const testFile = getTestFilePath(sourceFile, config);

  return {
    sourceFile,
    testFile,
    testCode: code,
    testCount,
    categories,
  };
}

/**
 * Write the generated test file to disk.
 */
export function writeTestFile(
  test: GeneratedTest,
  config: AutotestConfig,
): void {
  if (existsSync(test.testFile) && !config.overwrite) {
    throw new Error(
      `Test file already exists: ${test.testFile}. Use --overwrite to replace it.`,
    );
  }

  const dir = dirname(test.testFile);
  mkdirSync(dir, { recursive: true });

  writeFileSync(test.testFile, test.testCode + '\n', 'utf-8');
}

/**
 * Determine the test file path from the source file.
 */
export function getTestFilePath(
  sourceFile: string,
  config: AutotestConfig,
): string {
  const ext = extname(sourceFile);
  const base = basename(sourceFile, ext);
  const dir = config.outDir ?? dirname(sourceFile);

  return join(dir, `${base}.test${ext}`);
}

function extractCategories(code: string): TestCategory[] {
  const categories: TestCategory[] = [];
  const describeRegex = /describe\s*\(\s*['"`]([^'"`]+)['"`]/g;

  let match;
  while ((match = describeRegex.exec(code)) !== null) {
    const name = match[1]!;
    // Count it() calls within this describe block (approximate)
    const startIdx = match.index;
    const nextDescribe = code.indexOf('describe(', startIdx + 1);
    const block = nextDescribe === -1
      ? code.slice(startIdx)
      : code.slice(startIdx, nextDescribe);

    const itCount = (block.match(/\bit\s*\(/g) || []).length +
      (block.match(/\btest\s*\(/g) || []).length;

    categories.push({ name, count: itCount });
  }

  return categories;
}
