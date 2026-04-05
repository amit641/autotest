// Public API
export { generateTests } from './generate.js';
export { analyzeFile } from './analyzer/index.js';
export { gatherImportContext } from './analyzer/context.js';
export { resolveConfig } from './config/index.js';
export { getFrameworkInfo, detectFramework } from './frameworks/index.js';
export { verifyAndFix, runTestFile } from './verify/index.js';
export { loadCoverage, getUncoveredFiles, parseLcov, parseCobertura } from './coverage/index.js';

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

export type {
  TestRunResult,
  TestFailure,
} from './verify/index.js';

export type {
  CoverageData,
  CoverageFile,
} from './coverage/index.js';

export type {
  ImportContext,
} from './analyzer/context.js';
