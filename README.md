<p align="center">
  <h1 align="center">testpilot-ai</h1>
  <p align="center">AI-powered test generation that actually works.<br/>Generate, verify, and auto-fix tests with any LLM.</p>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/testpilot-ai"><img src="https://img.shields.io/npm/v/testpilot-ai.svg" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/testpilot-ai"><img src="https://img.shields.io/npm/dm/testpilot-ai.svg" alt="npm downloads" /></a>
  <a href="https://github.com/amit641/autotest/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/testpilot-ai.svg" alt="license" /></a>
</p>

<p align="center">
  <a href="https://amit641.github.io/autotest/">Docs</a> · <a href="#install">Install</a> · <a href="#quick-start">Quick Start</a> · <a href="https://github.com/amit641/autotest">GitHub</a>
</p>

---

## Why testpilot-ai?

Most AI test generators write tests that **don't pass**. testpilot-ai generates, runs, and auto-fixes tests in a loop until they actually work.

- **Self-healing tests** — Verify & auto-fix loop until all tests pass
- **AST analysis** — TypeScript compiler API extracts functions, classes, types, JSDoc
- **Coverage-gap filling** — Parse lcov/cobertura, generate tests for uncovered code
- **Any LLM** — OpenAI, Anthropic, Google, Ollama (local models)
- **4 frameworks** — Vitest, Jest, Mocha, Node test runner
- **Context-aware** — Follows relative imports for richer prompts
- **Analyze command** — Find files that need tests

## Install

```bash
npm install -D testpilot-ai
```

## Quick Start

```bash
# Generate tests for a file
npx testpilot src/utils.ts

# Generate AND verify — auto-fix until all tests pass
npx testpilot src/utils.ts --verify

# Use a specific provider
npx testpilot src/utils.ts --provider anthropic --model claude-sonnet-4-20250514

# Analyze your project for untested files
npx testpilot analyze

# Use local models with Ollama (no API key needed)
npx testpilot src/utils.ts --provider ollama --model llama3
```

## The Verify & Auto-Fix Loop

The killer feature. With `--verify`, testpilot-ai doesn't just generate tests — it **runs them and fixes failures automatically**:

```bash
npx testpilot src/utils.ts --verify
```

```
⚡ testpilot — AI-powered test generation

  Provider: openai (gpt-4o)
  Framework: vitest
  Verify & fix: enabled

● Generating tests for utils.ts...

✔ wrote src/utils.test.ts
▶ Verify iteration 1/3...
⚠ 3/12 tests failed — sending to LLM for auto-fix...
▶ Verify iteration 2/3...
✔ All 12 tests pass!

Done! Generated 12 tests across 1 file(s)
✔ All tests verified and passing
```

The loop:
1. **Generate** tests using AST analysis + LLM
2. **Run** them with your test framework
3. **Collect** failures with error messages and stack traces
4. **Send** failures back to the LLM: "here's the source code, here's the failing test, here's the error — fix it"
5. **Write** the fixed tests and **repeat** (up to 3 iterations by default)

## Analyze Your Project

Find files that need tests, optionally using coverage data:

```bash
npx testpilot analyze
```

```
⚡ testpilot analyze

  Coverage: 67.3% (1240/1842 lines)
  Target: 80%
  Files: 23

Files below target:

  File                                 Coverage   Tests?
  ──────────────────────────────────────────────────────
  src/utils/parser.ts                  12.5%      no
  src/services/auth.ts                 34.2%      yes
  src/handlers/webhook.ts              45.0%      no
  src/middleware/cors.ts               61.8%      yes

Generate tests: testpilot generate <file> --verify
```

If no coverage data exists, it scans for source files without corresponding test files.

## CLI Reference

```
Usage: testpilot [options] [command]

Commands:
  generate <target>  Generate tests for a file or directory (default)
  analyze            Analyze project for files needing tests
  help [command]     Display help

Generate Options:
  -p, --provider <provider>   LLM provider (openai, anthropic, google, ollama)
  -m, --model <model>         Model to use
  -k, --api-key <key>         API key (or use env var)
  -f, --framework <framework> Test framework: vitest, jest, mocha, node
  -o, --out-dir <dir>         Output directory for test files
  --overwrite                 Overwrite existing test files
  --verify                    Run tests and auto-fix failures
  --fix-iterations <n>        Max auto-fix iterations (default: 3)
  --no-edge-cases             Skip edge case tests
  --no-error-handling         Skip error handling tests
  --instructions <text>       Additional instructions for the LLM
  --dry-run                   Preview without writing files
  -V, --version               Output the version number

Analyze Options:
  -t, --target <rate>         Coverage target (0-1, default: 0.8)
  -l, --limit <n>             Max files to show (default: 15)
```

## How It Works

```
Source File → TS Analyzer → Import Context → Prompt Engine → LLM → Test Writer
                                                                        ↓
                                                              ┌─── Verify Loop ───┐
                                                              │  Run → Fix → Run  │
                                                              └───────────────────┘
```

1. **Analyze** — TypeScript compiler API extracts functions, classes, parameters, types, JSDoc
2. **Context** — Follows relative imports to gather type definitions and related code
3. **Prompt** — Builds rich prompts with exact import lines, parameter types, and source code
4. **Generate** — Streams output from any LLM provider via [aiclientjs](https://www.npmjs.com/package/aiclientjs)
5. **Write** — Strips markdown artifacts, writes clean test file
6. **Verify** *(optional)* — Runs tests, collects failures, sends to LLM for fixing, repeats

## Configuration

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

Save as `autotest.config.json`, `.autotestrc`, or add to `package.json` under `"autotest"`.

**Priority:** CLI flags > Config file > package.json > Auto-detected framework > Defaults

## Supported Providers

| Provider | Models | Env Variable |
|----------|--------|-------------|
| **OpenAI** | gpt-4o, gpt-4o-mini, o1 | `OPENAI_API_KEY` |
| **Anthropic** | claude-sonnet-4-20250514, claude-haiku | `ANTHROPIC_API_KEY` |
| **Google** | gemini-pro, gemini-1.5-pro | `GOOGLE_API_KEY` |
| **Ollama** | llama3, codellama, mistral | None (local) |

## Programmatic API

```typescript
import { generateTests, analyzeFile, resolveConfig } from 'testpilot-ai';

const config = resolveConfig({ provider: 'openai', model: 'gpt-4o' });

// Generate with verify & auto-fix
const result = await generateTests('src/utils.ts', config, {
  verify: true,
  maxFixIterations: 3,
  onStatus: (msg) => console.log(msg),
});

console.log(`${result.testCount} tests, verified: ${result.verified}`);
```

## Architecture

```
src/
├── analyzer/      # TS AST analysis + import context gathering
├── prompt/        # Framework-aware prompt generation
├── llm/           # LLM client (via aiclientjs)
├── writer/        # Output parser & file writer
├── verify/        # Test runner + auto-fix loop
├── coverage/      # LCOV & Cobertura coverage parsing
├── frameworks/    # Vitest, Jest, Mocha, Node adapters
├── config/        # Config resolution & merging
├── generate.ts    # Main orchestrator
├── cli.ts         # Commander-based CLI
├── types.ts       # Core types
└── index.ts       # Public API
```

## License

MIT
