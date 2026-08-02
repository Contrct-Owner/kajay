import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Workspace package directories, from the `packages/*` and `apps/*` globs. */
export function listWorkspaceDirs(repoRoot) {
  const dirs = [];
  for (const group of ['packages', 'apps']) {
    const base = join(repoRoot, group);
    let entries;
    try {
      entries = readdirSync(base);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const dir = join(base, entry);
      if (statSync(dir).isDirectory()) {
        dirs.push(dir);
      }
    }
  }
  return dirs;
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

/**
 * Finds import specifiers by pattern rather than by parsing.
 *
 * Comments are stripped first, and what remains is still guarded twice — the capture
 * excludes whitespace and the result is shape-checked — because the word "from" also
 * appears inside ordinary strings, and a test title ending in "came from" was enough
 * to produce a bogus specifier before those guards were in place.
 */
export function importSpecifiers(source) {
  const specifiers = [];
  const code = stripComments(source);
  const pattern = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)(['"])([^'"\s]*)\1/gu;
  let match;
  while ((match = pattern.exec(code)) !== null) {
    const specifier = match[2];
    if (specifier.length > 0 && MODULE_SPECIFIER.test(specifier)) {
      specifiers.push(specifier);
    }
  }
  return specifiers;
}

/** `@scope/name/subpath` -> `@scope/name`; `name/subpath` -> `name`. */
export function packageNameOf(specifier) {
  const parts = specifier.split('/');
  return specifier.startsWith('@') && parts.length > 1 ? `${parts[0]}/${parts[1]}` : parts[0];
}
