---
slug: /
sidebar_position: 1
---

# Introduction

**testpilot-ai** is an AI-powered test generation tool for JavaScript and TypeScript that **actually works**. It generates tests, runs them, and auto-fixes failures in a loop until they pass.

## Why testpilot-ai?

| | testpilot-ai | Writing tests manually | Copilot suggestions |
|---|---|---|---|
| **Speed** | Entire test file in seconds | Hours per file | One test at a time |
| **Coverage** | Edge cases + error handling | Often forgotten | Inconsistent |
| **Framework-aware** | Vitest & Jest native | Manual setup | Generic |
| **Multi-provider** | OpenAI, Anthropic, Google, Ollama | — | OpenAI only |
| **AST-based analysis** | Understands your code structure | — | Context-window limited |

## Key Features

- **Self-healing tests** — Verify & auto-fix loop runs your tests, feeds failures back to the LLM, and never lets the test file regress beyond the best version it has seen
- **TypeScript AST analysis** — Uses the TypeScript compiler API to parse your code, extracting exported functions, classes, parameters, types, JSDoc, and imports
- **Bounded import context** — Follows relative imports *and* tsconfig path aliases (`@/foo`, `~lib/*`) back into the project, capped at 5 files × 3 KB
- **Multi-provider LLM support** — Works with OpenAI, Anthropic, Google, and Ollama (local models) via [aiclientjs](https://www.npmjs.com/package/aiclientjs)
- **Four frameworks** — Native Vitest, Jest, Mocha, and Node test runner output, auto-detected from `package.json`
- **Coverage-driven discovery** — `analyze` parses lcov / cobertura to surface the files that need tests most
- **Cost & concurrency controls** — `--max-cost <usd>` aborts before overspending; `--concurrency <n>` runs files in parallel
- **Smart configuration** — CLI flags, config files, and `package.json` with sensible defaults

## Quick Example

```bash
npx testpilot src/utils.ts --verify --provider openai
```

This will:
1. Analyze `src/utils.ts` using the TypeScript compiler API
2. Follow relative + aliased imports to gather a bounded context
3. Build a rich prompt with full type information and stream the LLM output
4. Write `src/utils.test.ts`
5. Run the tests, feed failures back to the LLM, and roll forward only when the new version is no worse than the previous one
