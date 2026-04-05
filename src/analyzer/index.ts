import * as ts from 'typescript';
import { readFileSync } from 'node:fs';
import { basename, extname } from 'node:path';
import type {
  AnalyzedFile,
  ExportedSymbol,
  ImportStatement,
  ParameterInfo,
  SymbolKind,
} from '../types.js';

/**
 * Analyze a source file and extract its exported symbols, imports, and structure.
 * Uses the TypeScript compiler API for accurate parsing.
 */
export function analyzeFile(filePath: string): AnalyzedFile {
  const sourceCode = readFileSync(filePath, 'utf-8');
  const ext = extname(filePath);
  const language = ext === '.ts' || ext === '.tsx' ? 'typescript' : 'javascript';

  const sourceFile = ts.createSourceFile(
    filePath,
    sourceCode,
    ts.ScriptTarget.Latest,
    true,
    ext === '.tsx' || ext === '.jsx' ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const exports: ExportedSymbol[] = [];
  const imports: ImportStatement[] = [];

  visitNode(sourceFile, sourceFile, exports, imports);

  const dependencies = imports
    .filter((i) => !i.isRelative)
    .map((i) => i.source);

  return {
    filePath,
    fileName: basename(filePath),
    language,
    sourceCode,
    exports,
    imports,
    dependencies,
  };
}

function visitNode(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  exports: ExportedSymbol[],
  imports: ImportStatement[],
): void {
  // Import declarations
  if (ts.isImportDeclaration(node) && node.moduleSpecifier) {
    const source = (node.moduleSpecifier as ts.StringLiteral).text;
    const specifiers: string[] = [];

    if (node.importClause) {
      if (node.importClause.name) {
        specifiers.push(node.importClause.name.text);
      }
      if (node.importClause.namedBindings) {
        if (ts.isNamedImports(node.importClause.namedBindings)) {
          for (const el of node.importClause.namedBindings.elements) {
            specifiers.push(el.name.text);
          }
        } else if (ts.isNamespaceImport(node.importClause.namedBindings)) {
          specifiers.push(`* as ${node.importClause.namedBindings.name.text}`);
        }
      }
    }

    imports.push({
      source,
      specifiers,
      isRelative: source.startsWith('.'),
    });
  }

  // Exported function declarations
  if (ts.isFunctionDeclaration(node) && hasExportModifier(node)) {
    const name = node.name?.text ?? 'default';
    exports.push({
      name,
      kind: 'function',
      signature: getSignatureText(node, sourceFile),
      jsDoc: getJSDoc(node, sourceFile),
      isAsync: hasAsyncModifier(node),
      isDefault: hasDefaultModifier(node),
      lineNumber: getLineNumber(node, sourceFile),
      parameters: getParameters(node.parameters, sourceFile),
      returnType: node.type ? node.type.getText(sourceFile) : undefined,
    });
  }

  // Exported class declarations
  if (ts.isClassDeclaration(node) && hasExportModifier(node)) {
    const name = node.name?.text ?? 'default';
    exports.push({
      name,
      kind: 'class',
      signature: getClassSignature(node, sourceFile),
      jsDoc: getJSDoc(node, sourceFile),
      isAsync: false,
      isDefault: hasDefaultModifier(node),
      lineNumber: getLineNumber(node, sourceFile),
    });
  }

  // Exported variable declarations (including arrow functions)
  if (ts.isVariableStatement(node) && hasExportModifier(node)) {
    for (const decl of node.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name)) continue;
      const name = decl.name.text;

      const isArrow = decl.initializer && ts.isArrowFunction(decl.initializer);
      const isFuncExpr = decl.initializer && ts.isFunctionExpression(decl.initializer);

      if (isArrow || isFuncExpr) {
        const func = decl.initializer as ts.ArrowFunction | ts.FunctionExpression;
        exports.push({
          name,
          kind: 'arrow-function',
          signature: getSignatureText(node, sourceFile),
          jsDoc: getJSDoc(node, sourceFile),
          isAsync: hasAsyncModifier(func),
          isDefault: false,
          lineNumber: getLineNumber(node, sourceFile),
          parameters: getParameters(func.parameters, sourceFile),
          returnType: func.type ? func.type.getText(sourceFile) : undefined,
        });
      } else {
        exports.push({
          name,
          kind: 'variable',
          signature: decl.getText(sourceFile),
          jsDoc: getJSDoc(node, sourceFile),
          isAsync: false,
          isDefault: false,
          lineNumber: getLineNumber(node, sourceFile),
        });
      }
    }
  }

  // Exported interfaces and types
  if (ts.isInterfaceDeclaration(node) && hasExportModifier(node)) {
    exports.push({
      name: node.name.text,
      kind: 'interface',
      signature: node.getText(sourceFile),
      isAsync: false,
      isDefault: false,
      lineNumber: getLineNumber(node, sourceFile),
    });
  }

  if (ts.isTypeAliasDeclaration(node) && hasExportModifier(node)) {
    exports.push({
      name: node.name.text,
      kind: 'type',
      signature: node.getText(sourceFile),
      isAsync: false,
      isDefault: false,
      lineNumber: getLineNumber(node, sourceFile),
    });
  }

  if (ts.isEnumDeclaration(node) && hasExportModifier(node)) {
    exports.push({
      name: node.name.text,
      kind: 'enum',
      signature: node.getText(sourceFile),
      isAsync: false,
      isDefault: false,
      lineNumber: getLineNumber(node, sourceFile),
    });
  }

  ts.forEachChild(node, (child) => visitNode(child, sourceFile, exports, imports));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hasExportModifier(node: ts.Node): boolean {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  return modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
}

function hasDefaultModifier(node: ts.Node): boolean {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  return modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword) ?? false;
}

function hasAsyncModifier(node: ts.Node): boolean {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  return modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword) ?? false;
}

function getLineNumber(node: ts.Node, sourceFile: ts.SourceFile): number {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function getSignatureText(node: ts.Node, sourceFile: ts.SourceFile): string {
  const fullText = node.getText(sourceFile);
  const bodyStart = fullText.indexOf('{');
  if (bodyStart === -1) return fullText;
  return fullText.slice(0, bodyStart).trim();
}

function getClassSignature(node: ts.ClassDeclaration, sourceFile: ts.SourceFile): string {
  const lines = node.getText(sourceFile).split('\n');
  const sigLines: string[] = [];
  for (const line of lines) {
    sigLines.push(line);
    if (line.includes('{')) break;
  }
  let sig = sigLines.join('\n');
  const methods = node.members
    .filter((m): m is ts.MethodDeclaration => ts.isMethodDeclaration(m))
    .map((m) => {
      const methodSig = getSignatureText(m, sourceFile);
      return `  ${methodSig}`;
    });

  if (methods.length > 0) {
    sig += '\n' + methods.join('\n') + '\n}';
  }
  return sig;
}

function getJSDoc(node: ts.Node, sourceFile: ts.SourceFile): string | undefined {
  const fullText = sourceFile.getFullText();
  const ranges = ts.getLeadingCommentRanges(fullText, node.getFullStart());
  if (!ranges) return undefined;

  for (const range of ranges) {
    const comment = fullText.slice(range.pos, range.end);
    if (comment.startsWith('/**')) {
      return comment;
    }
  }
  return undefined;
}

function getParameters(
  params: ts.NodeArray<ts.ParameterDeclaration>,
  sourceFile: ts.SourceFile,
): ParameterInfo[] {
  return params.map((p) => ({
    name: p.name.getText(sourceFile),
    type: p.type ? p.type.getText(sourceFile) : undefined,
    optional: !!p.questionToken,
    defaultValue: p.initializer ? p.initializer.getText(sourceFile) : undefined,
  }));
}
