import type { TestFramework } from '../types.js';

export interface FrameworkInfo {
  name: TestFramework;
  imports: string;
  runCommand: string;
  filePattern: string;
}

const FRAMEWORKS: Record<TestFramework, FrameworkInfo> = {
  vitest: {
    name: 'vitest',
    imports: "import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';",
    runCommand: 'npx vitest run',
    filePattern: '**/*.test.{ts,tsx,js,jsx}',
  },
  jest: {
    name: 'jest',
    imports: '// Jest globals available',
    runCommand: 'npx jest',
    filePattern: '**/*.test.{ts,tsx,js,jsx}',
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

  // Check scripts
  const scripts = packageJson['scripts'] as Record<string, string> | undefined;
  if (scripts) {
    const testScript = scripts['test'] ?? '';
    if (testScript.includes('vitest')) return 'vitest';
    if (testScript.includes('jest')) return 'jest';
  }

  return 'vitest'; // default
}
