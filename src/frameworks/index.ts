import type { TestFramework } from '../types.js';

export interface FrameworkInfo {
  name: TestFramework;
  imports: string;
  runCommand: string;
  filePattern: string;
  coverageCommand: string;
}

const FRAMEWORKS: Record<TestFramework, FrameworkInfo> = {
  vitest: {
    name: 'vitest',
    imports: "import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';",
    runCommand: 'npx vitest run',
    filePattern: '**/*.test.{ts,tsx,js,jsx}',
    coverageCommand: 'npx vitest run --coverage --reporter=lcov',
  },
  jest: {
    name: 'jest',
    imports: '// Jest globals available',
    runCommand: 'npx jest',
    filePattern: '**/*.test.{ts,tsx,js,jsx}',
    coverageCommand: 'npx jest --coverage --coverageReporters=lcov',
  },
  mocha: {
    name: 'mocha',
    imports: "import { describe, it, before, after, beforeEach, afterEach } from 'mocha';\nimport { expect } from 'chai';",
    runCommand: 'npx mocha',
    filePattern: '**/*.test.{ts,tsx,js,jsx}',
    coverageCommand: 'npx c8 mocha',
  },
  node: {
    name: 'node',
    imports: "import { describe, it, before, after, beforeEach, afterEach } from 'node:test';\nimport assert from 'node:assert/strict';",
    runCommand: 'node --test',
    filePattern: '**/*.test.{ts,tsx,js,jsx}',
    coverageCommand: 'node --test --experimental-test-coverage',
  },
};

export function getFrameworkInfo(framework: TestFramework): FrameworkInfo {
  return FRAMEWORKS[framework];
}

/**
 * Detect which test framework the project uses by checking package.json.
 */
export function detectFramework(packageJson: Record<string, unknown>): TestFramework {
  const deps = {
    ...(packageJson['devDependencies'] as Record<string, string> | undefined),
    ...(packageJson['dependencies'] as Record<string, string> | undefined),
  };

  if (deps['vitest']) return 'vitest';
  if (deps['jest'] || deps['@jest/core']) return 'jest';
  if (deps['mocha']) return 'mocha';

  // Check scripts
  const scripts = packageJson['scripts'] as Record<string, string> | undefined;
  if (scripts) {
    const testScript = scripts['test'] ?? '';
    if (testScript.includes('vitest')) return 'vitest';
    if (testScript.includes('jest')) return 'jest';
    if (testScript.includes('mocha')) return 'mocha';
    if (testScript.includes('node --test')) return 'node';
  }

  return 'vitest';
}
