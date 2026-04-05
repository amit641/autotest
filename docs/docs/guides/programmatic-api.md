---
sidebar_position: 5
---

# Programmatic API

autotest-ai can be used as a library in your own tools and scripts.

## Installation

```bash
npm install autotest-ai
```

## Generate Tests

```typescript
import { generateTests, resolveConfig } from 'autotest-ai';

const config = resolveConfig({
  provider: 'openai',
  model: 'gpt-4o',
});

const result = await generateTests('src/utils.ts', config);

console.log(`Generated ${result.testCount} tests`);
console.log(`Written to: ${result.testFile}`);
console.log(`Duration: ${result.duration}ms`);
console.log(`Tokens used: ${result.tokensUsed}`);
```

## Analyze a File

```typescript
import { analyzeFile } from 'autotest-ai';

const analysis = analyzeFile('src/utils.ts');

console.log(`File: ${analysis.fileName}`);
console.log(`Language: ${analysis.language}`);
console.log(`Exports: ${analysis.exports.length}`);

for (const exp of analysis.exports) {
  console.log(`  ${exp.kind}: ${exp.name}`);
  if (exp.parameters) {
    for (const param of exp.parameters) {
      console.log(`    - ${param.name}: ${param.type ?? 'any'}`);
    }
  }
}
```

## Resolve Config

```typescript
import { resolveConfig } from 'autotest-ai';

// Merges: defaults < config file < package.json < your overrides
const config = resolveConfig({
  provider: 'anthropic',
  framework: 'jest',
  edgeCases: false,
});
```

## Dry Run (No File Write)

```typescript
import { generateTests, resolveConfig } from 'autotest-ai';

const config = resolveConfig({ provider: 'openai' });

const result = await generateTests('src/utils.ts', config, {
  dryRun: true,
  onChunk: (text) => process.stdout.write(text),
});

// result.testFile shows where it would have been written
// but no file was created
```

## Streaming Callback

```typescript
import { generateTests, resolveConfig } from 'autotest-ai';

const config = resolveConfig({ provider: 'openai' });

const result = await generateTests('src/utils.ts', config, {
  onChunk: (chunk) => {
    // Called for each streamed text chunk
    process.stdout.write(chunk);
  },
});
```

## Framework Detection

```typescript
import { detectFramework, getFrameworkInfo } from 'autotest-ai';

const framework = detectFramework({
  devDependencies: { vitest: '^2.0.0' },
});
// → 'vitest'

const info = getFrameworkInfo('vitest');
console.log(info.runCommand); // 'npx vitest run'
```

## Types

All types are exported for TypeScript usage:

```typescript
import type {
  AutotestConfig,
  AutotestResult,
  AnalyzedFile,
  ExportedSymbol,
  GeneratedTest,
  TestFramework,
  TestCategory,
  ParameterInfo,
  ImportStatement,
  SymbolKind,
} from 'autotest-ai';
```
