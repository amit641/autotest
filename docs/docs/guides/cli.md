---
sidebar_position: 1
---

# CLI Reference

## Usage

```bash
autotest [options] <target>
```

The `target` can be a single file or a directory. When pointing at a directory, autotest generates tests for all `.ts`, `.tsx`, `.js`, `.jsx` files (excluding existing test/spec files).

## Options

| Flag | Description | Default |
|---|---|---|
| `-p, --provider <provider>` | LLM provider: `openai`, `anthropic`, `google`, `ollama` | `openai` |
| `-m, --model <model>` | Model to use (e.g. `gpt-4o`, `claude-sonnet-4-20250514`) | Provider default |
| `-k, --api-key <key>` | API key (or use environment variable) | — |
| `-f, --framework <framework>` | Test framework: `vitest` or `jest` | Auto-detected |
| `-o, --out-dir <dir>` | Output directory for test files | Same as source |
| `--overwrite` | Overwrite existing test files | `false` |
| `--no-edge-cases` | Skip edge case tests | Edge cases enabled |
| `--no-error-handling` | Skip error handling tests | Error handling enabled |
| `--instructions <text>` | Additional instructions for the LLM | — |
| `--max-tokens <n>` | Max tokens for LLM response | `4096` |
| `--temperature <n>` | Temperature for LLM | `0.2` |
| `--dry-run` | Generate tests without writing files | `false` |
| `-s, --stream` | Stream LLM output in real-time | `true` |
| `-V, --version` | Output the version number | — |
| `-h, --help` | Display help | — |

## Examples

```bash
# Generate tests for a single file
npx autotest-ai src/utils.ts

# Use Anthropic with Claude
npx autotest-ai src/utils.ts --provider anthropic --model claude-sonnet-4-20250514

# Generate Jest tests
npx autotest-ai src/utils.ts --framework jest

# Process an entire directory
npx autotest-ai src/helpers/

# Dry run — preview without writing
npx autotest-ai src/utils.ts --dry-run

# Use local Ollama models
npx autotest-ai src/utils.ts --provider ollama --model llama3

# Overwrite existing test files
npx autotest-ai src/utils.ts --overwrite

# Custom instructions
npx autotest-ai src/utils.ts --instructions "Test with French locale strings"

# Redirect output to a specific directory
npx autotest-ai src/utils.ts --out-dir tests/
```

## Output

autotest-ai displays:
1. **Header** — provider, model, framework, file count
2. **Progress** — streaming LLM output per file
3. **File summary** — test file path, test count, categories, duration
4. **Final summary** — total tests, files, tokens, time
