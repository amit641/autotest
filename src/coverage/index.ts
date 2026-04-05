import { readFileSync, existsSync } from 'node:fs';
import { resolve, relative, basename } from 'node:path';

export interface CoverageData {
  files: CoverageFile[];
  totalLines: number;
  coveredLines: number;
  overallRate: number;
}

export interface CoverageFile {
  filePath: string;
  relativePath: string;
  lineRate: number;
  branchRate: number;
  uncoveredLines: number[];
  totalLines: number;
  coveredLines: number;
  hasTests: boolean;
}

/**
 * Parse LCOV format coverage data.
 */
export function parseLcov(lcovPath: string, cwd: string): CoverageData {
  const content = readFileSync(lcovPath, 'utf-8');
  const files: CoverageFile[] = [];

  let currentFile: string | null = null;
  let linesHit = 0;
  let linesFound = 0;
  let branchesHit = 0;
  let branchesFound = 0;
  const uncoveredLines: number[] = [];

  for (const line of content.split('\n')) {
    const trimmed = line.trim();

    if (trimmed.startsWith('SF:')) {
      currentFile = trimmed.slice(3);
      linesHit = 0;
      linesFound = 0;
      branchesHit = 0;
      branchesFound = 0;
      uncoveredLines.length = 0;
    } else if (trimmed.startsWith('DA:')) {
      const parts = trimmed.slice(3).split(',');
      const lineNum = parseInt(parts[0]!, 10);
      const hits = parseInt(parts[1]!, 10);
      linesFound++;
      if (hits > 0) {
        linesHit++;
      } else {
        uncoveredLines.push(lineNum);
      }
    } else if (trimmed.startsWith('BRF:')) {
      branchesFound = parseInt(trimmed.slice(4), 10);
    } else if (trimmed.startsWith('BRH:')) {
      branchesHit = parseInt(trimmed.slice(4), 10);
    } else if (trimmed === 'end_of_record' && currentFile) {
      const filePath = resolve(currentFile);
      const relPath = relative(cwd, filePath);

      // Check if test file exists
      const ext = filePath.match(/\.(ts|tsx|js|jsx)$/)?.[0] ?? '.ts';
      const base = basename(filePath, ext);
      const testFile = filePath.replace(
        new RegExp(`${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${ext.replace('.', '\\.')}$`),
        `${base}.test${ext}`,
      );

      files.push({
        filePath,
        relativePath: relPath,
        lineRate: linesFound > 0 ? linesHit / linesFound : 0,
        branchRate: branchesFound > 0 ? branchesHit / branchesFound : 0,
        uncoveredLines: [...uncoveredLines],
        totalLines: linesFound,
        coveredLines: linesHit,
        hasTests: existsSync(testFile),
      });
      currentFile = null;
    }
  }

  const totalLines = files.reduce((s, f) => s + f.totalLines, 0);
  const coveredLines = files.reduce((s, f) => s + f.coveredLines, 0);

  return {
    files,
    totalLines,
    coveredLines,
    overallRate: totalLines > 0 ? coveredLines / totalLines : 0,
  };
}

/**
 * Parse Cobertura XML coverage data.
 */
export function parseCobertura(xmlPath: string, cwd: string): CoverageData {
  const content = readFileSync(xmlPath, 'utf-8');
  const files: CoverageFile[] = [];

  // Simple XML parsing for <class> elements
  const classRegex = /<class\s[^>]*filename="([^"]+)"[^>]*line-rate="([^"]+)"[^>]*branch-rate="([^"]+)"[^>]*>/g;
  let match;

  while ((match = classRegex.exec(content)) !== null) {
    const filename = match[1]!;
    const lineRate = parseFloat(match[2]!);
    const branchRate = parseFloat(match[3]!);
    const filePath = resolve(cwd, filename);
    const relPath = relative(cwd, filePath);

    // Extract uncovered lines
    const uncoveredLines: number[] = [];
    const fileSection = content.slice(match.index, content.indexOf('</class>', match.index));
    const lineRegex = /<line\s+number="(\d+)"\s+hits="(\d+)"/g;
    let lineMatch;
    let total = 0;
    let covered = 0;

    while ((lineMatch = lineRegex.exec(fileSection)) !== null) {
      total++;
      const lineNum = parseInt(lineMatch[1]!, 10);
      const hits = parseInt(lineMatch[2]!, 10);
      if (hits > 0) {
        covered++;
      } else {
        uncoveredLines.push(lineNum);
      }
    }

    const ext = filePath.match(/\.(ts|tsx|js|jsx)$/)?.[0] ?? '.ts';
    const base = basename(filePath, ext);
    const testFile = filePath.replace(
      new RegExp(`${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${ext.replace('.', '\\.')}$`),
      `${base}.test${ext}`,
    );

    files.push({
      filePath,
      relativePath: relPath,
      lineRate,
      branchRate,
      uncoveredLines,
      totalLines: total || Math.round(1 / (1 - lineRate + 0.001)),
      coveredLines: covered || Math.round(lineRate * (total || 10)),
      hasTests: existsSync(testFile),
    });
  }

  const totalLines = files.reduce((s, f) => s + f.totalLines, 0);
  const coveredLines = files.reduce((s, f) => s + f.coveredLines, 0);

  return {
    files,
    totalLines,
    coveredLines,
    overallRate: totalLines > 0 ? coveredLines / totalLines : 0,
  };
}

/**
 * Auto-detect and parse coverage data from common locations.
 */
export function loadCoverage(cwd: string): CoverageData | null {
  const lcovPaths = [
    'coverage/lcov.info',
    'coverage/lcov/lcov.info',
  ];

  for (const p of lcovPaths) {
    const fullPath = resolve(cwd, p);
    if (existsSync(fullPath)) return parseLcov(fullPath, cwd);
  }

  const coberturaPaths = [
    'coverage/cobertura-coverage.xml',
    'coverage/cobertura.xml',
  ];

  for (const p of coberturaPaths) {
    const fullPath = resolve(cwd, p);
    if (existsSync(fullPath)) return parseCobertura(fullPath, cwd);
  }

  return null;
}

/**
 * Get files that need test generation, sorted by lowest coverage first.
 */
export function getUncoveredFiles(
  coverage: CoverageData,
  targetRate: number = 0.8,
): CoverageFile[] {
  return coverage.files
    .filter((f) => f.lineRate < targetRate)
    .filter((f) => !f.relativePath.includes('.test.') && !f.relativePath.includes('.spec.'))
    .filter((f) => !f.relativePath.includes('node_modules'))
    .sort((a, b) => a.lineRate - b.lineRate);
}
