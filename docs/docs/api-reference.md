---
sidebar_position: 10
---

# API Reference

## Functions

### `generateTests(sourceFile, config, options?)`

Main entry point. Analyzes a source file, generates tests via LLM, and writes the test file.

| Parameter | Type | Description |
|---|---|---|
| `sourceFile` | `string` | Path to the source file |
| `config` | `AutotestConfig` | Configuration object |
| `options.dryRun` | `boolean` | If true, don't write the file |
| `options.onChunk` | `(text: string) => void` | Streaming callback |

**Returns:** `Promise<AutotestResult>`

---

### `analyzeFile(filePath)`

Parses a TypeScript/JavaScript file using the TS compiler API and extracts its structure.

| Parameter | Type | Description |
|---|---|---|
| `filePath` | `string` | Path to the source file |

**Returns:** `AnalyzedFile`

---

### `resolveConfig(overrides, cwd?)`

Resolves the final configuration by merging defaults, config file, package.json, and overrides.

| Parameter | Type | Description |
|---|---|---|
| `overrides` | `Partial<AutotestConfig>` | CLI flags or manual overrides |
| `cwd` | `string` | Working directory (default: `process.cwd()`) |

**Returns:** `AutotestConfig`

---

### `detectFramework(packageJson)`

Detects the test framework from a parsed package.json object.

**Returns:** `TestFramework` (`'vitest'` or `'jest'`)

---

### `getFrameworkInfo(framework)`

Returns metadata about a test framework.

**Returns:** `FrameworkInfo`

---

## Types

### `AutotestConfig`

```typescript
interface AutotestConfig {
  provider: string;
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

### `AutotestResult`

```typescript
interface AutotestResult {
  sourceFile: string;
  testFile: string;
  testCount: number;
  categories: TestCategory[];
  duration: number;
  tokensUsed: number;
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

### `TestFramework`

```typescript
type TestFramework = 'vitest' | 'jest';
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
