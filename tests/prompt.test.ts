import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, buildUserPrompt } from '../src/prompt/index.js';
import { DEFAULT_CONFIG, type AnalyzedFile } from '../src/types.js';

function createAnalysis(overrides?: Partial<AnalyzedFile>): AnalyzedFile {
  return {
    filePath: '/src/utils.ts',
    fileName: 'utils.ts',
    language: 'typescript',
    sourceCode: 'export function add(a: number, b: number): number { return a + b; }',
    exports: [
      {
        name: 'add',
        kind: 'function',
        signature: 'export function add(a: number, b: number): number',
        isAsync: false,
        isDefault: false,
        lineNumber: 1,
        parameters: [
          { name: 'a', type: 'number', optional: false },
          { name: 'b', type: 'number', optional: false },
        ],
        returnType: 'number',
      },
    ],
    imports: [],
    dependencies: [],
    ...overrides,
  };
}

describe('buildSystemPrompt', () => {
  it('includes framework name', () => {
    const prompt = buildSystemPrompt({ ...DEFAULT_CONFIG, framework: 'vitest' });
    expect(prompt).toContain('vitest');
  });

  it('uses jest syntax for jest framework', () => {
    const prompt = buildSystemPrompt({ ...DEFAULT_CONFIG, framework: 'jest' });
    expect(prompt).toContain('jest');
    expect(prompt).toContain('jest.fn()');
  });

  it('includes custom instructions', () => {
    const prompt = buildSystemPrompt({
      ...DEFAULT_CONFIG,
      instructions: 'Test with French locale',
    });
    expect(prompt).toContain('Test with French locale');
  });
});

describe('buildUserPrompt', () => {
  it('includes file name', () => {
    const prompt = buildUserPrompt(createAnalysis(), DEFAULT_CONFIG);
    expect(prompt).toContain('utils.ts');
  });

  it('includes source code', () => {
    const prompt = buildUserPrompt(createAnalysis(), DEFAULT_CONFIG);
    expect(prompt).toContain('export function add');
  });

  it('lists exported symbols', () => {
    const prompt = buildUserPrompt(createAnalysis(), DEFAULT_CONFIG);
    expect(prompt).toContain('`add`');
    expect(prompt).toContain('function');
  });

  it('includes parameter info', () => {
    const prompt = buildUserPrompt(createAnalysis(), DEFAULT_CONFIG);
    expect(prompt).toContain('`a`');
    expect(prompt).toContain('number');
  });

  it('requests edge cases when enabled', () => {
    const prompt = buildUserPrompt(
      createAnalysis(),
      { ...DEFAULT_CONFIG, edgeCases: true },
    );
    expect(prompt).toContain('edge case');
  });

  it('omits edge cases when disabled', () => {
    const prompt = buildUserPrompt(
      createAnalysis(),
      { ...DEFAULT_CONFIG, edgeCases: false },
    );
    expect(prompt).not.toContain('edge case');
  });

  it('includes async hint for async functions', () => {
    const analysis = createAnalysis({
      exports: [
        {
          name: 'fetchData',
          kind: 'function',
          signature: 'export async function fetchData()',
          isAsync: true,
          isDefault: false,
          lineNumber: 1,
          parameters: [],
        },
      ],
    });

    const prompt = buildUserPrompt(analysis, DEFAULT_CONFIG);
    expect(prompt).toContain('async/await');
    expect(prompt).toContain('fetchData');
  });

  it('uses relative import path', () => {
    const prompt = buildUserPrompt(createAnalysis(), DEFAULT_CONFIG);
    expect(prompt).toContain("'./utils'");
  });

  it('handles files with only types/interfaces gracefully', () => {
    const analysis = createAnalysis({
      exports: [
        {
          name: 'User',
          kind: 'interface',
          signature: 'export interface User { id: string }',
          isAsync: false,
          isDefault: false,
          lineNumber: 1,
        },
      ],
    });

    const prompt = buildUserPrompt(analysis, DEFAULT_CONFIG);
    expect(prompt).toContain('utils.ts');
  });
});
