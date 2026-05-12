// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export type LLMProvider = 'openai' | 'anthropic' | 'google' | 'ollama';

export const SUPPORTED_PROVIDERS: readonly LLMProvider[] = [
  'openai',
  'anthropic',
  'google',
  'ollama',
] as const;

export interface AutotestConfig {
  /** LLM provider */
  provider: LLMProvider;
  /** Model to use, e.g. 'gpt-4o', 'claude-sonnet-4-20250514' */
  model?: string;
  /** API key (or use env var) */
  apiKey?: string;
  /** Test framework: 'vitest' | 'jest' | 'mocha' | 'node' */
  framework: TestFramework;
  /** Output directory for test files (default: same dir as source) */
  outDir?: string;
  /** Overwrite existing test files */
  overwrite: boolean;
  /** Include edge case tests */
  edgeCases: boolean;
  /** Include error handling tests */
  errorHandling: boolean;
  /** Additional context/instructions for the LLM */
  instructions?: string;
  /** Max tokens for LLM response */
  maxTokens: number;
  /** Temperature for LLM */
  temperature: number;
}

export type TestFramework = 'vitest' | 'jest' | 'mocha' | 'node';

export const DEFAULT_CONFIG: AutotestConfig = {
  provider: 'openai',
  framework: 'vitest',
  overwrite: false,
  edgeCases: true,
  errorHandling: true,
  maxTokens: 4096,
  temperature: 0.2,
};

/**
 * Approximate USD per 1K tokens (input/output averaged) for cost guardrails.
 * These are deliberate floors-of-magnitude estimates — kept conservative so the
 * `--max-cost` check errs on the side of warning earlier rather than later.
 */
export const PROVIDER_COST_PER_1K_TOKENS: Record<LLMProvider, number> = {
  openai: 0.005,
  anthropic: 0.008,
  google: 0.0035,
  ollama: 0,
};

// ---------------------------------------------------------------------------
// Code Analysis
// ---------------------------------------------------------------------------

export interface AnalyzedFile {
  filePath: string;
  fileName: string;
  language: 'typescript' | 'javascript';
  sourceCode: string;
  exports: ExportedSymbol[];
  imports: ImportStatement[];
  dependencies: string[];
}

export interface ExportedSymbol {
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

export type SymbolKind =
  | 'function'
  | 'class'
  | 'variable'
  | 'type'
  | 'interface'
  | 'enum'
  | 'arrow-function';

export interface ParameterInfo {
  name: string;
  type?: string;
  optional: boolean;
  defaultValue?: string;
}

export interface ImportStatement {
  source: string;
  specifiers: string[];
  isRelative: boolean;
}

// ---------------------------------------------------------------------------
// Test Generation
// ---------------------------------------------------------------------------

export interface GeneratedTest {
  sourceFile: string;
  testFile: string;
  testCode: string;
  testCount: number;
  categories: TestCategory[];
}

export interface TestCategory {
  name: string;
  count: number;
}

// ---------------------------------------------------------------------------
// Generation Result
// ---------------------------------------------------------------------------

export interface AutotestResult {
  sourceFile: string;
  testFile: string;
  testCount: number;
  categories: TestCategory[];
  duration: number;
  tokensUsed: number;
  verified?: boolean;
  verifyIterations?: number;
}
