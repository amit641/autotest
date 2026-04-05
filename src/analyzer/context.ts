import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import type { AnalyzedFile } from '../types.js';

/**
 * Follow relative imports from the analyzed file and collect their source code
 * as additional context for the LLM.
 */
export function gatherImportContext(
  analysis: AnalyzedFile,
  maxFiles: number = 5,
  maxCharsPerFile: number = 3000,
): ImportContext[] {
  const contexts: ImportContext[] = [];
  const seen = new Set<string>();

  for (const imp of analysis.imports) {
    if (!imp.isRelative) continue;
    if (contexts.length >= maxFiles) break;

    const resolvedPath = resolveImportPath(analysis.filePath, imp.source);
    if (!resolvedPath || seen.has(resolvedPath)) continue;
    seen.add(resolvedPath);

    try {
      let content = readFileSync(resolvedPath, 'utf-8');
      if (content.length > maxCharsPerFile) {
        content = content.slice(0, maxCharsPerFile) + '\n// ... (truncated)';
      }

      contexts.push({
        importPath: imp.source,
        resolvedPath,
        specifiers: imp.specifiers,
        content,
      });
    } catch {
      // File not readable, skip
    }
  }

  return contexts;
}

export interface ImportContext {
  importPath: string;
  resolvedPath: string;
  specifiers: string[];
  content: string;
}

/**
 * Resolve a relative import to an absolute file path,
 * trying common extensions.
 */
function resolveImportPath(fromFile: string, importSource: string): string | null {
  const dir = dirname(fromFile);
  const base = resolve(dir, importSource);
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js'];

  // Direct match (already has extension)
  if (existsSync(base) && extname(base)) return base;

  for (const ext of extensions) {
    const candidate = base + ext;
    if (existsSync(candidate)) return candidate;
  }

  return null;
}
