import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { parseLcov, getUncoveredFiles } from '../src/coverage/index.js';

const FIXTURES_DIR = join(__dirname, '__coverage_fixtures__');

beforeAll(() => {
  mkdirSync(FIXTURES_DIR, { recursive: true });
});

afterAll(() => {
  rmSync(FIXTURES_DIR, { recursive: true, force: true });
});

describe('parseLcov', () => {
  it('parses basic lcov data', () => {
    const lcovFile = join(FIXTURES_DIR, 'lcov.info');
    writeFileSync(
      lcovFile,
      `SF:${join(FIXTURES_DIR, 'utils.ts')}
DA:1,1
DA:2,1
DA:3,0
DA:4,0
DA:5,1
end_of_record
`,
    );

    const result = parseLcov(lcovFile, FIXTURES_DIR);
    expect(result.files).toHaveLength(1);
    expect(result.files[0]!.totalLines).toBe(5);
    expect(result.files[0]!.coveredLines).toBe(3);
    expect(result.files[0]!.lineRate).toBeCloseTo(0.6);
    expect(result.files[0]!.uncoveredLines).toEqual([3, 4]);
  });

  it('parses multiple files', () => {
    const lcovFile = join(FIXTURES_DIR, 'multi.info');
    writeFileSync(
      lcovFile,
      `SF:${join(FIXTURES_DIR, 'a.ts')}
DA:1,1
DA:2,1
end_of_record
SF:${join(FIXTURES_DIR, 'b.ts')}
DA:1,0
DA:2,0
end_of_record
`,
    );

    const result = parseLcov(lcovFile, FIXTURES_DIR);
    expect(result.files).toHaveLength(2);
    expect(result.totalLines).toBe(4);
    expect(result.coveredLines).toBe(2);
    expect(result.overallRate).toBeCloseTo(0.5);
  });
});

describe('getUncoveredFiles', () => {
  it('returns files below target coverage', () => {
    const coverage = {
      files: [
        { filePath: '/a.ts', relativePath: 'a.ts', lineRate: 0.9, branchRate: 0, uncoveredLines: [], totalLines: 10, coveredLines: 9, hasTests: true },
        { filePath: '/b.ts', relativePath: 'b.ts', lineRate: 0.3, branchRate: 0, uncoveredLines: [1, 2, 3], totalLines: 10, coveredLines: 3, hasTests: false },
        { filePath: '/c.ts', relativePath: 'c.ts', lineRate: 0.6, branchRate: 0, uncoveredLines: [1], totalLines: 10, coveredLines: 6, hasTests: true },
      ],
      totalLines: 30,
      coveredLines: 18,
      overallRate: 0.6,
    };

    const result = getUncoveredFiles(coverage, 0.8);
    expect(result).toHaveLength(2);
    expect(result[0]!.relativePath).toBe('b.ts'); // lowest first
    expect(result[1]!.relativePath).toBe('c.ts');
  });

  it('excludes test files', () => {
    const coverage = {
      files: [
        { filePath: '/a.test.ts', relativePath: 'a.test.ts', lineRate: 0.1, branchRate: 0, uncoveredLines: [], totalLines: 10, coveredLines: 1, hasTests: false },
      ],
      totalLines: 10,
      coveredLines: 1,
      overallRate: 0.1,
    };

    const result = getUncoveredFiles(coverage, 0.8);
    expect(result).toHaveLength(0);
  });
});
