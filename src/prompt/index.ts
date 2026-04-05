import type { AnalyzedFile, AutotestConfig, ExportedSymbol } from '../types.js';

/**
 * Build a system prompt for the LLM that establishes the test-generation role.
 */
export function buildSystemPrompt(config: AutotestConfig): string {
  const framework = config.framework;
  const importStyle = framework === 'vitest'
    ? `import { describe, it, expect, vi } from 'vitest';`
    : `// Jest globals are available`;

  const vitestImport = `import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';`;

  return `You are an expert test engineer. You write comprehensive, production-quality ${framework} tests.

Rules:
- Use ${framework} syntax and conventions
- ${framework === 'vitest' ? `ALWAYS start with: ${vitestImport}` : 'Jest globals (describe, it, expect, jest) are available — do not import them'}
- Write ONLY the test code — no explanations, no markdown fences, no commentary
- Use descriptive test names that explain the expected behavior
- Group related tests in describe blocks
- Test both happy paths and edge cases
- Test error conditions and boundary values
- Mock external dependencies when needed
- Use ${framework === 'vitest' ? 'vi.fn()' : 'jest.fn()'} for mocking
- Prefer ${framework === 'vitest' ? "vi.spyOn" : "jest.spyOn"} over manual mocks
- Import the module under test using the EXACT relative path provided
- Ensure all tests are independent and can run in any order
${config.instructions ? `\nAdditional instructions: ${config.instructions}` : ''}`;
}

/**
 * Build the user prompt with the actual source code and analysis.
 */
export function buildUserPrompt(
  analysis: AnalyzedFile,
  config: AutotestConfig,
): string {
  const testableExports = analysis.exports.filter(
    (e) => e.kind !== 'type' && e.kind !== 'interface',
  );

  if (testableExports.length === 0) {
    return buildSimplePrompt(analysis);
  }

  const sections: string[] = [];

  sections.push(`Generate comprehensive ${config.framework} tests for the following file.`);
  sections.push(`\nFile: ${analysis.fileName}`);
  sections.push(`Language: ${analysis.language}`);

  // Describe what to test
  sections.push('\n## Exported Symbols to Test\n');
  for (const sym of testableExports) {
    sections.push(formatSymbolForPrompt(sym));
  }

  // Build the exact import line the LLM should use
  const importPath = `./${analysis.fileName.replace(/\.(ts|tsx|js|jsx)$/, '')}`;
  const exportNames = testableExports.map((e) => e.isDefault ? `default as ${e.name}` : e.name);
  const importLine = `import { ${exportNames.join(', ')} } from '${importPath}';`;

  // Requirements
  sections.push('\n## Requirements\n');
  sections.push(`- Your test file MUST start with this exact import:\n  ${importLine}`);
  sections.push(`- Import each function/class by name — do NOT use side-effect imports like \`import '${importPath}'\``);

  if (config.edgeCases) {
    sections.push('- Include edge case tests for boundary values (empty strings, 0, negative numbers, large inputs)');
    sections.push('- Only test null/undefined if the source code explicitly handles them — JavaScript coerces null/undefined in arithmetic, so do NOT assume they throw');
  }
  if (config.errorHandling) {
    sections.push('- Include error handling tests ONLY for errors explicitly thrown in the source code');
    sections.push('- Read the source code carefully — only use toThrow/toThrowError for functions that actually have throw statements');
  }

  const asyncExports = testableExports.filter((e) => e.isAsync);
  if (asyncExports.length > 0) {
    sections.push(`- Use async/await for testing: ${asyncExports.map((e) => e.name).join(', ')}`);
  }

  // Full source code as context
  sections.push('\n## Full Source Code\n');
  sections.push('```' + analysis.language);
  sections.push(analysis.sourceCode);
  sections.push('```');

  sections.push('\nGenerate the test file now. Output ONLY valid test code, nothing else.');

  return sections.join('\n');
}

function buildSimplePrompt(analysis: AnalyzedFile): string {
  return `Generate comprehensive tests for the following ${analysis.language} file.

File: ${analysis.fileName}
Import from: './${analysis.fileName.replace(/\.(ts|tsx|js|jsx)$/, '')}'

\`\`\`${analysis.language}
${analysis.sourceCode}
\`\`\`

Generate the test file now. Output ONLY valid test code, nothing else.`;
}

function formatSymbolForPrompt(sym: ExportedSymbol): string {
  const parts: string[] = [];
  const prefix = sym.isDefault ? '(default export) ' : '';

  switch (sym.kind) {
    case 'function':
    case 'arrow-function': {
      parts.push(`### ${prefix}\`${sym.name}\` (${sym.isAsync ? 'async ' : ''}function)`);
      if (sym.parameters?.length) {
        const params = sym.parameters
          .map((p) => `  - \`${p.name}\`: ${p.type ?? 'any'}${p.optional ? ' (optional)' : ''}${p.defaultValue ? ` = ${p.defaultValue}` : ''}`)
          .join('\n');
        parts.push(`Parameters:\n${params}`);
      }
      if (sym.returnType) {
        parts.push(`Returns: \`${sym.returnType}\``);
      }
      break;
    }
    case 'class': {
      parts.push(`### ${prefix}\`${sym.name}\` (class)`);
      parts.push(`Signature:\n\`\`\`\n${sym.signature}\n\`\`\``);
      break;
    }
    case 'variable': {
      parts.push(`### \`${sym.name}\` (exported variable)`);
      break;
    }
    case 'enum': {
      parts.push(`### \`${sym.name}\` (enum)`);
      break;
    }
  }

  if (sym.jsDoc) {
    parts.push(`Documentation: ${sym.jsDoc}`);
  }

  return parts.join('\n') + '\n';
}
