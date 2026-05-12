---
sidebar_position: 5
---

# Programmatic API

testpilot-ai can be used as a library in your own tools and scripts.

## Installation

```bash
npm install @amit641/testpilot-ai
```

## Generate Tests

```typescript
import { generateTests, resolveConfig } from '@amit641/testpilot-ai';

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

## Generate with Verify & Auto-Fix

```typescript
import { generateTests, resolveConfig, FrameworkNotInstalledError } from '@amit641/testpilot-ai';

const config = resolveConfig({ provider: 'openai', framework: 'vitest' });

try {
  const result = await generateTests('src/utils.ts', config, {
    verify: true,
    maxFixIterations: 3,
    onStatus: (msg) => console.log(msg),
  });

  if (result.verified) {
    console.log(`All ${result.testCount} tests pass after ${result.verifyIterations} iteration(s).`);
  } else {
    console.log(`Best version persisted with ${result.testCount} tests; some still fail.`);
  }
} catch (err) {
  if (err instanceof FrameworkNotInstalledError) {
    console.error(`Install ${err.framework} in ${err.cwd} first.`);
  } else {
    throw err;
  }
}
```

> The verify loop tracks the best version observed across iterations and never lets the test file regress. If iteration 3 produces strictly worse code than iteration 2, the file is rolled back automatically.

## Analyze a File

```typescript
import { analyzeFile } from '@amit641/testpilot-ai';

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
import { resolveConfig } from '@amit641/testpilot-ai';

// Merges: defaults < config file < package.json < your overrides
const config = resolveConfig({
  provider: 'anthropic',
  framework: 'jest',
  edgeCases: false,
});
```

## Dry Run (No File Write)

```typescript
import { generateTests, resolveConfig } from '@amit641/testpilot-ai';

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
import { generateTests, resolveConfig } from '@amit641/testpilot-ai';

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
import { detectFramework, getFrameworkInfo } from '@amit641/testpilot-ai';

const framework = detectFramework({
  devDependencies: { vitest: '^2.0.0' },
});
// → 'vitest'

const info = getFrameworkInfo('vitest');
console.log(info.runCommand); // 'npx vitest run'
```

## Coverage-Driven Discovery

```typescript
import { loadCoverage, getUncoveredFiles } from '@amit641/testpilot-ai';

const coverage = loadCoverage(process.cwd());
if (coverage) {
  const targets = getUncoveredFiles(coverage, 0.8).slice(0, 5);
  for (const file of targets) {
    console.log(`${file.relativePath}: ${(file.lineRate * 100).toFixed(1)}%`);
  }
}
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
  LLMProvider,
} from '@amit641/testpilot-ai';

import {
  DEFAULT_CONFIG,
  SUPPORTED_PROVIDERS,
  PROVIDER_COST_PER_1K_TOKENS,
} from '@amit641/testpilot-ai';
```
