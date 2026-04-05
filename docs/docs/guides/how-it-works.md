---
sidebar_position: 4
---

# How It Works

autotest-ai uses a four-stage pipeline to generate tests:

```
Source File → Analyzer → Prompt Engine → LLM → Test Writer → Test File
```

## 1. Code Analysis

The **analyzer** uses the TypeScript compiler API (`ts.createSourceFile`) to parse your source file into an AST. It extracts:

- **Exported functions** — name, parameters (types, optional, defaults), return type, async flag
- **Exported classes** — name, method signatures
- **Arrow functions** — treated like regular functions
- **Interfaces & types** — skipped for test generation but included as context
- **Enums** — included
- **Imports** — tracked to understand dependencies
- **JSDoc comments** — passed to the LLM for better understanding

This AST-based approach is far more reliable than regex-based or heuristic parsing. It handles TypeScript generics, overloads, decorators, and complex type annotations correctly.

## 2. Prompt Engineering

The **prompt engine** builds two prompts:

### System Prompt
Establishes the LLM's role as an expert test engineer with specific rules:
- Framework-specific syntax (Vitest vs Jest)
- Import conventions
- Mocking strategies
- Test structure guidelines

### User Prompt
Contains the actual analysis with:
- File metadata (name, language)
- Each exported symbol with full type information
- The exact import line to use
- Edge case and error handling requirements
- The complete source code

The prompt explicitly tells the LLM *which import line to use* and *which functions to test*, reducing hallucination.

## 3. LLM Generation

The **LLM client** sends prompts via [aiclientjs](https://www.npmjs.com/package/aiclientjs) to any supported provider. It supports:

- **Streaming** — chunks are printed to the terminal in real-time
- **Any provider** — OpenAI, Anthropic, Google, Ollama
- **Token tracking** — reports total tokens used

## 4. Test Writing

The **test writer** post-processes the LLM output:

1. **Strips markdown fences** — LLMs often wrap code in ` ```typescript ` blocks
2. **Strips preamble text** — removes "Here are the tests:" type commentary
3. **Counts tests** — parses `it()` and `test()` calls
4. **Categorizes** — groups tests by `describe()` blocks
5. **Writes the file** — creates directories if needed, respects `--overwrite`

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

### Design Principles

- **Single Responsibility** — Each module has one clear job
- **Open/Closed** — Add new providers or frameworks without modifying existing code
- **Dependency Inversion** — Core logic depends on abstractions (aiclientjs handles provider details)
- **Zero magic** — Transparent AST analysis, no hidden heuristics
