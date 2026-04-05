import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import type { TestFramework } from '../types.js';

export interface TestRunResult {
  passed: boolean;
  output: string;
  failures: TestFailure[];
  totalTests: number;
  passedTests: number;
  failedTests: number;
}

export interface TestFailure {
  testName: string;
  error: string;
  expected?: string;
  received?: string;
}

/**
 * Run a test file and collect results.
 */
export function runTestFile(
  testFile: string,
  framework: TestFramework,
  cwd?: string,
): TestRunResult {
  const resolvedCwd = cwd ?? findProjectRoot(testFile);
  const cmd = buildRunCommand(framework, testFile);

  try {
    const output = execSync(cmd, {
      cwd: resolvedCwd,
      encoding: 'utf-8',
      timeout: 60_000,
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Exit code 0 means all tests passed
    return parseTestOutput(output, framework, true);
  } catch (err: unknown) {
    const execErr = err as { stdout?: string; stderr?: string; status?: number };
    const output = (execErr.stdout ?? '') + '\n' + (execErr.stderr ?? '');
    return parseTestOutput(output, framework, false);
  }
}

function buildRunCommand(framework: TestFramework, testFile: string): string {
  switch (framework) {
    case 'vitest':
      return `npx vitest run "${testFile}" --reporter=verbose 2>&1`;
    case 'jest':
      return `npx jest "${testFile}" --verbose --no-coverage 2>&1`;
    case 'mocha':
      return `npx mocha "${testFile}" --reporter spec 2>&1`;
    case 'node':
      return `node --test "${testFile}" 2>&1`;
  }
}

function parseTestOutput(output: string, framework: TestFramework, exitedClean: boolean): TestRunResult {
  const failures = extractFailures(output, framework);
  const counts = extractCounts(output, framework);

  // A test run passes if: exit code was 0, OR no failures found and some tests ran
  const passed = exitedClean || (failures.length === 0 && counts.total > 0);

  return {
    passed,
    output,
    failures,
    totalTests: counts.total,
    passedTests: counts.passed,
    failedTests: counts.failed,
  };
}

function extractFailures(output: string, _framework: TestFramework): TestFailure[] {
  const failures: TestFailure[] = [];

  // Universal: match FAIL lines followed by error details
  const failPattern = /(?:FAIL|×|✕|✗|✖)\s+(.+?)(?:\n|\r\n)([\s\S]*?)(?=(?:FAIL|×|✕|✗|✖)\s|\n\s*(?:Tests|Test Files|Test Suites)|\n\s*$)/gi;
  let match;

  while ((match = failPattern.exec(output)) !== null) {
    const testName = match[1]?.trim() ?? 'unknown';
    const errorBlock = match[2]?.trim() ?? '';

    const expectedMatch = errorBlock.match(/Expected:?\s*(.+)/i);
    const receivedMatch = errorBlock.match(/Received:?\s*(.+)/i);

    failures.push({
      testName,
      error: errorBlock.slice(0, 500),
      expected: expectedMatch?.[1]?.trim(),
      received: receivedMatch?.[1]?.trim(),
    });
  }

  // Fallback: look for AssertionError / Error lines
  if (failures.length === 0 && output.includes('FAIL')) {
    const errorLines = output.match(/(?:AssertionError|Error|ReferenceError|TypeError):.*$/gm);
    if (errorLines) {
      for (const line of errorLines) {
        failures.push({
          testName: 'unknown',
          error: line.trim(),
        });
      }
    }
  }

  // Fallback: syntax/compilation errors
  if (failures.length === 0) {
    const syntaxErr = output.match(/(?:SyntaxError|ERROR):\s*(.+)/);
    if (syntaxErr) {
      failures.push({
        testName: 'compilation',
        error: syntaxErr[0]!.trim(),
      });
    }
  }

  return failures;
}

function extractCounts(
  output: string,
  _framework: TestFramework,
): { total: number; passed: number; failed: number } {
  // Vitest: "Tests  5 failed | 12 passed (17)" or "Tests  1 passed (1)"
  const vitestMatch = output.match(/Tests\s+(?:(\d+)\s+failed\s*\|?\s*)?(?:(\d+)\s+passed\s*)?\((\d+)\)/);
  if (vitestMatch) {
    const failed = parseInt(vitestMatch[1] ?? '0', 10);
    const passed = parseInt(vitestMatch[2] ?? '0', 10);
    const total = parseInt(vitestMatch[3]!, 10);
    return { total, passed, failed: failed || (total - passed) };
  }

  // Vitest alternate: "N failed | M passed" without parens
  const vitestAlt = output.match(/(\d+)\s+failed\s*\|\s*(\d+)\s+passed/);
  if (vitestAlt) {
    const failed = parseInt(vitestAlt[1]!, 10);
    const passed = parseInt(vitestAlt[2]!, 10);
    return { total: failed + passed, passed, failed };
  }

  // Jest: "Tests:  2 failed, 5 passed, 7 total"
  const jestMatch = output.match(/Tests:\s+(?:(\d+)\s+failed,\s+)?(\d+)\s+passed,\s+(\d+)\s+total/);
  if (jestMatch) {
    const failed = parseInt(jestMatch[1] ?? '0', 10);
    const passed = parseInt(jestMatch[2]!, 10);
    const total = parseInt(jestMatch[3]!, 10);
    return { total, passed, failed };
  }

  // "Test Files  1 passed" / "Test Files  1 failed" (vitest file-level summary)
  const filesPass = output.match(/Test Files\s+(\d+)\s+passed/);
  const filesFail = output.match(/Test Files\s+(\d+)\s+failed/);
  if (filesPass || filesFail) {
    // Try to get individual test counts from the output
    const passMarkers = (output.match(/✓|✔|√/g) || []).length;
    const failMarkers = (output.match(/×|✕|✗|✖|❯/g) || []).length;
    if (passMarkers + failMarkers > 0) {
      return { total: passMarkers + failMarkers, passed: passMarkers, failed: failMarkers };
    }
  }

  // Count from pass/fail markers
  const passCount = (output.match(/✓|✔|√/g) || []).length;
  const failCount = (output.match(/×|✕|✗|✖/g) || []).length;

  return {
    total: passCount + failCount,
    passed: passCount,
    failed: failCount,
  };
}

function findProjectRoot(fromFile: string): string {
  let dir = dirname(resolve(fromFile));
  for (let i = 0; i < 10; i++) {
    if (existsSync(resolve(dir, 'package.json'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return dirname(resolve(fromFile));
}
