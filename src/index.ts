// Public API
export { generateTests } from './generate.js';
export { analyzeFile } from './analyzer/index.js';
export { resolveConfig } from './config/index.js';
export { getFrameworkInfo, detectFramework } from './frameworks/index.js';

export type {
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
} from './types.js';

export { DEFAULT_CONFIG } from './types.js';
