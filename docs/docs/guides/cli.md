---
sidebar_position: 1
---

# CLI Reference

## Commands

testpilot ships two commands:

| Command | Description |
|---|---|
| `generate <target>` *(default)* | Generate tests for a file or directory |
| `analyze` | Find files that need tests, ranked by coverage |

## `generate`

```bash
testpilot generate [options] <target>
# or, since generate is the default:
testpilot [options] <target>
```

The `target` can be a single file or a directory. When pointing at a directory, testpilot **walks the tree recursively** and generates tests for every `.ts`, `.tsx`, `.js`, `.jsx` file (skipping `.test.*` / `.spec.*` files and conventional ignore directories: `node_modules`, `dist`, `build`, `coverage`, `.git`, `.next`, `.nuxt`, `.svelte-kit`, `.cache`, `docs`).

### Options

| Flag | Description | Default |
|---|---|---|
| `-p, --provider <provider>` | LLM provider: `openai`, `anthropic`, `google`, `ollama`. Unknown values are rejected up-front. | `openai` |
| `-m, --model <model>` | Model to use (e.g. `gpt-4o`, `claude-sonnet-4-20250514`) | Provider default |
| `-k, --api-key <key>` | API key (or use environment variable) | — |
| `-f, --framework <framework>` | Test framework: `vitest`, `jest`, `mocha`, `node` | Auto-detected |
| `-o, --out-dir <dir>` | Output directory for test files | Same as source |
| `--overwrite` | Overwrite existing test files | `false` |
| `--no-edge-cases` | Skip edge case tests | Edge cases enabled |
| `--no-error-handling` | Skip error handling tests | Error handling enabled |
| `--instructions <text>` | Additional instructions for the LLM | — |
| `--max-tokens <n>` | Max tokens for LLM response | `4096` |
| `--temperature <n>` | Temperature for LLM | `0.2` |
| `--dry-run` | Generate tests without writing files | `false` |
| `-s, --stream` | Stream LLM output in real-time (auto-disabled when `--concurrency > 1`) | `true` |
| `--verify` | Run tests after generation and auto-fix failures | `false` |
| `--fix-iterations <n>` | Max auto-fix iterations (with `--verify`) | `3` |
| `-c, --concurrency <n>` | Number of files to process in parallel | `1` |
| `--max-cost <usd>` | Abort the run if estimated cost exceeds this USD amount (uses a per-provider price table) | — |
| `-V, --version` | Output the version number | — |
| `-h, --help` | Display help | — |

### Examples

```bash
# Generate tests for a single file
npx testpilot src/utils.ts

# Generate AND verify — auto-fix until all tests pass
npx testpilot src/utils.ts --verify

# Process an entire directory tree, 4 files in parallel, with a $1 cap
npx testpilot src/ --verify --concurrency 4 --max-cost 1

# Use Anthropic with Claude
npx testpilot src/utils.ts --provider anthropic --model claude-sonnet-4-20250514

# Generate Mocha or Node test-runner tests
npx testpilot src/utils.ts --framework mocha
npx testpilot src/utils.ts --framework node

# Dry run — preview without writing
npx testpilot src/utils.ts --dry-run

# Use local Ollama models (no API key, no cost)
npx testpilot src/utils.ts --provider ollama --model llama3
```

## `analyze`

Find files that most need tests, ranked by lowest coverage first. Reads `coverage/lcov.info` or `coverage/cobertura-coverage.xml` if present; otherwise falls back to "source files without sibling test files."

```bash
testpilot analyze [options]
```

### Options

| Flag | Description | Default |
|---|---|---|
| `-t, --target <rate>` | Coverage target (0–1) | `0.8` |
| `-l, --limit <n>` | Max files to show | `15` |

### Example

```bash
# Get a ranked list of files below 80% coverage
npx vitest run --coverage --reporter=lcov
npx testpilot analyze
```

## Output

`generate` displays:
1. **Header** — provider, model, framework, file count, concurrency, verify status
2. **Cost estimate** — when `--max-cost` is set
3. **Per-file progress** — streaming LLM output (single file at a time) and verify/fix iteration logs
4. **File summary** — test file path, test count, categories, duration, verify status
5. **Final summary** — total tests, files, tokens, time
