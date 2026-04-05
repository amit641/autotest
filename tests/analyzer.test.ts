import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { analyzeFile } from '../src/analyzer/index.js';

const FIXTURES_DIR = join(__dirname, '__fixtures__');

beforeAll(() => {
  mkdirSync(FIXTURES_DIR, { recursive: true });
});

afterAll(() => {
  rmSync(FIXTURES_DIR, { recursive: true, force: true });
});

function writeFixture(name: string, content: string): string {
  const path = join(FIXTURES_DIR, name);
  writeFileSync(path, content, 'utf-8');
  return path;
}

describe('analyzeFile', () => {
  it('extracts exported functions', () => {
    const file = writeFixture(
      'funcs.ts',
      `
export function add(a: number, b: number): number {
  return a + b;
}

export function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
    `,
    );

    const result = analyzeFile(file);
    expect(result.exports).toHaveLength(2);
    expect(result.exports[0]!.name).toBe('add');
    expect(result.exports[0]!.kind).toBe('function');
    expect(result.exports[0]!.parameters).toHaveLength(2);
    expect(result.exports[0]!.parameters![0]!.name).toBe('a');
    expect(result.exports[0]!.parameters![0]!.type).toBe('number');
    expect(result.exports[0]!.returnType).toBe('number');
  });

  it('extracts async functions', () => {
    const file = writeFixture(
      'async.ts',
      `
export async function fetchData(url: string): Promise<string> {
  return '';
}
    `,
    );

    const result = analyzeFile(file);
    expect(result.exports[0]!.isAsync).toBe(true);
  });

  it('extracts arrow functions', () => {
    const file = writeFixture(
      'arrows.ts',
      `
export const multiply = (a: number, b: number): number => a * b;
    `,
    );

    const result = analyzeFile(file);
    expect(result.exports[0]!.name).toBe('multiply');
    expect(result.exports[0]!.kind).toBe('arrow-function');
    expect(result.exports[0]!.parameters).toHaveLength(2);
  });

  it('extracts classes', () => {
    const file = writeFixture(
      'class.ts',
      `
export class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }
}
    `,
    );

    const result = analyzeFile(file);
    expect(result.exports[0]!.name).toBe('Calculator');
    expect(result.exports[0]!.kind).toBe('class');
  });

  it('extracts interfaces', () => {
    const file = writeFixture(
      'iface.ts',
      `
export interface User {
  id: string;
  name: string;
}
    `,
    );

    const result = analyzeFile(file);
    expect(result.exports[0]!.name).toBe('User');
    expect(result.exports[0]!.kind).toBe('interface');
  });

  it('extracts enums', () => {
    const file = writeFixture(
      'enums.ts',
      `
export enum Color {
  Red = 'red',
  Blue = 'blue',
}
    `,
    );

    const result = analyzeFile(file);
    expect(result.exports[0]!.name).toBe('Color');
    expect(result.exports[0]!.kind).toBe('enum');
  });

  it('extracts imports', () => {
    const file = writeFixture(
      'imports.ts',
      `
import { readFileSync } from 'node:fs';
import { helper } from './utils';
import type { Config } from '../types';

export function read(): string {
  return readFileSync('test', 'utf-8');
}
    `,
    );

    const result = analyzeFile(file);
    expect(result.imports).toHaveLength(3);
    expect(result.imports[0]!.source).toBe('node:fs');
    expect(result.imports[0]!.isRelative).toBe(false);
    expect(result.imports[1]!.source).toBe('./utils');
    expect(result.imports[1]!.isRelative).toBe(true);
    expect(result.dependencies).toContain('node:fs');
    expect(result.dependencies).not.toContain('./utils');
  });

  it('extracts JSDoc comments', () => {
    const file = writeFixture(
      'jsdoc.ts',
      `
/** Adds two numbers together. */
export function add(a: number, b: number): number {
  return a + b;
}
    `,
    );

    const result = analyzeFile(file);
    expect(result.exports[0]!.jsDoc).toContain('Adds two numbers together');
  });

  it('detects file language', () => {
    const tsFile = writeFixture('lang.ts', 'export const x = 1;');
    expect(analyzeFile(tsFile).language).toBe('typescript');

    const jsFile = writeFixture('lang.js', 'export const x = 1;');
    expect(analyzeFile(jsFile).language).toBe('javascript');
  });

  it('handles optional parameters', () => {
    const file = writeFixture(
      'optional.ts',
      `
export function greet(name: string, greeting?: string): string {
  return \`\${greeting ?? 'Hello'}, \${name}\`;
}
    `,
    );

    const result = analyzeFile(file);
    expect(result.exports[0]!.parameters![1]!.optional).toBe(true);
  });

  it('handles default parameters', () => {
    const file = writeFixture(
      'defaults.ts',
      `
export function paginate(page: number = 1, size: number = 10): void {}
    `,
    );

    const result = analyzeFile(file);
    expect(result.exports[0]!.parameters![0]!.defaultValue).toBe('1');
    expect(result.exports[0]!.parameters![1]!.defaultValue).toBe('10');
  });

  it('handles exported variables', () => {
    const file = writeFixture(
      'vars.ts',
      `
export const MAX_SIZE = 100;
export const VERSION = '1.0.0';
    `,
    );

    const result = analyzeFile(file);
    expect(result.exports).toHaveLength(2);
    expect(result.exports[0]!.kind).toBe('variable');
    expect(result.exports[1]!.kind).toBe('variable');
  });

  it('handles default exports', () => {
    const file = writeFixture(
      'default.ts',
      `
export default function main(): void {}
    `,
    );

    const result = analyzeFile(file);
    expect(result.exports[0]!.isDefault).toBe(true);
  });
});
