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

export class FrameworkNotInstalledError extends Error {
  constructor(public readonly framework: TestFramework, public readonly cwd: string) {
    super(
      `Test framework "${framework}" is not installed in ${cwd}. ` +
        `Install it (e.g. \`npm install -D ${framework}\`) or pass --framework <other>.`,
    );
    this.name = 'FrameworkNotInstalledError';
  }
}

/**
 * Run a test file and collect results.
 *
 * Preflights that the framework's CLI is actually installed in the target
 * project before invoking it — running `npx vitest` against a Jest-only
 * project would otherwise either hang on an install prompt or produce a
 * misleading failure that the auto-fix loop can't recover from.
 */
export function runTestFile(
  testFile: string,
  framework: TestFramework,
  cwd?: string,
): TestRunResult {
  const resolvedCwd = cwd ?? findProjectRoot(testFile);

  if (framework !== 'node' && !isFrameworkInstalled(framework, resolvedCwd)) {
    throw new FrameworkNotInstalledError(framework, resolvedCwd);
  }

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

function isFrameworkInstalled(framework: TestFramework, cwd: string): boolean {
  // Walk up from cwd looking for node_modules/<framework>.
  let dir = cwd;
  for (let i = 0; i < 10; i++) {
    if (existsSync(resolve(dir, 'node_modules', framework))) return true;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return false;
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

export function parseTestOutput(
  output: string,
  framework: TestFramework,
  exitedClean: boolean,
): TestRunResult {
  const failures = extractFailures(output, framework);
  const counts = extractCounts(output, framework);

  // The exit code is the only authoritative signal. We never upgrade a
  // non-zero exit to "passed" based on regex matches — too many ways the
  // parser can miss real failures (color codes, custom reporters, hangs).
  // If the runner exited cleanly, we still expose any spurious "failure"
  // strings the parser may have collected, but mark the run as passed.
  const passed = exitedClean;

  return {
    passed,
    output,
    failures: passed ? [] : failures,
    totalTests: counts.total,
    passedTests: counts.passed,
    failedTests: counts.failed,
  };
}

/** ANSI escape sequences confuse line-anchored regexes. */
function stripAnsi(s: string): string {
  // Standard CSI sequence range — covers colors, cursor moves, etc.
  return s.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
}

export function extractFailures(rawOutput: string, _framework: TestFramework): TestFailure[] {
  // Append a sentinel so the last failure block has something to terminate
  // against. JavaScript regex has no end-of-input anchor that plays nicely
  // with the `m` flag, so we synthesize one.
  const SENTINEL = '\n___AUTOTEST_END___\n';
  const output = stripAnsi(rawOutput) + SENTINEL;
  const raw: TestFailure[] = [];

  // Per-test failure markers across the major reporters:
  //   vitest:  FAIL <path> > <suite> > <test>  /  ×|✕|✗|✖ <name>
  //   jest:    FAIL <path>  +  ● <suite> › <test>
  //   mocha:   N) <name>  (handled below)
  const failPattern = /^[ \t]*(?:FAIL|×|✕|✗|✖|●)\s+(.+?)$([\s\S]*?)(?=^[ \t]*(?:FAIL|×|✕|✗|✖|●)\s|^\s*(?:Tests|Test Files|Test Suites)\s|^___AUTOTEST_END___$)/gm;
  let match;

  while ((match = failPattern.exec(output)) !== null) {
    const testName = match[1]?.trim() ?? 'unknown';
    const errorBlock = match[2]?.trim() ?? '';

    const expectedMatch = errorBlock.match(/^[ \t]*Expected:?\s*(.+)$/m);
    const receivedMatch = errorBlock.match(/^[ \t]*Received:?\s*(.+)$/m);

    raw.push({
      testName,
      error: errorBlock.slice(0, 500),
      expected: expectedMatch?.[1]?.trim(),
      received: receivedMatch?.[1]?.trim(),
    });
  }

  // Reporters emit several markers for the same logical failure: a brief
  // summary line, a file-level "FAIL <path>" header, and a detailed block.
  // Score them, drop the diagnostically-empty ones, and dedupe by name.
  const failures = consolidateFailures(raw);

  // Fallback: look for AssertionError / Error lines (line-anchored).
  if (failures.length === 0 && /\bFAIL\b/.test(output)) {
    const errorLines = output.match(/^.*(?:AssertionError|TypeError|ReferenceError|Error):.*$/gm);
    if (errorLines) {
      for (const line of errorLines.slice(0, 10)) {
        failures.push({ testName: 'unknown', error: line.trim() });
      }
    }
  }

  // Fallback: syntax/compilation errors.
  if (failures.length === 0) {
    const syntaxErr = output.match(/^.*(?:SyntaxError|ERROR):\s*(.+)$/m);
    if (syntaxErr) {
      failures.push({ testName: 'compilation', error: syntaxErr[0]!.trim() });
    }
  }

  return failures;
}

/**
 * Normalize and split a test name into segments separated by `>`/`›`.
 * "tests/utils.test.ts > utils > add returns sum (3 ms)" becomes
 * ["tests/utils.test.ts", "utils", "add returns sum"].
 */
function nameSegments(name: string): string[] {
  return name
    .replace(/[›]/g, '>')
    .replace(/\s*\(\d+\s*ms\)\s*$/, '')
    .split('>')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function lastSegment(name: string): string {
  const segs = nameSegments(name);
  return segs[segs.length - 1] ?? '';
}

function failureScore(f: TestFailure): number {
  let score = f.error.length;
  if (f.expected) score += 500;
  if (f.received) score += 500;
  return score;
}

/**
 * Dedupe by the *last* path segment of the test name (the actual leaf
 * test description). This collapses:
 *   - vitest detail: "FAIL  tests/utils.test.ts > utils > add returns sum"
 *   - vitest summary: "× utils > add returns sum"
 *   - jest summary: "× add returns sum (3 ms)"
 *   - jest detail: "● utils › add returns sum"
 * into a single entry, keeping whichever copy has the richest diagnostics.
 *
 * File-level markers ("FAIL  src/foo.test.ts") have only one segment that
 * looks like a path; we still keep them as a last-resort entry but prefer
 * any per-test entry with non-empty diagnostics.
 */
function consolidateFailures(failures: TestFailure[]): TestFailure[] {
  if (failures.length === 0) return [];

  const isFileLevel = (f: TestFailure): boolean => {
    const segs = nameSegments(f.testName);
    return segs.length === 1 && /\.(test|spec)\.[tj]sx?$/.test(segs[0]!);
  };

  const detailed = failures.filter((f) => !isFileLevel(f) && f.error.length >= 5);

  // If everything was either file-level or empty, fall back to the raw set
  // so we don't swallow real failures from an unrecognised reporter.
  const pool = detailed.length > 0 ? detailed : failures;

  const byKey = new Map<string, TestFailure>();
  for (const f of pool) {
    const key = lastSegment(f.testName) || f.testName.toLowerCase();
    const existing = byKey.get(key);
    if (!existing || failureScore(f) > failureScore(existing)) {
      byKey.set(key, f);
    }
  }
  return Array.from(byKey.values());
}

export function extractCounts(
  rawOutput: string,
  _framework: TestFramework,
): { total: number; passed: number; failed: number } {
  const output = stripAnsi(rawOutput);

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

  // Mocha spec: "  N passing" / "  N failing" / "  N pending"
  const mochaPass = output.match(/^\s*(\d+)\s+passing/m);
  const mochaFail = output.match(/^\s*(\d+)\s+failing/m);
  if (mochaPass || mochaFail) {
    const passed = parseInt(mochaPass?.[1] ?? '0', 10);
    const failed = parseInt(mochaFail?.[1] ?? '0', 10);
    return { total: passed + failed, passed, failed };
  }

  // node:test TAP: "# pass N", "# fail N", "# tests N"
  const tapTotal = output.match(/^#\s*tests\s+(\d+)/m);
  const tapPass = output.match(/^#\s*pass\s+(\d+)/m);
  const tapFail = output.match(/^#\s*fail\s+(\d+)/m);
  if (tapTotal || tapPass || tapFail) {
    const passed = parseInt(tapPass?.[1] ?? '0', 10);
    const failed = parseInt(tapFail?.[1] ?? '0', 10);
    const total = parseInt(tapTotal?.[1] ?? String(passed + failed), 10);
    return { total, passed, failed };
  }

  // Vitest file-level summary as last resort: "Test Files  1 passed (1)"
  const filesPass = output.match(/Test Files\s+(?:(\d+)\s+failed\s*\|?\s*)?(\d+)\s+passed\s*\((\d+)\)/);
  if (filesPass) {
    const failed = parseInt(filesPass[1] ?? '0', 10);
    const passed = parseInt(filesPass[2]!, 10);
    const total = parseInt(filesPass[3]!, 10);
    return { total, passed, failed };
  }

  // We deliberately do NOT fall back to counting check/cross glyphs — they
  // appear in arbitrary console output (test descriptions, source dumps)
  // and silently corrupt counts. Better to report zero than to lie.
  return { total: 0, passed: 0, failed: 0 };
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
