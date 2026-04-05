---
sidebar_position: 2
---

# Configuration

testpilot-ai supports multiple configuration methods with a clear priority order.

## Priority Order

```
CLI flags > Config file > package.json "autotest" field > Auto-detected framework > Defaults
```

## Config File

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

### Supported file names

- `autotest.config.json`
- `.autotestrc`
- `.autotestrc.json`

## package.json

Add an `autotest` field to your `package.json`:

```json
{
  "name": "my-project",
  "autotest": {
    "provider": "openai",
    "model": "gpt-4o",
    "framework": "vitest"
  }
}
```

## Framework Auto-Detection

testpilot-ai automatically detects your test framework from `package.json`:

- If `vitest` is in `devDependencies` → uses Vitest
- If `jest` or `@jest/core` is in `devDependencies` → uses Jest
- If the `test` script contains `vitest` or `jest` → uses that framework
- Default → Vitest

## Environment Variables

API keys are resolved from standard environment variables:

| Provider | Environment Variable |
|---|---|
| OpenAI | `OPENAI_API_KEY` |
| Anthropic | `ANTHROPIC_API_KEY` |
| Google | `GOOGLE_API_KEY` |
| Ollama | None needed (local) |

## All Configuration Options

| Option | Type | Default | Description |
|---|---|---|---|
| `provider` | `string` | `"openai"` | LLM provider |
| `model` | `string` | Provider default | Model name |
| `apiKey` | `string` | From env var | API key |
| `framework` | `"vitest" \| "jest"` | Auto-detected | Test framework |
| `outDir` | `string` | Same as source | Output directory |
| `overwrite` | `boolean` | `false` | Overwrite existing tests |
| `edgeCases` | `boolean` | `true` | Include edge case tests |
| `errorHandling` | `boolean` | `true` | Include error handling tests |
| `instructions` | `string` | — | Custom LLM instructions |
| `maxTokens` | `number` | `4096` | Max LLM tokens |
| `temperature` | `number` | `0.2` | LLM temperature |
