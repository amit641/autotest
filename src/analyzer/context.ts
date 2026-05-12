import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import type { AnalyzedFile } from '../types.js';

/**
 * Follow imports from the analyzed file and collect their source code
 * as additional context for the LLM.
 *
 * Resolves both relative imports (`./foo`) and tsconfig path aliases
 * (`@/foo`, `~lib/foo`, etc.) — anything that points back into the
 * project. External `node_modules` imports are intentionally skipped.
 */
export function gatherImportContext(
  analysis: AnalyzedFile,
  maxFiles: number = 5,
  maxCharsPerFile: number = 3000,
): ImportContext[] {
  const contexts: ImportContext[] = [];
  const seen = new Set<string>();
  const aliases = loadTsconfigAliases(analysis.filePath);

  for (const imp of analysis.imports) {
    if (contexts.length >= maxFiles) break;

    const resolvedPath = imp.isRelative
      ? resolveRelativeImport(analysis.filePath, imp.source)
      : resolveAliasedImport(imp.source, aliases);

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

const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js'];

function tryResolveWithExtensions(base: string): string | null {
  if (existsSync(base) && extname(base)) return base;
  for (const ext of EXTENSIONS) {
    const candidate = base + ext;
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function resolveRelativeImport(fromFile: string, importSource: string): string | null {
  const dir = dirname(fromFile);
  return tryResolveWithExtensions(resolve(dir, importSource));
}

interface AliasMap {
  baseUrl: string;
  /** Each alias prefix maps to one or more candidate filesystem prefixes. */
  paths: Array<{ prefix: string; targets: string[] }>;
}

function resolveAliasedImport(importSource: string, aliases: AliasMap | null): string | null {
  if (!aliases) return null;

  for (const { prefix, targets } of aliases.paths) {
    if (!matchesAliasPrefix(importSource, prefix)) continue;
    const remainder = importSource.slice(stripWildcard(prefix).length);
    for (const target of targets) {
      const targetBase = stripWildcard(target);
      const candidate = resolve(aliases.baseUrl, targetBase + remainder);
      const resolved = tryResolveWithExtensions(candidate);
      if (resolved) return resolved;
    }
  }
  return null;
}

function matchesAliasPrefix(importSource: string, prefix: string): boolean {
  if (prefix.endsWith('/*')) {
    return importSource.startsWith(prefix.slice(0, -1));
  }
  return importSource === prefix;
}

function stripWildcard(p: string): string {
  return p.endsWith('/*') ? p.slice(0, -1) : p;
}

/**
 * Walk up from the analyzed file to find the nearest tsconfig.json,
 * then extract `compilerOptions.baseUrl` and `compilerOptions.paths`.
 *
 * Returns `null` if no tsconfig is found or the file has no path aliases.
 */
function loadTsconfigAliases(fromFile: string): AliasMap | null {
  let dir = dirname(resolve(fromFile));
  for (let i = 0; i < 10; i++) {
    const candidate = resolve(dir, 'tsconfig.json');
    if (existsSync(candidate)) {
      try {
        // Strip JSON comments — tsconfig.json allows them.
        const raw = readFileSync(candidate, 'utf-8')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/(^|[^:])\/\/.*$/gm, '$1');
        const parsed = JSON.parse(raw) as {
          compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> };
        };
        const compilerOptions = parsed.compilerOptions ?? {};
        const paths = compilerOptions.paths ?? {};
        if (Object.keys(paths).length === 0) return null;

        const baseUrl = resolve(dirname(candidate), compilerOptions.baseUrl ?? '.');
        return {
          baseUrl,
          paths: Object.entries(paths).map(([prefix, targets]) => ({
            prefix,
            targets,
          })),
        };
      } catch {
        return null;
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
