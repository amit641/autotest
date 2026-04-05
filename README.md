<p align="center">
  <h1 align="center">autotest-ai</h1>
  <p align="center">AI-powered test generation for JavaScript & TypeScript.<br/>Point it at a file. Get comprehensive tests instantly.</p>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/autotest-ai"><img src="https://img.shields.io/npm/v/autotest-ai.svg" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/autotest-ai"><img src="https://img.shields.io/npm/dm/autotest-ai.svg" alt="npm downloads" /></a>
  <a href="https://github.com/amit641/autotest-ai/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/autotest-ai.svg" alt="license" /></a>
</p>

---

## Why autotest-ai?

| | autotest-ai | Writing tests manually | Copilot suggestions |
|---|---|---|---|
| **Speed** | Entire test file in seconds | Hours per file | One test at a time |
| **Coverage** | Edge cases + error handling | Often forgotten | Inconsistent |
| **Framework-aware** | Vitest & Jest native | Manual setup | Generic |
| **Multi-provider** | OpenAI, Anthropic, Google, Ollama | — | OpenAI only |
| **AST-based analysis** | Understands your code structure | — | Context-window limited |

## Install

```bash
npm install -D autotest-ai
```

## Quick Start

```bash
# Generate tests for a single file
npx autotest src/utils.ts

# Use a specific provider and model
npx autotest src/utils.ts --provider anthropic --model claude-sonnet-4-20250514

# Generate Jest tests instead of Vitest
npx autotest src/utils.ts --framework jest

# Generate tests for all files in a directory
npx autotest src/helpers/

# Dry run — preview without writing files
npx autotest src/utils.ts --dry-run

# Use local models with Ollama
npx autotest src/utils.ts --provider ollama --model llama3
```

## How It Works

```
┌───────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│  Source File   │────▶│  TS Analyzer │────▶│   Prompt     │────▶│  LLM (any)   │
│  src/utils.ts  │     │  AST Parse   │     │   Engine     │     │  OpenAI, etc  │
└───────────────┘     └──────────────┘     └─────────────┘     └──────┬───────┘
                                                                       │
┌───────────────┐     ┌──────────────┐                                │
│  Test File    │◀────│  Test Writer  │◀───────────────────────────────┘
│  utils.test.ts│     │  Parse+Write  │
└───────────────┘     └──────────────┘
```

1. **Analyze** — Uses the TypeScript compiler API to parse your source file, extracting exported functions, classes, parameters, types, JSDoc, and imports
2. **Prompt** — Builds a rich, structured prompt with full type information, parameter details, and your source code
3. **Generate** — Sends to any LLM provider via [aiclientjs](https://www.npmjs.com/package/aiclientjs), with real-time streaming
4. **Write** — Parses the output, strips markdown artifacts, and writes a clean test file

## CLI Reference

```
Usage: autotest [options] <target>

Arguments:
  target                      File or directory to generate tests for

Options:
  -p, --provider <provider>   LLM provider (openai, anthropic, google, ollama)
  -m, --model <model>         Model to use
  -k, --api-key <key>         API key (or use env var)
  -f, --framework <framework> Test framework: vitest or jest
  -o, --out-dir <dir>         Output directory for test files
  --overwrite                 Overwrite existing test files
  --no-edge-cases             Skip edge case tests
  --no-error-handling         Skip error handling tests
  --instructions <text>       Additional instructions for the LLM
  --max-tokens <n>            Max tokens for LLM response
  --temperature <n>           Temperature for LLM
  --dry-run                   Generate tests without writing to disk
  -s, --stream                Stream LLM output in real-time
  -V, --version               Output the version number
  -h, --help                  Display help
```

## Configuration

autotest-ai automatically detects your test framework from `package.json`. You can also configure it via:

### Config file

Create `autotest.config.json` or `.autotestrc` in your project root:

```json
{
  "provider": "anthropic",
  "model": "claude-sonnet-4-20250514",
  "framework": "vitest",
  "edgeCases": true,
  "errorHandling": true,
  "maxTokens": 4096,
  "temperature": 0.2
}
```

### package.json

```json
{
  "autotest": {
    "provider": "openai",
    "model": "gpt-4o",
    "framework": "vitest"
  }
}
```

### Priority order

CLI flags > Config file > package.json `autotest` field > Auto-detected framework > Defaults

## Environment Variables

Set your API key as an environment variable matching your provider:

```bash
# OpenAI
export OPENAI_API_KEY=sk-...

# Anthropic
export ANTHROPIC_API_KEY=sk-ant-...

# Google
export GOOGLE_API_KEY=...

# Ollama — no key needed (local)
```

## Programmatic API

```typescript
import { generateTests, analyzeFile, resolveConfig } from 'autotest-ai';

// Generate tests programmatically
const config = resolveConfig({ provider: 'openai', model: 'gpt-4o' });
const result = await generateTests('src/utils.ts', config);

console.log(`Generated ${result.testCount} tests in ${result.duration}ms`);

// Just analyze a file
const analysis = analyzeFile('src/utils.ts');
console.log(analysis.exports); // [{ name: 'add', kind: 'function', ... }]
```

## What Gets Generated

Given a file like:

```typescript
// src/math.ts
export function add(a: number, b: number): number {
  return a + b;
}

export function divide(a: number, b: number): number {
  if (b === 0) throw new Error('Division by zero');
  return a / b;
}
```

autotest-ai generates:

```typescript
// src/math.test.ts
import { describe, it, expect } from 'vitest';
import { add, divide } from './math';

describe('add', () => {
  it('adds two positive numbers', () => {
    expect(add(2, 3)).toBe(5);
  });

  it('adds negative numbers', () => {
    expect(add(-1, -2)).toBe(-3);
  });

  it('adds zero', () => {
    expect(add(0, 5)).toBe(5);
  });

  it('handles large numbers', () => {
    expect(add(Number.MAX_SAFE_INTEGER, 0)).toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe('divide', () => {
  it('divides two numbers', () => {
    expect(divide(10, 2)).toBe(5);
  });

  it('throws on division by zero', () => {
    expect(() => divide(10, 0)).toThrow('Division by zero');
  });

  it('handles decimal results', () => {
    expect(divide(1, 3)).toBeCloseTo(0.333, 2);
  });
});
```

## Supported Providers

| Provider | Models | Env Variable |
|----------|--------|-------------|
| **OpenAI** | gpt-4o, gpt-4o-mini, o1, etc. | `OPENAI_API_KEY` |
| **Anthropic** | claude-sonnet-4-20250514, claude-haiku, etc. | `ANTHROPIC_API_KEY` |
| **Google** | gemini-pro, gemini-1.5-pro, etc. | `GOOGLE_API_KEY` |
| **Ollama** | llama3, codellama, mistral, etc. | None (local) |

## Architecture

```
src/
├── analyzer/     # TypeScript AST-based code analysis
├── prompt/       # Context-rich prompt generation
├── llm/          # LLM client (via aiclientjs)
├── writer/       # Test output parser & file writer
├── frameworks/   # Vitest & Jest adapters
├── config/       # Config file resolution & merging
├── generate.ts   # Main orchestrator
├── cli.ts        # Commander-based CLI
├── types.ts      # Core type definitions
└── index.ts      # Public API exports
```

**Design Principles:**
- **Single Responsibility** — Each module has one clear job
- **Open/Closed** — Add new providers/frameworks without modifying existing code
- **Dependency Inversion** — Core logic depends on abstractions (aiclientjs)
- **Zero magic** — Transparent AST analysis, no hidden heuristics

## License

MIT
