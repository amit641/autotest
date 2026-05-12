import { describe, it, expect } from 'vitest';
import { parseTestOutput, getTestFilePath } from '../src/writer/index.js';
import { DEFAULT_CONFIG } from '../src/types.js';

describe('parseTestOutput', () => {
  it('strips markdown code fences', () => {
    const raw = '```typescript\nconst x = 1;\n```';
    const result = parseTestOutput(raw, '/src/utils.ts', DEFAULT_CONFIG);
    expect(result.testCode).toBe('const x = 1;');
  });

  it('counts test cases', () => {
    const raw = `
describe('add', () => {
  it('adds two numbers', () => {});
  it('handles negatives', () => {});
  test('handles zero', () => {});
});
    `.trim();

    const result = parseTestOutput(raw, '/src/utils.ts', DEFAULT_CONFIG);
    expect(result.testCount).toBe(3);
  });

  it('extracts categories from describe blocks', () => {
    const raw = `
describe('add', () => {
  it('adds positives', () => {});
  it('adds negatives', () => {});
});
describe('subtract', () => {
  it('subtracts', () => {});
});
    `.trim();

    const result = parseTestOutput(raw, '/src/utils.ts', DEFAULT_CONFIG);
    expect(result.categories).toHaveLength(2);
    expect(result.categories[0]!.name).toBe('add');
    expect(result.categories[0]!.count).toBe(2);
    expect(result.categories[1]!.name).toBe('subtract');
    expect(result.categories[1]!.count).toBe(1);
  });

  it('handles raw code without fences', () => {
    const raw = 'const x = 1;';
    const result = parseTestOutput(raw, '/src/utils.ts', DEFAULT_CONFIG);
    expect(result.testCode).toBe('const x = 1;');
  });

  it('strips preamble text before code fences', () => {
    const raw = 'Here are the tests:\n\n```typescript\nconst x = 1;\n```';
    const result = parseTestOutput(raw, '/src/utils.ts', DEFAULT_CONFIG);
    expect(result.testCode).toBe('const x = 1;');
  });

  it('strips preamble and postamble around fences', () => {
    const raw = 'Sure! Here you go:\n```ts\nconst a = 2;\n```\nHope that helps!';
    const result = parseTestOutput(raw, '/src/utils.ts', DEFAULT_CONFIG);
    expect(result.testCode).toBe('const a = 2;');
  });

  it('preserves triple-backtick string literals inside fenced code', () => {
    // The previous extractor used indexOf('```')/lastIndexOf('```') and
    // would slice through any test that contained a backtick string,
    // corrupting the code passed to the verify loop. The new state-machine
    // approach must keep the inner backticks intact.
    const raw = [
      '```typescript',
      "import { describe, it, expect } from 'vitest';",
      "import { renderMarkdown } from './md';",
      '',
      "describe('renderMarkdown', () => {",
      "  it('handles fenced code blocks', () => {",
      '    const input = "```js\\nconst x = 1;\\n```";',
      "    expect(renderMarkdown(input)).toContain('<code>');",
      '  });',
      '});',
      '```',
    ].join('\n');

    const result = parseTestOutput(raw, '/src/md.ts', DEFAULT_CONFIG);
    expect(result.testCode).toContain('const input = "```js');
    expect(result.testCode).toContain("expect(renderMarkdown(input)).toContain('<code>');");
    // The opening/closing fences must be gone.
    expect(result.testCode.startsWith('```')).toBe(false);
    expect(result.testCode.endsWith('```')).toBe(false);
  });

  it('handles tilde fences as well as backtick fences', () => {
    const raw = '~~~typescript\nconst y = 5;\n~~~';
    const result = parseTestOutput(raw, '/src/utils.ts', DEFAULT_CONFIG);
    expect(result.testCode).toBe('const y = 5;');
  });

  it('handles unterminated fences (LLM truncation) without losing code', () => {
    const raw = '```typescript\nconst z = 9;\n// model got cut off here';
    const result = parseTestOutput(raw, '/src/utils.ts', DEFAULT_CONFIG);
    expect(result.testCode).toContain('const z = 9;');
    expect(result.testCode).not.toContain('```');
  });
});

describe('getTestFilePath', () => {
  it('generates test file path for .ts', () => {
    const path = getTestFilePath('/src/utils.ts', DEFAULT_CONFIG);
    expect(path).toBe('/src/utils.test.ts');
  });

  it('generates test file path for .js', () => {
    const path = getTestFilePath('/src/helpers.js', DEFAULT_CONFIG);
    expect(path).toBe('/src/helpers.test.js');
  });

  it('uses outDir when specified', () => {
    const path = getTestFilePath('/src/utils.ts', {
      ...DEFAULT_CONFIG,
      outDir: '/tests',
    });
    expect(path).toBe('/tests/utils.test.ts');
  });

  it('generates test file path for .tsx', () => {
    const path = getTestFilePath('/src/Button.tsx', DEFAULT_CONFIG);
    expect(path).toBe('/src/Button.test.tsx');
  });
});
