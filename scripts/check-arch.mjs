#!/usr/bin/env node
/**
 * Architecture checks. Every rule here is a decision from the corpus that must fail
 * the build rather than live as a convention.
 *
 * Each violation reports the rule and the file or package responsible, so the response
 * is to correct the design rather than to suppress the failure.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkCorePackageRules, assertDomRuleWorks } from './lib/coreRules.mjs';
import { readJsonc } from './lib/readJsonc.mjs';
import {
  assertPublicSurfaceLedgerRulesWork,
  publicSurfaceLedgerViolations,
} from './lib/publicRuntimeSurface.mjs';
import { assertWorkspacePolicyRulesWork } from './lib/workspacePolicySelfCheck.mjs';
import { isCorePackage } from './lib/workspacePolicy.mjs';
import { workspacePolicyViolations } from './lib/workspacePolicyRules.mjs';
import {
  importSpecifiers,
  listModuleFiles,
  listSourceFiles,
  listWorkspaceDirs,
  packageNameOf,
} from './lib/workspace.mjs';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

// The DOM-free rule carries a carve-out, so it is checked against known samples before
// it is trusted against the source. A matcher that had quietly stopped matching would
// otherwise report a clean run.
assertDomRuleWorks();
assertWorkspacePolicyRulesWork();
assertPublicSurfaceLedgerRulesWork();

const violations = [];

function fail(rule, location, detail) {
  violations.push({ rule, location, detail });
}

const workspaceDirs = listWorkspaceDirs(repoRoot);
const packagesByName = new Map();
const workspacePackages = [];

function repoRelative(path) {
  return relative(repoRoot, path).replaceAll('\\', '/');
}

function projectReferences(dir, tsconfig) {
  return (tsconfig.references ?? [])
    .map(({ path }) => repoRelative(resolve(dir, path)))
    .toSorted();
}

for (const dir of workspaceDirs) {
  const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  const tsconfigPath = join(dir, 'tsconfig.json');
  const tsconfigPresent = existsSync(tsconfigPath);
  const tsconfig = tsconfigPresent ? readJsonc(tsconfigPath) : {};
  const entry = {
    name: manifest.name,
    relativeDir: repoRelative(dir),
    manifest,
    projectReferences: projectReferences(dir, tsconfig),
    tsconfigPresent,
  };
  workspacePackages.push(entry);
  packagesByName.set(manifest.name, { dir, manifest, tsconfig });
}

const rootTsconfig = readJsonc(join(repoRoot, 'tsconfig.json'));
for (const violation of workspacePolicyViolations({
  packages: workspacePackages,
  rootProjectReferences: projectReferences(repoRoot, rootTsconfig),
  ciWorkflow: readFileSync(join(repoRoot, '.github/workflows/ci.yml'), 'utf8'),
  scriptSources: listModuleFiles(join(repoRoot, 'scripts')).map((file) => ({
    location: repoRelative(file),
    source: readFileSync(file, 'utf8'),
  })),
})) {
  violations.push(violation);
}

for (const detail of publicSurfaceLedgerViolations(
  readFileSync(join(repoRoot, 'docs/public-package-interfaces.md'), 'utf8'),
)) {
  fail('public-runtime-surface-ledger', 'docs/public-package-interfaces.md', detail);
}

for (const [name, { dir, tsconfig }] of packagesByName) {
  // ---- Rule: core packages exclude the DOM lib -----------------------------
  if (isCorePackage(name)) {
    const location = repoRelative(dir);
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
    // Public-surface tests may import their own package by name without declaring a
    // dependency on themselves. Package-local unit tests may instead use relative
    // imports to exercise an internal module; those are skipped below.
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

// Tests and the host app are held to the cross-package deep-import rule too — a
// convenience package-subpath import is most tempting exactly where nobody is watching.
for (const [name, { dir, manifest }] of packagesByName) {
  for (const subdir of ['src', 'test', 'e2e']) {
    for (const file of listSourceFiles(join(dir, subdir))) {
      const source = readFileSync(file, 'utf8');
      const location = relative(repoRoot, file);
      checkDeepImports(source, location);
      // Shipped code may only use what the package declares. Test and e2e code may
      // also use the workspace's own devDependencies — those never reach a consumer.
      checkDeclaredDependencies(source, location, manifest, subdir !== 'src');
      if (subdir === 'src' && isCorePackage(name)) {
        checkCorePackageRules(source, location, name, fail);
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
