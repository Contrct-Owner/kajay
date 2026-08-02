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
 * Finds import specifiers by pattern rather than by parsing.
 *
 * The capture excludes whitespace and the result is shape-checked, because the word
 * "from" also appears inside ordinary strings — a test title ending in "came from"
 * was enough to produce a bogus specifier before both guards were in place.
 */
export function importSpecifiers(source) {
  const specifiers = [];
  const pattern = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)(['"])([^'"\s]*)\1/gu;
  let match;
  while ((match = pattern.exec(source)) !== null) {
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
