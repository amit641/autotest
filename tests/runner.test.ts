import { describe, it, expect } from 'vitest';
import {
  extractFailures,
  extractCounts,
  parseRunnerOutput,
} from '../src/verify/index.js';

// ---------------------------------------------------------------------------
// Real(istic) reporter output snapshots.
// These fixtures intentionally include the kinds of noise that broke the
// previous implementation: source dumps containing the word "FAIL", ANSI
// color codes, embedded checkmark glyphs in console.log calls, and
// triple-backtick markers in stack traces.
// ---------------------------------------------------------------------------

const VITEST_FAILING = `
 RUN  v1.6.0

 ❯ tests/utils.test.ts (2)
   × utils > add returns sum
   ✓ utils > multiply returns product

 FAIL  tests/utils.test.ts > utils > add returns sum
AssertionError: expected 3 to be 4 // Object.is equality
 ❯ tests/utils.test.ts:5:23
      3| describe('utils', () => {
      4|   it('add returns sum', () => {
      5|     expect(add(1, 2)).toBe(4);
       |                       ^
Expected: 4
Received: 3

 Test Files  1 failed (1)
      Tests  1 failed | 1 passed (2)
`;

const VITEST_PASSING = `
 RUN  v1.6.0

 ✓ tests/utils.test.ts (3)

 Test Files  1 passed (1)
      Tests  3 passed (3)
   Start at  10:00:00
`;

const JEST_FAILING = `
 FAIL  src/utils.test.ts
  utils
    × add returns sum (3 ms)
    ✓ multiply returns product

  ● utils › add returns sum

    expect(received).toBe(expected) // Object.is equality

    Expected: 4
    Received: 3

      at Object.<anonymous> (src/utils.test.ts:5:23)

Test Suites: 1 failed, 1 total
Tests:       1 failed, 1 passed, 2 total
`;

const MOCHA_FAILING = `
  utils
    ✓ multiply returns product
    1) add returns sum

  1 passing (12ms)
  1 failing

  1) utils
       add returns sum:

      AssertionError: expected 3 to equal 4
      Expected: 4
      Received: 3
      + expected - actual

      -3
      +4
`;

const NODE_TAP = `
TAP version 13
ok 1 - utils > multiply returns product
not ok 2 - utils > add returns sum
  ---
  message: "Expected 3 to equal 4"
  Expected: 4
  Received: 3
  ...
1..2
# tests 2
# pass 1
# fail 1
`;

const FAIL_TOKEN_IN_SOURCE_DUMP = `
 RUN  v1.6.0

 ✓ src/parser.test.ts (1)
   ✓ parser handles "FAIL" keyword in input

 Test Files  1 passed (1)
      Tests  1 passed (1)
`;

const ANSI_COLORED_OUTPUT =
  '\x1b[31m FAIL \x1b[0m  tests/utils.test.ts > utils > add returns sum\n' +
  'AssertionError: expected 3 to be 4\n' +
  'Expected: 4\n' +
  'Received: 3\n' +
  '\n Tests  1 failed | 0 passed (1)\n';

describe('extractFailures', () => {
  it('parses a single vitest failure with expected/received', () => {
    const failures = extractFailures(VITEST_FAILING, 'vitest');
    expect(failures).toHaveLength(1);
    expect(failures[0]!.testName).toContain('add returns sum');
    expect(failures[0]!.expected).toBe('4');
    expect(failures[0]!.received).toBe('3');
  });

  it('parses a jest failure', () => {
    const failures = extractFailures(JEST_FAILING, 'jest');
    expect(failures.length).toBeGreaterThanOrEqual(1);
    const main = failures[0]!;
    expect(main.expected).toBe('4');
    expect(main.received).toBe('3');
  });

  it('does not report failures from a clean vitest run', () => {
    const failures = extractFailures(VITEST_PASSING, 'vitest');
    expect(failures).toHaveLength(0);
  });

  it('does not match "FAIL" tokens embedded inside passing test descriptions', () => {
    // Previous regex was `(?:FAIL|×|...)\s+(...)` without line anchoring,
    // which matched the literal word "FAIL" inside the test name string.
    const failures = extractFailures(FAIL_TOKEN_IN_SOURCE_DUMP, 'vitest');
    expect(failures).toHaveLength(0);
  });

  it('survives ANSI color codes in the output', () => {
    const failures = extractFailures(ANSI_COLORED_OUTPUT, 'vitest');
    expect(failures).toHaveLength(1);
    expect(failures[0]!.expected).toBe('4');
    expect(failures[0]!.received).toBe('3');
  });
});

describe('extractCounts', () => {
  it('parses vitest pass+fail summary', () => {
    expect(extractCounts(VITEST_FAILING, 'vitest')).toEqual({
      total: 2,
      passed: 1,
      failed: 1,
    });
  });

  it('parses vitest all-passing summary', () => {
    expect(extractCounts(VITEST_PASSING, 'vitest')).toEqual({
      total: 3,
      passed: 3,
      failed: 0,
    });
  });

  it('parses jest summary', () => {
    expect(extractCounts(JEST_FAILING, 'jest')).toEqual({
      total: 2,
      passed: 1,
      failed: 1,
    });
  });

  it('parses mocha summary', () => {
    expect(extractCounts(MOCHA_FAILING, 'mocha')).toEqual({
      total: 2,
      passed: 1,
      failed: 1,
    });
  });

  it('parses node:test TAP summary', () => {
    expect(extractCounts(NODE_TAP, 'node')).toEqual({
      total: 2,
      passed: 1,
      failed: 1,
    });
  });

  it('does NOT count check/cross glyphs from arbitrary console output', () => {
    // The previous fallback counted ✓/× glyphs, which corrupted counts
    // whenever the source under test happened to print one. We now refuse
    // to guess and return zero rather than a confidently wrong number.
    const arbitrary = `
console.log("✓ migration step 1");
console.log("✓ migration step 2");
console.log("× rollback skipped");
`;
    expect(extractCounts(arbitrary, 'vitest')).toEqual({
      total: 0,
      passed: 0,
      failed: 0,
    });
  });
});

describe('parseRunnerOutput', () => {
  it('respects the exit code over heuristic parsing (clean exit = passed)', () => {
    // Even if the parser couldn't find any counts, a clean exit is the
    // authoritative signal — never report a passing run as failed.
    const result = parseRunnerOutput('some unfamiliar reporter output', 'vitest', true);
    expect(result.passed).toBe(true);
    expect(result.failures).toHaveLength(0);
  });

  it('respects the exit code over heuristic parsing (non-zero exit = failed)', () => {
    // Symmetric: a non-zero exit must be reported as failed even if our
    // regexes happened to find no failure markers.
    const result = parseRunnerOutput('reporter said nothing useful', 'vitest', false);
    expect(result.passed).toBe(false);
  });

  it('clears spurious failures when the run actually passed', () => {
    // If our regex spuriously matches inside a passing run (e.g. word
    // "FAIL" inside a stack trace from a previous run), we must not
    // expose those phantom failures to callers.
    const result = parseRunnerOutput(VITEST_PASSING + '\nFAIL old.test.ts > leftover', 'vitest', true);
    expect(result.passed).toBe(true);
    expect(result.failures).toHaveLength(0);
  });
});
