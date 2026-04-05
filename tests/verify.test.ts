import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { runTestFile } from '../src/verify/runner.js';

const FIXTURES_DIR = join(__dirname, '__verify_fixtures__');

beforeAll(() => {
  mkdirSync(FIXTURES_DIR, { recursive: true });

  // Create a minimal package.json so vitest can find its config
  writeFileSync(
    join(FIXTURES_DIR, 'package.json'),
    JSON.stringify({ type: 'module' }),
  );
});

afterAll(() => {
  rmSync(FIXTURES_DIR, { recursive: true, force: true });
});

describe('runTestFile', () => {
  it('detects passing tests', () => {
    const testFile = join(FIXTURES_DIR, 'pass.test.mjs');
    writeFileSync(
      testFile,
      `import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
describe('math', () => {
  it('adds', () => { assert.strictEqual(1 + 1, 2); });
});`,
    );

    const result = runTestFile(testFile, 'node', FIXTURES_DIR);
    expect(result.passed).toBe(true);
  });

  it('detects failing tests', () => {
    const testFile = join(FIXTURES_DIR, 'fail.test.mjs');
    writeFileSync(
      testFile,
      `import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
describe('math', () => {
  it('fails', () => { assert.strictEqual(1 + 1, 3); });
});`,
    );

    const result = runTestFile(testFile, 'node', FIXTURES_DIR);
    expect(result.passed).toBe(false);
  });

  it('handles syntax errors gracefully', () => {
    const testFile = join(FIXTURES_DIR, 'syntax.test.mjs');
    writeFileSync(testFile, 'this is not valid code }{}{}{');

    const result = runTestFile(testFile, 'node', FIXTURES_DIR);
    expect(result.passed).toBe(false);
  });
});
