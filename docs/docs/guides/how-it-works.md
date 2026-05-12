---
sidebar_position: 4
---

# How It Works

testpilot-ai treats project knowledge as a **layered, lazy graph**. The agent never sees the whole project — it sees a thin slice that grows only when the previous slice can't answer the next question.

```
Source File → Analyzer → Import Context → Prompt Engine → LLM → Test Writer → Test File
                                                                       ↓
                                                          ┌──── Verify Loop ────┐
                                                          │  Run → Fix → Run    │
                                                          │  (best-version kept)│
                                                          └─────────────────────┘
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

## 2. Bounded Import Context

`gatherImportContext` follows imports back into the project to give the LLM the right types and helpers — without dumping the world into the prompt.

- **Relative imports** (`./helpers`) and **tsconfig path aliases** (`@/lib/foo`, `~lib/*`) are both resolved. The walker reads `tsconfig.json#compilerOptions.paths`, walking up directories until it finds one.
- **External `node_modules` imports are skipped.**
- The walk is bounded to **5 files × 3 KB each**, deduplicated via a `seen` set.
- Each file is labeled in the prompt as *"for context only — do NOT test these"* so the model doesn't burn tokens generating tests for dependencies.

## 3. Prompt Engineering

The **prompt engine** builds two prompts:

### System Prompt
Establishes the LLM's role as an expert test engineer with specific rules:
- Framework-specific syntax (Vitest, Jest, Mocha, Node test runner)
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
- Related-file context (when imports were followed in step 2)

The prompt explicitly tells the LLM *which import line to use* and *which functions to test*, reducing hallucination.

## 4. LLM Generation

The **LLM client** sends prompts via [aiclientjs](https://www.npmjs.com/package/aiclientjs) to any supported provider. It supports:

- **Streaming** — chunks are printed to the terminal in real-time (single-file mode only — see *Concurrency* below)
- **Any provider** — OpenAI, Anthropic, Google, Ollama
- **Token tracking** — reports total tokens used
- **Cost guardrails** — `--max-cost <usd>` aborts before spending if the projected total exceeds the cap (uses a per-provider price table; Ollama is free)

## 5. Test Writing

The **test writer** post-processes the LLM output:

1. **Strips markdown fences** with a line-based fence state machine that survives triple-backtick string literals inside the test code (e.g. when you're testing a markdown parser). Tilde fences and unterminated fences are also handled.
2. **Strips preamble text** — removes "Here are the tests:" type commentary
3. **Counts tests** — parses `it()` and `test()` calls
4. **Categorizes** — groups tests by `describe()` blocks
5. **Writes the file** — creates directories if needed, respects `--overwrite`

## 6. Verify & Auto-Fix Loop *(opt-in)*

When `--verify` is set, testpilot runs the generated tests and feeds failures back to the LLM for fixing.

- **Preflight** — `runTestFile` checks that the chosen framework is actually installed (`node_modules/<framework>`) and throws a `FrameworkNotInstalledError` instead of hanging on an `npx` install prompt.
- **Authoritative pass/fail** — the runner's exit code is the *only* signal that a run passed. Heuristic glyph-counting (`✓` / `×`) was removed because it corrupted counts whenever source code printed a checkmark.
- **Failure consolidation** — vitest, jest, mocha and node:test each emit several markers per logical failure (file-level header, summary line, detailed block). The parser segments names on `>` / `›`, scores each entry by diagnostic detail, and keeps the richest copy per leaf-test-name. ANSI color codes are stripped before parsing.
- **Best-version persistence** — across iterations the loop tracks the smallest-failure-count test file it has seen, and **never lets the file regress beyond it**. If iteration 3 produces strictly worse code than iteration 2, the file is rolled back.
- **Oscillation detection** — if the failure signature is identical to the previous round, the loop stops early instead of paying for another round-trip on the same broken state.
- **Surgical re-context** — the fix prompt drops the import context entirely (failures already pinpoint the gap) and sends only `testName` / `error` / `expected` / `received`, clamped to 500 chars per failure.

## Concurrency

`--concurrency <n>` runs multiple files in parallel. Per-chunk streaming is automatically suppressed when `n > 1` (interleaved streams would be unreadable); per-file completion lines are still printed. A simple worker-pool keeps `n` requests in flight at once.

## Architecture

```
src/
├── analyzer/      # TS AST + import context (relative + tsconfig aliases)
├── prompt/        # Framework-aware prompt generation
├── llm/           # LLM client (via aiclientjs)
├── writer/        # Output parser & file writer (fence state machine)
├── verify/        # Test runner + auto-fix loop (best-version, oscillation)
├── coverage/      # LCOV & Cobertura coverage parsing
├── frameworks/    # Vitest, Jest, Mocha, Node adapters
├── config/        # Config resolution & merging
├── generate.ts    # Main orchestrator
├── cli.ts         # Commander-based CLI (recursive walk, concurrency, max-cost)
├── types.ts       # Core types + LLMProvider + cost table
└── index.ts       # Public API
```

### Design Principles

- **Start narrow, expand on signal** — AST first, 1-hop imports next, full source only for the file under test, and failures only when something actually broke.
- **Trust the exit code, not the regex** — never upgrade a non-zero exit to "passed" based on heuristic parsing.
- **Never regress** — the auto-fix loop preserves the best version it has seen, so verify never makes things strictly worse than your starting point.
- **Bounded context** — every layer has explicit caps (5 files × 3 KB on import context, 500 chars per failure on re-context, configurable `--max-tokens` on LLM output, optional `--max-cost` on the run).
