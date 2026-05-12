import { Command } from 'commander';
import pc from 'picocolors';
import { existsSync, statSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveConfig } from './config/index.js';
import { generateTests } from './generate.js';
import { loadCoverage, getUncoveredFiles } from './coverage/index.js';
import {
  PROVIDER_COST_PER_1K_TOKENS,
  SUPPORTED_PROVIDERS,
  type AutotestConfig,
  type AutotestResult,
  type LLMProvider,
  type TestFramework,
} from './types.js';

const VERSION = readPackageVersion();

const program = new Command();

program
  .name('testpilot')
  .description('AI-powered test generation that actually works')
  .version(VERSION);

// ── generate (default command) ──────────────────────────────────────────

program
  .command('generate', { isDefault: true })
  .description('Generate tests for a file or directory')
  .argument('<target>', 'File or directory to generate tests for')
  .option('-p, --provider <provider>', `LLM provider (${SUPPORTED_PROVIDERS.join(', ')})`)
  .option('-m, --model <model>', 'Model to use')
  .option('-k, --api-key <key>', 'API key (or use env var)')
  .option('-f, --framework <framework>', 'Test framework: vitest, jest, mocha, node')
  .option('-o, --out-dir <dir>', 'Output directory for test files')
  .option('--overwrite', 'Overwrite existing test files', false)
  .option('--no-edge-cases', 'Skip edge case tests')
  .option('--no-error-handling', 'Skip error handling tests')
  .option('--instructions <text>', 'Additional instructions for the LLM')
  .option('--max-tokens <n>', 'Max tokens for LLM response', parseInt)
  .option('--temperature <n>', 'Temperature for LLM', parseFloat)
  .option('--dry-run', 'Generate tests without writing to disk')
  .option('-s, --stream', 'Stream LLM output in real-time', true)
  .option('--verify', 'Run tests after generation and auto-fix failures', false)
  .option('--fix-iterations <n>', 'Max auto-fix iterations (with --verify)', parseInt)
  .option('-c, --concurrency <n>', 'Number of files to process in parallel', parseInt)
  .option('--max-cost <usd>', 'Abort the run if estimated cost exceeds this USD amount', parseFloat)
  .action(async (target: string, options: CLIOptions) => {
    try {
      await runGenerate(target, options);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`\n${pc.red('✖')} ${msg}`);
      process.exit(1);
    }
  });

// ── analyze command ─────────────────────────────────────────────────────

program
  .command('analyze')
  .description('Analyze project for files needing tests (uses coverage data if available)')
  .option('-t, --target <rate>', 'Coverage target (0-1)', parseFloat)
  .option('-l, --limit <n>', 'Max files to show', parseInt)
  .action(async (options: { target?: number; limit?: number }) => {
    try {
      await runAnalyze(options);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`\n${pc.red('✖')} ${msg}`);
      process.exit(1);
    }
  });

interface CLIOptions {
  provider?: string;
  model?: string;
  apiKey?: string;
  framework?: TestFramework;
  outDir?: string;
  overwrite?: boolean;
  edgeCases?: boolean;
  errorHandling?: boolean;
  instructions?: string;
  maxTokens?: number;
  temperature?: number;
  dryRun?: boolean;
  stream?: boolean;
  verify?: boolean;
  fixIterations?: number;
  concurrency?: number;
  maxCost?: number;
}

const IGNORED_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.git',
  '.next',
  '.nuxt',
  '.svelte-kit',
  '.cache',
  'docs',
]);

// ── Generate logic ──────────────────────────────────────────────────────

async function runGenerate(target: string, options: CLIOptions): Promise<void> {
  const resolvedTarget = resolve(target);

  if (!existsSync(resolvedTarget)) {
    throw new Error(`Target not found: ${resolvedTarget}`);
  }

  const validatedProvider = validateProvider(options.provider);

  const files = collectFiles(resolvedTarget);
  if (files.length === 0) {
    throw new Error('No .ts, .tsx, .js, or .jsx files found');
  }

  const config = resolveConfig({
    provider: validatedProvider,
    model: options.model,
    apiKey: options.apiKey,
    framework: options.framework,
    outDir: options.outDir,
    overwrite: options.overwrite,
    edgeCases: options.edgeCases,
    errorHandling: options.errorHandling,
    instructions: options.instructions,
    maxTokens: options.maxTokens,
    temperature: options.temperature,
  });

  printHeader(files, config, options);

  if (options.maxCost !== undefined) {
    confirmCostBudget(files.length, config, options.maxCost);
  }

  const concurrency = Math.max(1, options.concurrency ?? 1);
  const results = await runWithConcurrency(files, concurrency, (file) =>
    generateForFile(file, config, options),
  );

  printSummary(results, options.verify);
}

function validateProvider(provider: string | undefined): LLMProvider | undefined {
  if (provider === undefined) return undefined;
  if ((SUPPORTED_PROVIDERS as readonly string[]).includes(provider)) {
    return provider as LLMProvider;
  }
  throw new Error(
    `Unknown provider "${provider}". Supported: ${SUPPORTED_PROVIDERS.join(', ')}`,
  );
}

function confirmCostBudget(
  fileCount: number,
  config: AutotestConfig,
  maxCost: number,
): void {
  const perFileTokens = config.maxTokens * 1.5; // generation + ~half a verify round trip
  const estimatedTokens = fileCount * perFileTokens;
  const costPer1k = PROVIDER_COST_PER_1K_TOKENS[config.provider];
  const estimatedCost = (estimatedTokens / 1000) * costPer1k;

  if (estimatedCost > maxCost) {
    throw new Error(
      `Estimated cost $${estimatedCost.toFixed(2)} exceeds --max-cost $${maxCost.toFixed(2)} ` +
        `(${fileCount} files × ~${perFileTokens} tokens × $${costPer1k}/1K). ` +
        `Raise --max-cost, lower --max-tokens, or scope to fewer files.`,
    );
  }

  if (estimatedCost > 0) {
    console.log(
      `  ${pc.dim(`Estimated cost: ~$${estimatedCost.toFixed(4)} (cap $${maxCost.toFixed(2)})`)}`,
    );
  }
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  if (concurrency <= 1) {
    const results: R[] = [];
    for (const item of items) results.push(await worker(item));
    return results;
  }

  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function pull(): Promise<void> {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      results[idx] = await worker(items[idx]!);
    }
  }

  const pool = Array.from({ length: Math.min(concurrency, items.length) }, () => pull());
  await Promise.all(pool);
  return results;
}

function collectFiles(target: string): string[] {
  const validExts = new Set(['.ts', '.tsx', '.js', '.jsx']);
  const stat = statSync(target);

  if (stat.isFile()) {
    const ext = extname(target);
    if (!validExts.has(ext)) {
      throw new Error(`Unsupported file type: ${ext}`);
    }
    if (target.includes('.test.') || target.includes('.spec.')) {
      throw new Error('Target is already a test file');
    }
    return [target];
  }

  if (stat.isDirectory()) {
    const files: string[] = [];
    walkDirectory(target, validExts, files);
    return files.sort();
  }

  return [];
}

function walkDirectory(dir: string, validExts: Set<string>, out: string[]): void {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.') continue;
    if (IGNORED_DIRS.has(entry.name)) continue;

    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDirectory(full, validExts, out);
    } else if (entry.isFile()) {
      const ext = extname(entry.name);
      if (!validExts.has(ext)) continue;
      if (entry.name.includes('.test.') || entry.name.includes('.spec.')) continue;
      if (entry.name.endsWith('.d.ts')) continue;
      out.push(full);
    }
  }
}

async function generateForFile(
  file: string,
  config: AutotestConfig,
  options: CLIOptions,
): Promise<AutotestResult> {
  const fileName = file.split('/').pop() ?? file;
  console.log(`\n${pc.cyan('●')} Generating tests for ${pc.bold(fileName)}...`);
  if (options.verify) {
    console.log(`  ${pc.dim('verify & auto-fix enabled')}`);
  }
  console.log();

  // Streaming output is only useful when one file is in flight at a time.
  // With concurrency > 1, multiple streams interleave into garbage, so we
  // suppress per-chunk streaming above 1.
  const concurrency = Math.max(1, options.concurrency ?? 1);
  const enableStreaming = options.stream && concurrency === 1;

  let streamOutput = '';
  const result = await generateTests(file, config, {
    dryRun: options.dryRun,
    verify: options.verify,
    maxFixIterations: options.fixIterations ?? 3,
    onChunk: enableStreaming
      ? (chunk) => {
          process.stdout.write(pc.dim(chunk));
          streamOutput += chunk;
        }
      : undefined,
    onStatus: (msg) => console.log(msg),
  });

  if (streamOutput) {
    process.stdout.write('\n');
  }

  const action = options.dryRun ? 'would write' : 'wrote';
  console.log(`${pc.green('✔')} ${action} ${pc.bold(result.testFile)}`);

  const parts = [
    `${result.testCount} tests`,
    `${result.categories.length} groups`,
    `${result.tokensUsed} tokens`,
    `${(result.duration / 1000).toFixed(1)}s`,
  ];

  if (result.verified !== undefined) {
    parts.push(
      result.verified
        ? pc.green('✔ all tests pass')
        : pc.yellow(`⚠ ${result.verifyIterations} fix iterations`),
    );
  }

  console.log(`  ${pc.dim(parts.join(' | '))}`);

  if (result.categories.length > 0) {
    for (const cat of result.categories) {
      console.log(`  ${pc.dim('├')} ${cat.name} ${pc.dim(`(${cat.count} tests)`)}`);
    }
  }

  return result;
}

// ── Analyze logic ───────────────────────────────────────────────────────

async function runAnalyze(options: { target?: number; limit?: number }): Promise<void> {
  const cwd = process.cwd();
  const targetRate = options.target ?? 0.8;
  const limit = options.limit ?? 15;

  console.log(`\n${pc.bold(pc.magenta('⚡ testpilot analyze'))}\n`);

  const coverage = loadCoverage(cwd);

  if (!coverage) {
    console.log(`${pc.yellow('⚠')} No coverage data found.`);
    console.log(`  ${pc.dim('Run your tests with coverage first:')}`);
    console.log(`  ${pc.dim('  npx vitest run --coverage')}`);
    console.log(`  ${pc.dim('  npx jest --coverage')}`);
    console.log();

    // Fallback: find source files without test files
    console.log(`${pc.cyan('●')} Scanning for files without tests...\n`);
    const srcFiles = findSourceFilesWithoutTests(cwd);

    if (srcFiles.length === 0) {
      console.log(`${pc.green('✔')} All source files have corresponding test files.`);
      return;
    }

    console.log(`Found ${pc.bold(String(srcFiles.length))} file(s) without tests:\n`);
    for (const f of srcFiles.slice(0, limit)) {
      console.log(`  ${pc.red('○')} ${f}`);
    }

    if (srcFiles.length > limit) {
      console.log(`  ${pc.dim(`... and ${srcFiles.length - limit} more`)}`);
    }

    console.log(`\n${pc.dim('Generate tests:')} testpilot generate <file>\n`);
    return;
  }

  // Coverage-based analysis
  console.log(`  ${pc.dim('Coverage:')} ${(coverage.overallRate * 100).toFixed(1)}% (${coverage.coveredLines}/${coverage.totalLines} lines)`);
  console.log(`  ${pc.dim('Target:')} ${(targetRate * 100).toFixed(0)}%`);
  console.log(`  ${pc.dim('Files:')} ${coverage.files.length}\n`);

  const uncovered = getUncoveredFiles(coverage, targetRate).slice(0, limit);

  if (uncovered.length === 0) {
    console.log(`${pc.green('✔')} All files meet the ${(targetRate * 100).toFixed(0)}% coverage target!`);
    return;
  }

  console.log(`${pc.bold('Files below target:')}\n`);
  console.log(`  ${pc.dim('File'.padEnd(50))} ${pc.dim('Coverage'.padEnd(10))} ${pc.dim('Tests?')}`);
  console.log(`  ${pc.dim('─'.repeat(70))}`);

  for (const file of uncovered) {
    const covStr = `${(file.lineRate * 100).toFixed(1)}%`.padEnd(10);
    const testStr = file.hasTests ? pc.green('yes') : pc.red('no');
    const color = file.lineRate < 0.3 ? pc.red : file.lineRate < 0.6 ? pc.yellow : pc.white;
    console.log(`  ${color(file.relativePath.padEnd(50))} ${covStr} ${testStr}`);
  }

  console.log(`\n${pc.dim('Generate tests:')} testpilot generate <file> --verify\n`);
}

function findSourceFilesWithoutTests(cwd: string): string[] {
  const validExts = new Set(['.ts', '.tsx', '.js', '.jsx']);
  const results: string[] = [];

  function scan(dir: string): void {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') && entry.name !== '.') continue;
        if (IGNORED_DIRS.has(entry.name)) continue;

        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          scan(fullPath);
        } else if (entry.isFile()) {
          const ext = extname(entry.name);
          if (!validExts.has(ext)) continue;
          if (entry.name.includes('.test.') || entry.name.includes('.spec.')) continue;
          if (entry.name.includes('.d.ts')) continue;

          // Check if corresponding test file exists
          const base = entry.name.replace(/\.(ts|tsx|js|jsx)$/, '');
          const testNames = [
            `${base}.test${ext}`,
            `${base}.spec${ext}`,
          ];
          const hasTest = testNames.some((t) => existsSync(join(dir, t)));
          if (!hasTest) {
            const relPath = fullPath.slice(cwd.length + 1);
            results.push(relPath);
          }
        }
      }
    } catch {
      // Permission denied, etc.
    }
  }

  scan(cwd);
  return results.sort();
}

// ── Output helpers ──────────────────────────────────────────────────────

function printHeader(
  files: string[],
  config: AutotestConfig,
  options: CLIOptions,
): void {
  console.log(`\n${pc.bold(pc.magenta('⚡ testpilot'))} — AI-powered test generation\n`);
  console.log(`  ${pc.dim('Provider:')} ${config.provider}${config.model ? ` (${config.model})` : ''}`);
  console.log(`  ${pc.dim('Framework:')} ${config.framework}`);
  console.log(`  ${pc.dim('Files:')} ${files.length}`);
  console.log(`  ${pc.dim('Edge cases:')} ${config.edgeCases ? 'yes' : 'no'}`);
  console.log(`  ${pc.dim('Error handling:')} ${config.errorHandling ? 'yes' : 'no'}`);
  if (options.concurrency && options.concurrency > 1) {
    console.log(`  ${pc.dim('Concurrency:')} ${options.concurrency}`);
  }
  if (options.verify) {
    console.log(`  ${pc.dim('Verify & fix:')} ${pc.green('enabled')}`);
  }
}

function printSummary(results: AutotestResult[], verify?: boolean): void {
  const totalTests = results.reduce((n, r) => n + r.testCount, 0);
  const totalTokens = results.reduce((n, r) => n + r.tokensUsed, 0);
  const totalDuration = results.reduce((n, r) => n + r.duration, 0);

  console.log(`\n${pc.bold(pc.green('Done!'))} Generated ${pc.bold(String(totalTests))} tests across ${pc.bold(String(results.length))} file(s)`);

  if (verify) {
    const allPassed = results.every((r) => r.verified);
    const passedCount = results.filter((r) => r.verified).length;
    if (allPassed) {
      console.log(`${pc.green('✔')} All tests verified and passing`);
    } else {
      console.log(`${pc.yellow('⚠')} ${passedCount}/${results.length} files fully verified`);
    }
  }

  console.log(`${pc.dim(`Total: ${totalTokens} tokens | ${(totalDuration / 1000).toFixed(1)}s`)}\n`);
}

// ── Bootstrapping ───────────────────────────────────────────────────────

function readPackageVersion(): string {
  // Walk up from this file looking for our package.json. Works in both
  // dev (running from src/) and built output (running from dist/).
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    let dir = here;
    for (let i = 0; i < 5; i++) {
      const candidate = resolve(dir, 'package.json');
      if (existsSync(candidate)) {
        const pkg = JSON.parse(readFileSync(candidate, 'utf-8')) as { version?: string };
        if (pkg.version) return pkg.version;
      }
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch {
    // fall through
  }
  return '0.0.0-unknown';
}

program.parse();
