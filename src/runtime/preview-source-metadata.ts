import { createHash } from 'node:crypto';
import path from 'node:path';

import ts from 'typescript';
import type { Plugin } from 'vite';

const SOURCE_EXTENSIONS = new Set(['.tsx', '.jsx']);
const SOURCE_ID_ATTRIBUTE = 'data-yakable-source-id';

interface SourceInsertion {
  offset: number;
  value: string;
}

function stripViteQuery(id: string): string {
  const queryIndex = id.indexOf('?');
  const hashIndex = id.indexOf('#');
  const end = [queryIndex, hashIndex]
    .filter((value) => value >= 0)
    .reduce((current, value) => Math.min(current, value), id.length);
  return id.slice(0, end);
}

function isInsideDirectory(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative !== '' &&
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

function toProjectRelativePath(projectRoot: string, filePath: string): string {
  return path.relative(projectRoot, filePath).split(path.sep).join('/');
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function sourceId(file: string, line: number, column: number, tagName: string): string {
  const digest = createHash('sha1')
    .update(`${file}:${line}:${column}:${tagName}`)
    .digest('hex')
    .slice(0, 12);
  return `yak_${digest}`;
}

function scriptKindFor(filePath: string): ts.ScriptKind {
  return path.extname(filePath).toLowerCase() === '.jsx'
    ? ts.ScriptKind.JSX
    : ts.ScriptKind.TSX;
}

function isIntrinsicTagName(tagName: ts.JsxTagNameExpression): tagName is ts.Identifier {
  return ts.isIdentifier(tagName) && /^[a-z]/.test(tagName.text);
}

function hasSourceIdAttribute(
  node: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
): boolean {
  return node.attributes.properties.some(
    (property) =>
      ts.isJsxAttribute(property) && property.name.getText() === SOURCE_ID_ATTRIBUTE,
  );
}

function sourceMetadataFor(
  sourceFile: ts.SourceFile,
  projectRelativeFile: string,
  node: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
): string | null {
  if (!isIntrinsicTagName(node.tagName) || hasSourceIdAttribute(node)) {
    return null;
  }

  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  const line = position.line + 1;
  const column = position.character + 1;
  const tagName = node.tagName.text;
  const id = sourceId(projectRelativeFile, line, column, tagName);
  const source = `${projectRelativeFile}:${line}:${column}`;

  return [
    ` ${SOURCE_ID_ATTRIBUTE}="${id}"`,
    ` data-yakable-source="${escapeHtmlAttribute(source)}"`,
    ` data-yakable-source-file="${escapeHtmlAttribute(projectRelativeFile)}"`,
    ` data-yakable-source-line="${line}"`,
    ` data-yakable-source-column="${column}"`,
  ].join('');
}

export function instrumentPreviewSource(
  code: string,
  filePath: string,
  projectRoot: string,
): string | null {
  const cleanFilePath = stripViteQuery(filePath);
  const absoluteRoot = path.resolve(projectRoot);
  const absoluteFile = path.resolve(cleanFilePath);
  const extension = path.extname(absoluteFile).toLowerCase();

  if (!SOURCE_EXTENSIONS.has(extension) || !isInsideDirectory(absoluteRoot, absoluteFile)) {
    return null;
  }

  const projectRelativeFile = toProjectRelativePath(absoluteRoot, absoluteFile);
  const sourceFile = ts.createSourceFile(
    absoluteFile,
    code,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(absoluteFile),
  );
  const insertions: SourceInsertion[] = [];

  function visit(node: ts.Node): void {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const metadata = sourceMetadataFor(sourceFile, projectRelativeFile, node);
      if (metadata) {
        insertions.push({ offset: node.tagName.getEnd(), value: metadata });
      }
    }
    node.forEachChild(visit);
  }

  visit(sourceFile);
  if (insertions.length === 0) {
    return null;
  }

  let output = code;
  insertions
    .sort((left, right) => right.offset - left.offset)
    .forEach((insertion) => {
      output = `${output.slice(0, insertion.offset)}${insertion.value}${output.slice(insertion.offset)}`;
    });

  return output;
}

export function previewSourceMetadataPlugin(projectRoot: string): Plugin {
  return {
    name: 'yakable-preview-source-metadata',
    enforce: 'pre',
    transform(code, id) {
      const transformed = instrumentPreviewSource(code, id, projectRoot);
      if (!transformed) return null;
      return { code: transformed, map: null };
    },
  };
}
