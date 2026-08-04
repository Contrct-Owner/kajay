import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import ts from 'typescript';

function property(object, name) {
  return object.properties.find((item) =>
    ts.isPropertyAssignment(item)
    && (ts.isIdentifier(item.name) || ts.isStringLiteral(item.name))
    && item.name.text === name);
}

function stringValue(node) {
  return node !== undefined
    && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ? node.text
    : undefined;
}

function numberValue(node) {
  return node !== undefined && ts.isNumericLiteral(node) ? Number(node.text) : undefined;
}

function stringProperty(object, name) {
  const item = property(object, name);
  return item === undefined ? undefined : stringValue(item.initializer);
}

function stringArray(object, name) {
  const item = property(object, name);
  if (item === undefined || !ts.isArrayLiteralExpression(item.initializer)) return [];
  return item.initializer.elements.map(stringValue).filter((value) => value !== undefined);
}

function tocItems(object) {
  const item = property(object, 'toc');
  if (item === undefined || !ts.isArrayLiteralExpression(item.initializer)) return [];
  return item.initializer.elements
    .filter((element) => ts.isObjectLiteralExpression(element))
    .map((element) => ({
      id: stringProperty(element, 'id'),
      label: stringProperty(element, 'label'),
      depth: numberValue(property(element, 'depth')?.initializer),
    }));
}

function pageFromObject(object, source) {
  const slug = stringProperty(object, 'slug');
  if (slug === undefined || property(object, 'content') === undefined) return;
  return {
    source,
    slug,
    title: stringProperty(object, 'title'),
    description: stringProperty(object, 'description'),
    section: stringProperty(object, 'section'),
    status: stringProperty(object, 'status'),
    audience: stringProperty(object, 'audience'),
    sdk: stringProperty(object, 'sdk'),
    framework: stringProperty(object, 'framework'),
    toc: tocItems(object),
    related: stringArray(object, 'related'),
  };
}

/** Extracts authored page facts without importing React or evaluating module code. */
export function extractPageDefinitionsFromSource(sourceText, source = '<source>') {
  const file = ts.createSourceFile(source, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const pages = [];
  function visit(node) {
    if (ts.isObjectLiteralExpression(node)) {
      const page = pageFromObject(node, source);
      if (page !== undefined) {
        pages.push(page);
        return;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return pages;
}

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return ['.ts', '.tsx'].includes(extname(entry.name)) ? [path] : [];
  });
}

function isAuthoredRegistry(path) {
  const name = path.split('/').at(-1) ?? '';
  return name === 'docsHomePage.tsx' || /(?:DocPages|GuidePages)\.tsx$/u.test(name);
}

export function readAuthoredPageRegistry(repositoryRoot) {
  const features = join(repositoryRoot, 'apps/site/src/features');
  return sourceFiles(features).filter((path) => isAuthoredRegistry(path)).flatMap((path) =>
    extractPageDefinitionsFromSource(readFileSync(path, 'utf8'), relative(repositoryRoot, path)));
}
