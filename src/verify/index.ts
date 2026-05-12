import { readFileSync, writeFileSync } from 'node:fs';
import pc from 'picocolors';
import { runTestFile } from './runner.js';
import { fixFailingTests } from './fixer.js';
import { parseTestOutput } from '../writer/index.js';
import type { AutotestConfig } from '../types.js';

export {
  runTestFile,
  parseTestOutput as parseRunnerOutput,
  extractFailures,
  extractCounts,
  FrameworkNotInstalledError,
  type TestRunResult,
  type TestFailure,
} from './runner.js';
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
 * 3. Write the fixed tests, but always preserve the best version seen so far
 * 4. Repeat until all pass or maxIterations reached
 *
 * Never regresses: if iteration N+1 has more failures than iteration N, we
 * roll the test file back to N's version before exiting. This protects the
 * caller from losing partial progress when the model oscillates.
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

  // Track the "best" version observed across iterations so we never end up
  // worse than where we started.
  let best: { code: string; failedTests: number; passedTests: number; totalTests: number } | null = null;
  let lastSignature = '';

  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    log(`\n${pc.cyan('▶')} Verify iteration ${iteration}/${maxIterations}...`);

    const result = runTestFile(testFile, config.framework);
    const currentCode = readFileSync(testFile, 'utf-8');

    if (result.passed) {
      log(`${pc.green('✔')} All ${result.totalTests} tests pass!`);
      return {
        passed: true,
        iterations: iteration,
        totalTests: result.totalTests,
        passedTests: result.passedTests,
        failedTests: 0,
        finalTestCode: currentCode,
      };
    }

    // Update best-so-far if this iteration is strictly better.
    if (!best || result.failedTests < best.failedTests) {
      best = {
        code: currentCode,
        failedTests: result.failedTests,
        passedTests: result.passedTests,
        totalTests: result.totalTests,
      };
    } else if (result.failedTests > best.failedTests) {
      log(
        `${pc.dim('  Iteration regressed (')}${result.failedTests}${pc.dim(' > ')}${best.failedTests}${pc.dim(' failures) — rolling back to best version.')}`,
      );
      writeFileSync(testFile, best.code, 'utf-8');
    }

    log(
      `${pc.yellow('⚠')} ${result.failedTests}/${result.totalTests} tests failed` +
        (iteration < maxIterations ? ' — sending to LLM for auto-fix...' : ''),
    );

    if (iteration >= maxIterations) break;

    // Detect oscillation: if the failure signature hasn't changed since
    // last iteration, the model is stuck. Stop early instead of burning
    // another paid round trip on the same broken state.
    const signature = failureSignature(result.failures);
    if (signature && signature === lastSignature) {
      log(`${pc.yellow('⚠')} Same failures as previous iteration — stopping early to avoid an oscillation loop.`);
      break;
    }
    lastSignature = signature;

    if (options?.onChunk) options.onChunk('\n');
    const fixedRaw = await fixFailingTests(
      sourceCode,
      currentCode,
      result.failures,
      config,
      options?.onChunk,
    );
    if (options?.onChunk) options.onChunk('\n');

    const parsed = parseTestOutput(fixedRaw, sourceFile, config);
    writeFileSync(testFile, parsed.testCode + '\n', 'utf-8');
    log(`${pc.dim('  Wrote fixed tests to')} ${testFile}`);
  }

  // Loop exited without all-pass — restore the best version we ever saw.
  if (best) {
    writeFileSync(testFile, best.code, 'utf-8');
    return {
      passed: false,
      iterations: maxIterations,
      totalTests: best.totalTests,
      passedTests: best.passedTests,
      failedTests: best.failedTests,
      finalTestCode: best.code,
    };
  }

  return {
    passed: false,
    iterations: maxIterations,
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    finalTestCode: readFileSync(testFile, 'utf-8'),
  };
}

function failureSignature(failures: { testName: string; error: string }[]): string {
  return failures
    .map((f) => `${f.testName}::${f.error.slice(0, 80)}`)
    .sort()
    .join('|');
}
