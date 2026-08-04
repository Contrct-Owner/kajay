import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import ts from 'typescript';

/** Reads the package globs owned by pnpm rather than maintaining a second list. */
export function workspacePackagePatterns(repoRoot) {
  const source = readFileSync(join(repoRoot, 'pnpm-workspace.yaml'), 'utf8');
  const patterns = [];
  let packagesIndent;
  for (const line of source.split('\n')) {
    const heading = /^(\s*)packages:\s*(?:#.*)?$/u.exec(line);
    if (heading !== null) {
      packagesIndent = heading[1].length;
      continue;
    }
    if (packagesIndent === undefined || /^\s*(?:#.*)?$/u.test(line)) {
      continue;
    }
    const indent = /^\s*/u.exec(line)?.[0].length ?? 0;
    if (indent <= packagesIndent) {
      break;
    }
    const item = /^\s*-\s*(['"]?)([^'"#]+)\1\s*(?:#.*)?$/u.exec(line);
    if (item === null) {
      throw new Error(`Unsupported pnpm workspace package entry: ${line.trim()}`);
    }
    patterns.push(item[2].trim());
  }
  if (packagesIndent === undefined || patterns.length === 0) {
    throw new Error('pnpm-workspace.yaml must declare a non-empty packages list.');
  }
  return patterns;
}

function segmentMatcher(segment) {
  let pattern = '^';
  for (const character of segment) {
    if (character === '*') {
      pattern += '[^/]*';
    } else if (character === '?') {
      pattern += '[^/]';
    } else {
      pattern += character.replaceAll(/[\\^$.*+?()[\]{}|]/gu, '\\$&');
    }
  }
  return new RegExp(`${pattern}$`, 'u');
}

function childDirectories(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(dir, entry.name));
  } catch {
    return [];
  }
}

function expandPattern(repoRoot, pattern) {
  const matches = [];
  const segments = pattern.replace(/^\.\//u, '').split('/').filter(Boolean);
  const walk = (dir, index) => {
    if (index === segments.length) {
      if (existsSync(join(dir, 'package.json'))) {
        matches.push(dir);
      }
      return;
    }
    const segment = segments[index];
    if (segment === '**') {
      walk(dir, index + 1);
      for (const child of childDirectories(dir)) {
        walk(child, index);
      }
      return;
    }
    const matcher = segmentMatcher(segment);
    for (const child of childDirectories(dir)) {
      if (matcher.test(basename(child))) {
        walk(child, index + 1);
      }
    }
  };
  walk(repoRoot, 0);
  return matches;
}

/** Workspace package directories expanded from `pnpm-workspace.yaml`. */
export function listWorkspaceDirs(repoRoot) {
  const included = new Set();
  const excluded = new Set();
  for (const entry of workspacePackagePatterns(repoRoot)) {
    const negative = entry.startsWith('!');
    const pattern = negative ? entry.slice(1) : entry;
    for (const dir of expandPattern(repoRoot, pattern)) {
      (negative ? excluded : included).add(dir);
    }
  }
  return [...included].filter((dir) => !excluded.has(dir)).toSorted();
}

/** TypeScript sources under `dir`, skipping node_modules, dist and declaration files. */
export function listSourceFiles(dir) {
  const files = [];
  const walk = (current) => {
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== 'dist') {
          walk(full);
        }
      } else if (/\.(?:ts|tsx|mts)$/u.test(entry.name) && !entry.name.endsWith('.d.ts')) {
        files.push(full);
      }
    }
  };
  walk(dir);
  return files;
}

/** JavaScript and TypeScript modules under a repository automation directory. */
export function listModuleFiles(dir) {
  const files = [];
  const walk = (current) => {
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== 'dist') {
          walk(full);
        }
      } else if (/\.(?:cjs|js|mjs|mts|ts)$/u.test(entry.name) && !entry.name.endsWith('.d.ts')) {
        files.push(full);
      }
    }
  };
  walk(dir);
  return files;
}

/**
 * A plausible module specifier: a relative path, a `node:` builtin, or a package name
 * with an optional subpath. Nothing with whitespace in it.
 */
const MODULE_SPECIFIER = /^(?:\.{1,2}\/[^\s]*|node:[\w/.-]+|(?:@[\w.-]+\/)?[\w.-]+(?:\/[\w.@*-]+)*)$/u;

/**
 * Removes comments, leaving string literals intact.
 *
 * Both scanners below read *code*. Prose that happens to look like code is the one
 * thing they must not act on: the DOM-free rule once failed the build over the phrase
 * "in document order", and the dependency scanner over a sentence containing
 * `from "false"`. A checker that fires on comments teaches people to reword their
 * comments, which is worse than not having the checker.
 *
 * Deliberately not a regex: `//` inside a string is not a comment, and a stripper that
 * mangled strings would start missing the real thing it exists to catch.
 */
export function stripComments(source) {
  let out = '';
  let mode = 'code';
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];
    if (mode === 'code') {
      if (char === '/' && next === '/') {
        mode = 'line';
        index += 2;
      } else if (char === '/' && next === '*') {
        mode = 'block';
        index += 2;
      } else {
        if (char === "'" || char === '"' || char === '`') {
          mode = char;
        }
        out += char;
        index += 1;
      }
    } else if (mode === 'line') {
      if (char === '\n') {
        mode = 'code';
        out += char;
      }
      index += 1;
    } else if (mode === 'block') {
      if (char === '*' && next === '/') {
        mode = 'code';
        index += 2;
      } else {
        index += 1;
      }
    } else if (char === '\\') {
      out += char + (next ?? '');
      index += 2;
    } else {
      if (char === mode) {
        mode = 'code';
      }
      out += char;
      index += 1;
    }
  }
  return out;
}

function literalSpecifier(node) {
  return node !== undefined && ts.isStringLiteralLike(node) && MODULE_SPECIFIER.test(node.text)
    ? node.text
    : undefined;
}

function callLoadsModule(expression) {
  if (expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(expression) && expression.text === 'require') {
    return true;
  }
  return ts.isPropertyAccessExpression(expression)
    && expression.name.text === 'resolve'
    && (ts.isIdentifier(expression.expression) && expression.expression.text === 'require'
      || ts.isMetaProperty(expression.expression));
}

/** Finds every statically named module through the TypeScript syntax tree. */
export function importSpecifiers(source) {
  const specifiers = new Set();
  const syntax = ts.createSourceFile('source.tsx', source, ts.ScriptTarget.Latest, false, ts.ScriptKind.TSX);
  const collect = (node) => {
    let specifier;
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      specifier = literalSpecifier(node.moduleSpecifier);
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      specifier = literalSpecifier(node.moduleReference.expression);
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      specifier = literalSpecifier(node.argument.literal);
    } else if (ts.isCallExpression(node) && callLoadsModule(node.expression)) {
      specifier = literalSpecifier(node.arguments[0]);
    }
    if (specifier !== undefined) {
      specifiers.add(specifier);
    }
    ts.forEachChild(node, collect);
  };
  collect(syntax);
  return [...specifiers];
}

/** Static string literals, used when a policy governs file paths rather than imports. */
export function stringLiterals(source) {
  const values = new Set();
  const syntax = ts.createSourceFile('source.ts', source, ts.ScriptTarget.Latest, false);
  const collect = (node) => {
    if (ts.isStringLiteralLike(node)) {
      values.add(node.text);
    }
    ts.forEachChild(node, collect);
  };
  collect(syntax);
  return [...values];
}

/** `@scope/name/subpath` -> `@scope/name`; `name/subpath` -> `name`. */
export function packageNameOf(specifier) {
  const parts = specifier.split('/');
  return specifier.startsWith('@') && parts.length > 1 ? `${parts[0]}/${parts[1]}` : parts[0];
}
