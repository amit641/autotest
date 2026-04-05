---
slug: /
sidebar_position: 1
---

# Introduction

**autotest-ai** is an AI-powered test generation tool for JavaScript and TypeScript. Point it at a source file and get comprehensive, framework-aware tests instantly.

## Why autotest-ai?

| | autotest-ai | Writing tests manually | Copilot suggestions |
|---|---|---|---|
| **Speed** | Entire test file in seconds | Hours per file | One test at a time |
| **Coverage** | Edge cases + error handling | Often forgotten | Inconsistent |
| **Framework-aware** | Vitest & Jest native | Manual setup | Generic |
| **Multi-provider** | OpenAI, Anthropic, Google, Ollama | — | OpenAI only |
| **AST-based analysis** | Understands your code structure | — | Context-window limited |

## Key Features

- **TypeScript AST analysis** — Uses the TypeScript compiler API to parse your code, extracting exported functions, classes, parameters, types, JSDoc, and imports
- **Multi-provider LLM support** — Works with OpenAI, Anthropic, Google, and Ollama (local models) via [aiclientjs](https://www.npmjs.com/package/aiclientjs)
- **Framework-aware** — Generates native Vitest or Jest tests with auto-detection from `package.json`
- **Streaming output** — Real-time LLM output in the terminal
- **Smart configuration** — CLI flags, config files, and `package.json` with sensible defaults
- **Clean CLI** — Beautiful terminal output with progress and summaries

## Quick Example

```bash
npx autotest-ai src/utils.ts --provider openai
```

This will:
1. Analyze `src/utils.ts` using the TypeScript compiler API
2. Build a rich prompt with full type information
3. Send it to the LLM and stream the output
4. Write a `src/utils.test.ts` file with comprehensive tests
