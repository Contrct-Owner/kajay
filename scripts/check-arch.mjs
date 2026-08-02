#!/usr/bin/env node
/**
 * Architecture checks. Every rule here is a decision from the corpus that must fail
 * the build rather than live as a convention.
 *
 * Each violation reports the rule and the file or package responsible, so the response
 * is to correct the design rather than to suppress the failure.
 */
import { readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJsonc } from './lib/readJsonc.mjs';
import {
  importSpecifiers,
  listSourceFiles,
  listWorkspaceDirs,
  packageNameOf,
} from './lib/workspace.mjs';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

/** Dependency direction is law. Anything not listed here is a violation. */
const ALLOWED_PACKAGE_DEPENDENCIES = {
  '@kajay/core': [],
  '@kajay/react': ['@kajay/core'],
  '@kajay/creator-core': ['@kajay/core'],
  '@kajay/creator-react': ['@kajay/creator-core', '@kajay/react', '@kajay/core'],
  '@kajay/themes': [],
  '@kajay/host-demo': ['@kajay/core', '@kajay/react', '@kajay/creator-core', '@kajay/creator-react', '@kajay/themes'],
};

/** Packages that must stay DOM-free and dependency-free. */
const CORE_PACKAGES = new Set(['@kajay/core', '@kajay/creator-core']);

/** UI packages must take React as a peer, never a dependency. */
const UI_PACKAGES = new Set(['@kajay/react', '@kajay/creator-react']);

/**
 * ADR-0010: one root entry per package. Subpaths must be justified — themes is the
 * documented exception, because a stylesheet has no other delivery mechanism.
 */
const ALLOWED_EXPORT_KEYS = {
  default: new Set(['.', './package.json']),
  '@kajay/themes': new Set(['.', './package.json', './styles.css', './themes/*.css']),
};

// `EventTarget` earns its place here: a lint rule actively recommends it over our own
// emitter, and taking that advice would drag the DOM lib into a core package. See
// ADR-0013.
const DOM_GLOBALS = [
  'document',
  'window',
  'navigator',
  'localStorage',
  'HTMLElement',
  'EventTarget',
  'customElements',
];

const violations = [];

function fail(rule, location, detail) {
  violations.push({ rule, location, detail });
}

const workspaceDirs = listWorkspaceDirs(repoRoot);
const packagesByName = new Map();

for (const dir of workspaceDirs) {
  const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  packagesByName.set(manifest.name, { dir, manifest });
}

for (const [name, { dir, manifest }] of packagesByName) {
  const location = relative(repoRoot, dir);
  const allowed = ALLOWED_PACKAGE_DEPENDENCIES[name];

  // ---- Rule: dependency direction -----------------------------------------
  if (allowed === undefined) {
    fail('dependency-direction', location, `Package "${name}" is not listed in the allowed dependency graph.`);
  } else {
    for (const dependency of Object.keys(manifest.dependencies ?? {})) {
      if (dependency.startsWith('@kajay/') && !allowed.includes(dependency)) {
        fail(
          'dependency-direction',
          location,
          `"${name}" must not depend on "${dependency}". Allowed: ${allowed.join(', ') || '(none)'}.`,
        );
      }
    }
  }

  // ---- Rule: core packages carry zero third-party runtime dependencies -----
  if (CORE_PACKAGES.has(name)) {
    for (const dependency of Object.keys(manifest.dependencies ?? {})) {
      if (!dependency.startsWith('@kajay/')) {
        fail(
          'core-zero-dependencies',
          location,
          `Core package "${name}" declares runtime dependency "${dependency}". This needs an ADR.`,
        );
      }
    }
  }

  // ---- Rule: React is a peer dependency of UI packages, never a dependency -
  if (UI_PACKAGES.has(name) && Object.keys(manifest.dependencies ?? {}).includes('react')) {
    fail('react-peer-only', location, `UI package "${name}" lists react as a dependency; it must be a peerDependency.`);
  }

  // ---- Rule: single root export entry (ADR-0010) ---------------------------
  if (manifest.exports !== undefined) {
    const permitted = ALLOWED_EXPORT_KEYS[name] ?? ALLOWED_EXPORT_KEYS.default;
    for (const key of Object.keys(manifest.exports)) {
      if (!permitted.has(key)) {
        fail(
          'single-entry-exports',
          location,
          `Export key "${key}" is not permitted for "${name}". Adding a subpath weakens the deep-import rule and needs an ADR.`,
        );
      }
    }
  }

  // ---- Rule: core packages exclude the DOM lib -----------------------------
  if (CORE_PACKAGES.has(name)) {
    const tsconfig = readJsonc(join(dir, 'tsconfig.json'));
    const libs = (tsconfig.compilerOptions?.lib ?? []).map((entry) => entry.toLowerCase());
    for (const lib of libs) {
      if (lib.startsWith('dom')) {
        fail('core-dom-free', `${location}/tsconfig.json`, `Core package "${name}" includes lib "${lib}".`);
      }
    }
  }
}

// ---- Source-level rules ----------------------------------------------------
const exportKeysByPackage = new Map(
  [...packagesByName].map(([name, { manifest }]) => [
    name,
    new Set(Object.keys(manifest.exports ?? {})),
  ]),
);

function subpathIsPublished(target, subpath) {
  const keys = exportKeysByPackage.get(target);
  if (keys === undefined) {
    return true;
  }
  for (const key of keys) {
    if (!key.includes('*')) {
      if (key === subpath) {
        return true;
      }
      continue;
    }
    const [prefix, suffix] = key.split('*');
    if (subpath.startsWith(prefix) && subpath.endsWith(suffix)) {
      return true;
    }
  }
  return false;
}

function checkDeepImports(source, location) {
  for (const specifier of importSpecifiers(source)) {
    if (!specifier.startsWith('@kajay/')) {
      continue;
    }
    const [scope, pkg, ...rest] = specifier.split('/');
    if (rest.length === 0) {
      continue;
    }
    const target = `${scope}/${pkg}`;
    if (!subpathIsPublished(target, `./${rest.join('/')}`)) {
      fail(
        'no-deep-imports',
        location,
        `Imports "${specifier}", which is not in the published exports of "${target}".`,
      );
    }
  }
}

const rootManifest = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
const rootDevDependencies = new Set(Object.keys(rootManifest.devDependencies ?? {}));

/**
 * Rule: a package may only import what it declares.
 *
 * npm hoists dependencies into a flat node_modules, so an undeclared import resolves
 * anyway — it compiles, it passes every other check, and it even survives the pack
 * test when the consumer happens to have the package installed. That is a phantom
 * dependency, and for a core package it silently breaks the zero-dependency rule.
 *
 * pnpm's strict layout would prevent this at resolution time. Checking it here keeps
 * the guarantee independent of which package manager is in use, and reports the
 * violated rule instead of a resolution failure.
 */
function checkDeclaredDependencies(source, location, manifest, allowRootDevDependencies) {
  const declared = new Set([
    // A package's own tests import it by name rather than by relative path — that is
    // the required "through the public API" pattern, not a phantom dependency.
    manifest.name,
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {}),
  ]);

  for (const specifier of importSpecifiers(source)) {
    if (specifier.startsWith('.') || specifier.startsWith('node:')) {
      continue;
    }
    const name = packageNameOf(specifier);
    if (declared.has(name)) {
      continue;
    }
    if (allowRootDevDependencies && rootDevDependencies.has(name)) {
      continue;
    }
    fail(
      'undeclared-dependency',
      location,
      `Imports "${name}", which "${manifest.name}" does not declare. Hoisting resolves it anyway — declare it, or remove the import.`,
    );
  }
}

function checkDomFree(source, location, packageName) {
  for (const domGlobal of DOM_GLOBALS) {
    if (new RegExp(String.raw`\b${domGlobal}\b`, 'u').test(source)) {
      fail(
        'core-dom-free',
        location,
        `Core package "${packageName}" references DOM global "${domGlobal}".`,
      );
    }
  }
}

// Tests and the host app are held to the deep-import rule too — a convenience import
// is most tempting exactly where nobody is watching.
for (const [name, { dir, manifest }] of packagesByName) {
  for (const subdir of ['src', 'test', 'e2e']) {
    for (const file of listSourceFiles(join(dir, subdir))) {
      const source = readFileSync(file, 'utf8');
      const location = relative(repoRoot, file);
      checkDeepImports(source, location);
      // Shipped code may only use what the package declares. Test and e2e code may
      // also use the workspace's own devDependencies — those never reach a consumer.
      checkDeclaredDependencies(source, location, manifest, subdir !== 'src');
      if (subdir === 'src' && CORE_PACKAGES.has(name)) {
        checkDomFree(source, location, name);
      }
    }
  }
}

if (violations.length > 0) {
  console.error(`\nArchitecture check failed with ${violations.length} violation(s):\n`);
  for (const { rule, location, detail } of violations) {
    console.error(`  [${rule}] ${location}`);
    console.error(`      ${detail}`);
  }
  console.error('');
  process.exit(1);
}

console.log(`Architecture checks passed across ${packagesByName.size} workspace packages.`);
