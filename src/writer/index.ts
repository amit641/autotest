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
  const code = extractCodeFromFences(raw);

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

/**
 * Strip surrounding markdown code fences from LLM output, while leaving
 * fences that appear *inside* string literals or template literals alone.
 *
 * Strategy: walk the text line by line and only treat a line as a fence
 * boundary when it begins (after optional whitespace) with three or more
 * backticks. This is far more robust than `indexOf('```')`, which slices
 * through any test that contains a triple-backtick string literal.
 */
export function extractCodeFromFences(raw: string): string {
  const text = raw.trim();
  if (!text) return '';

  const lines = text.split('\n');
  const fenceRe = /^[ \t]*(`{3,}|~{3,})/;

  let openIdx = -1;
  let openMarker = '';
  for (let i = 0; i < lines.length; i++) {
    const m = fenceRe.exec(lines[i]!);
    if (m) {
      openIdx = i;
      openMarker = m[1]!;
      break;
    }
  }

  if (openIdx === -1) {
    return text;
  }

  // Find the matching closing fence (same marker length & character).
  // Walk from the end so we tolerate intermediate fences inside the body.
  let closeIdx = -1;
  const closeRe = new RegExp(`^[ \\t]*${openMarker[0] === '`' ? '`' : '~'}{${openMarker.length},}\\s*$`);
  for (let i = lines.length - 1; i > openIdx; i--) {
    if (closeRe.test(lines[i]!)) {
      closeIdx = i;
      break;
    }
  }

  if (closeIdx === -1) {
    return lines.slice(openIdx + 1).join('\n').trim();
  }

  return lines.slice(openIdx + 1, closeIdx).join('\n').trim();
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
