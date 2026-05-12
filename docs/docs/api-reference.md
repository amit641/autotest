---
sidebar_position: 10
---

# API Reference

## Functions

### `generateTests(sourceFile, config, options?)`

Main entry point. Analyzes a source file, generates tests via LLM, optionally verifies them, and writes the test file.

| Parameter | Type | Description |
|---|---|---|
| `sourceFile` | `string` | Path to the source file |
| `config` | `AutotestConfig` | Configuration object |
| `options.dryRun` | `boolean` | If true, don't write the file |
| `options.verify` | `boolean` | If true, run the tests and auto-fix failures |
| `options.maxFixIterations` | `number` | Max auto-fix iterations (default `3`) |
| `options.onChunk` | `(text: string) => void` | Streaming callback |
| `options.onStatus` | `(msg: string) => void` | Status callback (verify-loop progress) |

**Returns:** `Promise<AutotestResult>`

---

### `analyzeFile(filePath)`

Parses a TypeScript/JavaScript file using the TS compiler API and extracts its structure.

**Returns:** `AnalyzedFile`

---

### `gatherImportContext(analysis, maxFiles?, maxCharsPerFile?)`

Follows imports back into the project — both relative paths and tsconfig path aliases — and collects their source as additional context for the LLM. External `node_modules` imports are skipped.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `analysis` | `AnalyzedFile` | — | Output of `analyzeFile` |
| `maxFiles` | `number` | `5` | Max number of related files to include |
| `maxCharsPerFile` | `number` | `3000` | Max characters per related file (truncated if larger) |

**Returns:** `ImportContext[]`

---

### `verifyAndFix(sourceFile, testFile, config, options?)`

Run a generated test file and feed failures back to the LLM for auto-fixing. Tracks the best-failing-count version across iterations and never lets the test file regress; stops early if the failure signature repeats (oscillation).

**Returns:** `Promise<VerifyResult>`

---

### `runTestFile(testFile, framework, cwd?)`

Run a single test file with the given framework's CLI and return parsed results. Throws `FrameworkNotInstalledError` if the framework is not present in the project's `node_modules`.

**Returns:** `TestRunResult`

---

### `loadCoverage(cwd)` / `parseLcov(path, cwd)` / `parseCobertura(path, cwd)`

Parse coverage data from LCOV or Cobertura XML. Returns `CoverageData | null`.

---

### `getUncoveredFiles(coverage, targetRate?)`

Filter and sort coverage data to surface the files that need tests most. Returns `CoverageFile[]` sorted by lowest line-rate first.

---

### `resolveConfig(overrides, cwd?)`

Resolves the final configuration by merging defaults, config file, package.json, and overrides.

**Returns:** `AutotestConfig`

---

### `detectFramework(packageJson)` / `getFrameworkInfo(framework)`

Detect the test framework from a parsed `package.json`, or look up framework metadata.

**Returns:** `TestFramework` / `FrameworkInfo`

---

## Errors

### `FrameworkNotInstalledError`

Thrown by `runTestFile` (and therefore by `verifyAndFix` / `generateTests({ verify: true })`) when the chosen framework's CLI is not installed in the target project.

```typescript
import { FrameworkNotInstalledError } from '@amit641/testpilot-ai';

try {
  await generateTests('src/utils.ts', config, { verify: true });
} catch (err) {
  if (err instanceof FrameworkNotInstalledError) {
    console.error(`Install ${err.framework} in ${err.cwd} first.`);
  }
}
```

---

## Types

### `AutotestConfig`

```typescript
interface AutotestConfig {
  provider: LLMProvider;
  model?: string;
  apiKey?: string;
  framework: TestFramework;
  outDir?: string;
  overwrite: boolean;
  edgeCases: boolean;
  errorHandling: boolean;
  instructions?: string;
  maxTokens: number;
  temperature: number;
}
```

### `LLMProvider`

```typescript
type LLMProvider = 'openai' | 'anthropic' | 'google' | 'ollama';
```

### `TestFramework`

```typescript
type TestFramework = 'vitest' | 'jest' | 'mocha' | 'node';
```

### `AutotestResult`

```typescript
interface AutotestResult {
  sourceFile: string;
  testFile: string;
  testCount: number;
  categories: TestCategory[];
  duration: number;
  tokensUsed: number;
  verified?: boolean;          // present when --verify was used
  verifyIterations?: number;   // present when --verify was used
}
```

### `VerifyResult`

```typescript
interface VerifyResult {
  passed: boolean;
  iterations: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  finalTestCode: string;
}
```

### `AnalyzedFile`

```typescript
interface AnalyzedFile {
  filePath: string;
  fileName: string;
  language: 'typescript' | 'javascript';
  sourceCode: string;
  exports: ExportedSymbol[];
  imports: ImportStatement[];
  dependencies: string[];
}
```

### `ExportedSymbol`

```typescript
interface ExportedSymbol {
  name: string;
  kind: SymbolKind;
  signature: string;
  jsDoc?: string;
  isAsync: boolean;
  isDefault: boolean;
  lineNumber: number;
  parameters?: ParameterInfo[];
  returnType?: string;
}
```

### `ParameterInfo`

```typescript
interface ParameterInfo {
  name: string;
  type?: string;
  optional: boolean;
  defaultValue?: string;
}
```

### `ImportContext`

```typescript
interface ImportContext {
  importPath: string;
  resolvedPath: string;
  specifiers: string[];
  content: string;
}
```

### `TestFailure`

```typescript
interface TestFailure {
  testName: string;
  error: string;
  expected?: string;
  received?: string;
}
```

### `SymbolKind`

```typescript
type SymbolKind =
  | 'function'
  | 'class'
  | 'variable'
  | 'type'
  | 'interface'
  | 'enum'
  | 'arrow-function';
```

---

## Constants

### `DEFAULT_CONFIG`

```typescript
const DEFAULT_CONFIG: AutotestConfig = {
  provider: 'openai',
  framework: 'vitest',
  overwrite: false,
  edgeCases: true,
  errorHandling: true,
  maxTokens: 4096,
  temperature: 0.2,
};
```

### `SUPPORTED_PROVIDERS`

```typescript
const SUPPORTED_PROVIDERS: readonly LLMProvider[] = [
  'openai',
  'anthropic',
  'google',
  'ollama',
];
```

### `PROVIDER_COST_PER_1K_TOKENS`

Per-provider conservative price floor (USD per 1K tokens) used by the `--max-cost` guardrail. Ollama is `0`.

```typescript
const PROVIDER_COST_PER_1K_TOKENS: Record<LLMProvider, number>;
```
