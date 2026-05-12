import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { analyzeFile } from '../src/analyzer/index.js';
import { gatherImportContext } from '../src/analyzer/context.js';

const FIXTURES_DIR = join(__dirname, '__context_fixtures__');

beforeAll(() => {
  mkdirSync(FIXTURES_DIR, { recursive: true });
});

afterAll(() => {
  rmSync(FIXTURES_DIR, { recursive: true, force: true });
});

describe('gatherImportContext', () => {
  it('resolves relative imports and reads their content', () => {
    writeFileSync(
      join(FIXTURES_DIR, 'types.ts'),
      `export interface User { id: string; name: string; }`,
    );
    writeFileSync(
      join(FIXTURES_DIR, 'main.ts'),
      `import { User } from './types';\nexport function greet(user: User): string { return user.name; }`,
    );

    const analysis = analyzeFile(join(FIXTURES_DIR, 'main.ts'));
    const contexts = gatherImportContext(analysis);

    expect(contexts).toHaveLength(1);
    expect(contexts[0]!.importPath).toBe('./types');
    expect(contexts[0]!.content).toContain('interface User');
    expect(contexts[0]!.specifiers).toContain('User');
  });

  it('skips non-relative imports', () => {
    writeFileSync(
      join(FIXTURES_DIR, 'node-import.ts'),
      `import { readFileSync } from 'node:fs';\nexport const x = 1;`,
    );

    const analysis = analyzeFile(join(FIXTURES_DIR, 'node-import.ts'));
    const contexts = gatherImportContext(analysis);

    expect(contexts).toHaveLength(0);
  });

  it('handles missing import files gracefully', () => {
    writeFileSync(
      join(FIXTURES_DIR, 'missing.ts'),
      `import { Foo } from './nonexistent';\nexport const y = 2;`,
    );

    const analysis = analyzeFile(join(FIXTURES_DIR, 'missing.ts'));
    const contexts = gatherImportContext(analysis);

    expect(contexts).toHaveLength(0);
  });

  it('respects maxFiles limit', () => {
    writeFileSync(join(FIXTURES_DIR, 'dep1.ts'), 'export const a = 1;');
    writeFileSync(join(FIXTURES_DIR, 'dep2.ts'), 'export const b = 2;');
    writeFileSync(join(FIXTURES_DIR, 'dep3.ts'), 'export const c = 3;');
    writeFileSync(
      join(FIXTURES_DIR, 'multi.ts'),
      `import { a } from './dep1';\nimport { b } from './dep2';\nimport { c } from './dep3';\nexport const sum = a + b + c;`,
    );

    const analysis = analyzeFile(join(FIXTURES_DIR, 'multi.ts'));
    const contexts = gatherImportContext(analysis, 2);

    expect(contexts).toHaveLength(2);
  });

  it('resolves tsconfig path aliases', () => {
    // Build a mini-project layout:
    //   __ctx_alias__/
    //     tsconfig.json   ({ baseUrl: ".", paths: { "@/*": ["src/*"] } })
    //     src/
    //       lib/helpers.ts
    //       app/main.ts   (imports "@/lib/helpers")
    const projectRoot = join(FIXTURES_DIR, 'alias-project');
    const srcDir = join(projectRoot, 'src');
    const libDir = join(srcDir, 'lib');
    const appDir = join(srcDir, 'app');
    mkdirSync(libDir, { recursive: true });
    mkdirSync(appDir, { recursive: true });

    writeFileSync(
      join(projectRoot, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          baseUrl: '.',
          paths: { '@/*': ['src/*'] },
        },
      }),
    );

    writeFileSync(
      join(libDir, 'helpers.ts'),
      `export function shout(s: string): string { return s.toUpperCase(); }`,
    );

    writeFileSync(
      join(appDir, 'main.ts'),
      `import { shout } from '@/lib/helpers';\nexport function greet(name: string): string { return shout(name); }`,
    );

    const analysis = analyzeFile(join(appDir, 'main.ts'));
    const contexts = gatherImportContext(analysis);

    expect(contexts).toHaveLength(1);
    expect(contexts[0]!.importPath).toBe('@/lib/helpers');
    expect(contexts[0]!.content).toContain('export function shout');
  });

  it('still skips bare external imports when no alias matches', () => {
    writeFileSync(
      join(FIXTURES_DIR, 'with-external.ts'),
      `import { something } from 'some-external-pkg';\nexport const z = 1;`,
    );

    const analysis = analyzeFile(join(FIXTURES_DIR, 'with-external.ts'));
    const contexts = gatherImportContext(analysis);

    expect(contexts).toHaveLength(0);
  });
});
