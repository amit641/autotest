---
sidebar_position: 3
---

# Providers

autotest-ai supports multiple LLM providers through [aiclientjs](https://www.npmjs.com/package/aiclientjs).

## Supported Providers

| Provider | Models | Env Variable | Quality |
|---|---|---|---|
| **OpenAI** | gpt-4o, gpt-4o-mini, o1, etc. | `OPENAI_API_KEY` | Excellent |
| **Anthropic** | claude-sonnet-4-20250514, claude-haiku, etc. | `ANTHROPIC_API_KEY` | Excellent |
| **Google** | gemini-pro, gemini-1.5-pro, etc. | `GOOGLE_API_KEY` | Very Good |
| **Ollama** | llama3, codellama, mistral, etc. | None (local) | Good |

## OpenAI

```bash
export OPENAI_API_KEY=sk-...
npx autotest-ai src/utils.ts --provider openai --model gpt-4o
```

**Recommended models:**
- `gpt-4o` — Best quality, higher cost
- `gpt-4o-mini` — Good balance of quality and cost

## Anthropic

```bash
export ANTHROPIC_API_KEY=sk-ant-...
npx autotest-ai src/utils.ts --provider anthropic --model claude-sonnet-4-20250514
```

**Recommended models:**
- `claude-sonnet-4-20250514` — Excellent for code generation
- `claude-haiku` — Faster, lower cost

## Google

```bash
export GOOGLE_API_KEY=...
npx autotest-ai src/utils.ts --provider google --model gemini-1.5-pro
```

## Ollama (Local)

No API key needed. Install [Ollama](https://ollama.ai/) and pull a model:

```bash
ollama pull llama3
npx autotest-ai src/utils.ts --provider ollama --model llama3
```

**Recommended local models:**
- `llama3` — Good general-purpose code understanding
- `codellama` — Optimized for code tasks

:::tip
For the best test quality, use `gpt-4o` or `claude-sonnet-4-20250514`. Local models work but may produce occasional syntax errors or incorrect assertions.
:::

## Passing API Keys

Three ways to provide your API key:

1. **Environment variable** (recommended):
   ```bash
   export OPENAI_API_KEY=sk-...
   ```

2. **CLI flag**:
   ```bash
   npx autotest-ai src/utils.ts --api-key sk-...
   ```

3. **Config file**:
   ```json
   {
     "provider": "openai",
     "apiKey": "sk-..."
   }
   ```

:::caution
Never commit API keys to version control. Use environment variables or `.env` files (add `.env` to `.gitignore`).
:::
