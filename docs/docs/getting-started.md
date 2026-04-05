---
sidebar_position: 2
---

# Getting Started

## Installation

```bash
npm install -D @amit641/testpilot-ai
```

Or use it directly with npx:

```bash
npx testpilot src/utils.ts
```

## Prerequisites

- **Node.js 18+**
- An API key for your preferred LLM provider (or Ollama for local models)

## Set Up Your API Key

```bash
# OpenAI
export OPENAI_API_KEY=sk-...

# Anthropic
export ANTHROPIC_API_KEY=sk-ant-...

# Google
export GOOGLE_API_KEY=...

# Ollama — no key needed (local)
```

## Generate Your First Test

Given a file `src/math.ts`:

```typescript
export function add(a: number, b: number): number {
  return a + b;
}

export function divide(a: number, b: number): number {
  if (b === 0) throw new Error('Cannot divide by zero');
  return a / b;
}
```

Run:

```bash
npx testpilot src/math.ts --provider openai
```

This generates `src/math.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { add, divide } from './math';

describe('add', () => {
  it('adds two positive numbers', () => {
    expect(add(2, 3)).toBe(5);
  });

  it('adds negative numbers', () => {
    expect(add(-1, -2)).toBe(-3);
  });

  it('handles zero', () => {
    expect(add(0, 5)).toBe(5);
  });
});

describe('divide', () => {
  it('divides two numbers', () => {
    expect(divide(10, 2)).toBe(5);
  });

  it('throws on division by zero', () => {
    expect(() => divide(10, 0)).toThrow('Cannot divide by zero');
  });
});
```

## Generate Tests for a Directory

```bash
npx testpilot src/helpers/
```

This generates test files for every `.ts`, `.tsx`, `.js`, `.jsx` file in the directory (skipping existing test files).

## Using Local Models

If you have [Ollama](https://ollama.ai/) installed:

```bash
npx testpilot src/utils.ts --provider ollama --model llama3
```

No API key needed — everything runs locally.
