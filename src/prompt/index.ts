import type { AnalyzedFile, AutotestConfig, ExportedSymbol } from '../types.js';
import type { ImportContext } from '../analyzer/context.js';

/**
 * Build a system prompt for the LLM that establishes the test-generation role.
 */
export function buildSystemPrompt(config: AutotestConfig): string {
  const framework = config.framework;

  const frameworkRules: Record<string, string> = {
    vitest: `- ALWAYS start with: import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
- Use vi.fn() for mocking, vi.spyOn for spying`,
    jest: `- Jest globals (describe, it, expect, jest) are available — do not import them
- Use jest.fn() for mocking, jest.spyOn for spying`,
    mocha: `- ALWAYS start with: import { describe, it } from 'mocha'; import { expect } from 'chai';
- Use sinon for mocking if needed`,
    node: `- ALWAYS start with: import { describe, it } from 'node:test'; import assert from 'node:assert/strict';
- Use assert.strictEqual, assert.throws, assert.deepStrictEqual
- Use t.mock for mocking`,
  };

  return `You are an expert test engineer. You write comprehensive, production-quality ${framework} tests.

Rules:
- Use ${framework} syntax and conventions
${frameworkRules[framework] ?? frameworkRules['vitest']}
- Write ONLY the test code — no explanations, no markdown fences, no commentary
- Use descriptive test names that explain the expected behavior
- Group related tests in describe blocks
- Test both happy paths and edge cases
- Test error conditions and boundary values
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
  importContexts?: ImportContext[],
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

  // Import context — related files for better understanding
  if (importContexts && importContexts.length > 0) {
    sections.push('\n## Related Files (for context only — do NOT test these)\n');
    for (const ctx of importContexts) {
      sections.push(`### ${ctx.importPath} (imports: ${ctx.specifiers.join(', ')})\n`);
      sections.push('```' + analysis.language);
      sections.push(ctx.content);
      sections.push('```\n');
    }
  }

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
