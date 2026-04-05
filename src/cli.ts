import { Command } from 'commander';
import pc from 'picocolors';
import { existsSync, statSync, readdirSync } from 'node:fs';
import { resolve, extname, join } from 'node:path';
import { resolveConfig } from './config/index.js';
import { generateTests } from './generate.js';
import type { AutotestConfig, AutotestResult, TestFramework } from './types.js';

const VERSION = '0.1.0';

const program = new Command();

program
  .name('autotest')
  .description('AI-powered test generation for JavaScript & TypeScript')
  .version(VERSION)
  .argument('<target>', 'File or directory to generate tests for')
  .option('-p, --provider <provider>', 'LLM provider (openai, anthropic, google, ollama)')
  .option('-m, --model <model>', 'Model to use')
  .option('-k, --api-key <key>', 'API key (or use env var)')
  .option('-f, --framework <framework>', 'Test framework: vitest or jest')
  .option('-o, --out-dir <dir>', 'Output directory for test files')
  .option('--overwrite', 'Overwrite existing test files', false)
  .option('--no-edge-cases', 'Skip edge case tests')
  .option('--no-error-handling', 'Skip error handling tests')
  .option('--instructions <text>', 'Additional instructions for the LLM')
  .option('--max-tokens <n>', 'Max tokens for LLM response', parseInt)
  .option('--temperature <n>', 'Temperature for LLM', parseFloat)
  .option('--dry-run', 'Generate tests without writing to disk')
  .option('-s, --stream', 'Stream LLM output in real-time', true)
  .action(async (target: string, options: CLIOptions) => {
    try {
      await run(target, options);
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
}

async function run(target: string, options: CLIOptions): Promise<void> {
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

  printHeader(files, config);

  const results: AutotestResult[] = [];
  for (const file of files) {
    const result = await generateForFile(file, config, options);
    results.push(result);
  }

  printSummary(results);
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
  console.log(`\n${pc.cyan('●')} Generating tests for ${pc.bold(fileName)}...\n`);

  let streamOutput = '';
  const result = await generateTests(file, config, {
    dryRun: options.dryRun,
    onChunk: options.stream
      ? (chunk) => {
          process.stdout.write(pc.dim(chunk));
          streamOutput += chunk;
        }
      : undefined,
  });

  if (streamOutput) {
    // Clear streamed output and show clean summary
    process.stdout.write('\n');
  }

  const action = options.dryRun ? 'would write' : 'wrote';
  console.log(`${pc.green('✔')} ${action} ${pc.bold(result.testFile)}`);
  console.log(`  ${pc.dim(`${result.testCount} tests | ${result.categories.length} groups | ${result.tokensUsed} tokens | ${(result.duration / 1000).toFixed(1)}s`)}`);

  if (result.categories.length > 0) {
    for (const cat of result.categories) {
      console.log(`  ${pc.dim('├')} ${cat.name} ${pc.dim(`(${cat.count} tests)`)}`);
    }
  }

  return result;
}

function printHeader(files: string[], config: AutotestConfig): void {
  console.log(`\n${pc.bold(pc.magenta('⚡ autotest'))} — AI-powered test generation\n`);
  console.log(`  ${pc.dim('Provider:')} ${config.provider}${config.model ? ` (${config.model})` : ''}`);
  console.log(`  ${pc.dim('Framework:')} ${config.framework}`);
  console.log(`  ${pc.dim('Files:')} ${files.length}`);
  console.log(`  ${pc.dim('Edge cases:')} ${config.edgeCases ? 'yes' : 'no'}`);
  console.log(`  ${pc.dim('Error handling:')} ${config.errorHandling ? 'yes' : 'no'}`);
}

function printSummary(results: AutotestResult[]): void {
  const totalTests = results.reduce((n, r) => n + r.testCount, 0);
  const totalTokens = results.reduce((n, r) => n + r.tokensUsed, 0);
  const totalDuration = results.reduce((n, r) => n + r.duration, 0);

  console.log(`\n${pc.bold(pc.green('Done!'))} Generated ${pc.bold(String(totalTests))} tests across ${pc.bold(String(results.length))} file(s)`);
  console.log(`${pc.dim(`Total: ${totalTokens} tokens | ${(totalDuration / 1000).toFixed(1)}s`)}\n`);
}

program.parse();
