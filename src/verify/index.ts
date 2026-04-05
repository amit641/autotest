import { readFileSync, writeFileSync } from 'node:fs';
import pc from 'picocolors';
import { runTestFile } from './runner.js';
import { fixFailingTests } from './fixer.js';
import { parseTestOutput } from '../writer/index.js';
import type { AutotestConfig } from '../types.js';

export { runTestFile, type TestRunResult, type TestFailure } from './runner.js';
export { fixFailingTests } from './fixer.js';

export interface VerifyResult {
  passed: boolean;
  iterations: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  finalTestCode: string;
}

/**
 * Verify & auto-fix loop:
 * 1. Run the generated tests
 * 2. If failures, send them to the LLM for fixing
 * 3. Write the fixed tests
 * 4. Repeat until all pass or maxIterations reached
 */
export async function verifyAndFix(
  sourceFile: string,
  testFile: string,
  config: AutotestConfig,
  options?: {
    maxIterations?: number;
    onChunk?: (text: string) => void;
    onStatus?: (msg: string) => void;
  },
): Promise<VerifyResult> {
  const maxIterations = options?.maxIterations ?? 3;
  const log = options?.onStatus ?? (() => {});
  const sourceCode = readFileSync(sourceFile, 'utf-8');

  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    log(`\n${pc.cyan('▶')} Verify iteration ${iteration}/${maxIterations}...`);

    const result = runTestFile(testFile, config.framework);

    if (result.passed) {
      log(`${pc.green('✔')} All ${result.totalTests} tests pass!`);
      return {
        passed: true,
        iterations: iteration,
        totalTests: result.totalTests,
        passedTests: result.passedTests,
        failedTests: 0,
        finalTestCode: readFileSync(testFile, 'utf-8'),
      };
    }

    log(
      `${pc.yellow('⚠')} ${result.failedTests}/${result.totalTests} tests failed` +
        (iteration < maxIterations ? ' — sending to LLM for auto-fix...' : ''),
    );

    if (iteration >= maxIterations) {
      return {
        passed: false,
        iterations: iteration,
        totalTests: result.totalTests,
        passedTests: result.passedTests,
        failedTests: result.failedTests,
        finalTestCode: readFileSync(testFile, 'utf-8'),
      };
    }

    const currentTestCode = readFileSync(testFile, 'utf-8');

    if (options?.onChunk) options.onChunk('\n');
    const fixedRaw = await fixFailingTests(
      sourceCode,
      currentTestCode,
      result.failures,
      config,
      options?.onChunk,
    );
    if (options?.onChunk) options.onChunk('\n');

    const parsed = parseTestOutput(fixedRaw, sourceFile, config);
    writeFileSync(testFile, parsed.testCode + '\n', 'utf-8');
    log(`${pc.dim('  Wrote fixed tests to')} ${testFile}`);
  }

  // Should not reach here
  return {
    passed: false,
    iterations: maxIterations,
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    finalTestCode: readFileSync(testFile, 'utf-8'),
  };
}
