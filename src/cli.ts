import { Command } from 'commander';
import pc from 'picocolors';
import { existsSync, statSync, readdirSync } from 'node:fs';
import { resolve, extname, join } from 'node:path';
import { resolveConfig } from './config/index.js';
import { generateTests } from './generate.js';
import { loadCoverage, getUncoveredFiles } from './coverage/index.js';
import type { AutotestConfig, AutotestResult, TestFramework } from './types.js';

const VERSION = '0.1.0';

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
  .option('-p, --provider <provider>', 'LLM provider (openai, anthropic, google, ollama)')
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
}

// ── Generate logic ──────────────────────────────────────────────────────

async function runGenerate(target: string, options: CLIOptions): Promise<void> {
  const resolvedTarget = resolve(target);

  if (!existsSync(resolvedTarget)) {
    throw new Error(`Target not found: ${resolvedTarget}`);
  }

  const files = collectFiles(resolvedTarget);
  if (files.length === 0) {
    throw new Error('No .ts, .tsx, .js, or .jsx files found');
  }

  const config = resolveConfig({
    provider: options.provider,
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

  printHeader(files, config, options.verify);

  const results: AutotestResult[] = [];
  for (const file of files) {
    const result = await generateForFile(file, config, options);
    results.push(result);
  }

  printSummary(results, options.verify);
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
    const entries = readdirSync(target, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        const ext = extname(entry.name);
        if (validExts.has(ext) && !entry.name.includes('.test.') && !entry.name.includes('.spec.')) {
          files.push(join(target, entry.name));
        }
      }
    }
    return files.sort();
  }

  return [];
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

  let streamOutput = '';
  const result = await generateTests(file, config, {
    dryRun: options.dryRun,
    verify: options.verify,
    maxFixIterations: options.fixIterations ?? 3,
    onChunk: options.stream
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
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git' || entry.name === 'docs') continue;

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

function printHeader(files: string[], config: AutotestConfig, verify?: boolean): void {
  console.log(`\n${pc.bold(pc.magenta('⚡ testpilot'))} — AI-powered test generation\n`);
  console.log(`  ${pc.dim('Provider:')} ${config.provider}${config.model ? ` (${config.model})` : ''}`);
  console.log(`  ${pc.dim('Framework:')} ${config.framework}`);
  console.log(`  ${pc.dim('Files:')} ${files.length}`);
  console.log(`  ${pc.dim('Edge cases:')} ${config.edgeCases ? 'yes' : 'no'}`);
  console.log(`  ${pc.dim('Error handling:')} ${config.errorHandling ? 'yes' : 'no'}`);
  if (verify) {
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

program.parse();
